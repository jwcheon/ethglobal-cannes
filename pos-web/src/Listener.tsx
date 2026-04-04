import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import { getMerchantName } from './lib/walletconnect'

interface PaymentInfo {
  paymentId: string
  gatewayUrl: string
  amount: string
  merchant: string
}

// FSK Frequencies for RECEIVING merchant payments (18-19kHz range)
const RX_FREQ_PREAMBLE = 18000
const RX_FREQ_ZERO = 18500
const RX_FREQ_ONE = 19000

// FSK Frequencies for TRANSMITTING customer identity (same as payment for better transmission)
const TX_FREQ_PREAMBLE = 18000
const TX_FREQ_ZERO = 18500
const TX_FREQ_ONE = 19000

const FREQ_TOLERANCE = 200

// Timing - must match transmitter
const BIT_WINDOW_MS = 300
const SAMPLE_WINDOW_MS = 150

// Customer broadcast settings (unused but kept for reference)
// const BROADCAST_INTERVAL_MS = 5000

// Generate 2-char short code for quick demo
function generateCustomerCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 2; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function Listener() {
  const [isListening, setIsListening] = useState(false)
  const [signalStrength, setSignalStrength] = useState(0)
  const [debugInfo, setDebugInfo] = useState('')
  const [status, setStatus] = useState<'idle' | 'listening' | 'received' | 'error' | 'offline'>('idle')
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('customerName') || '')
  const [customerCode, setCustomerCode] = useState<string | null>(null)
  const customerCodeRef = useRef<string | null>(null)
  const [bitsReceived, setBitsReceived] = useState(0)
  const [isReceivingData, setIsReceivingData] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const txAudioContextRef = useRef<AudioContext | null>(null)
  const broadcastIntervalRef = useRef<number | null>(null)
  const [isEmittingName, setIsEmittingName] = useState(false)
  const [isEmittingOffline, setIsEmittingOffline] = useState(false)

  // Decoding state
  const decodingStateRef = useRef<'waitingForPreamble' | 'receivingData'>('waitingForPreamble')
  const receivedBitsRef = useRef<string[]>([])
  const preambleCountRef = useRef(0)
  const rxStartTimeRef = useRef(0)
  const currentBitSamplesRef = useRef<number[]>([])
  const silenceCountRef = useRef(0)
  const waitingForFirstDataBitRef = useRef(true)
  const currentBitIndexRef = useRef(0)
  const hasTriggeredRef = useRef(false)

  // Frequency visualization
  const freqCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const freqHistoryRef = useRef<{ freq: number; energy: number; match: string }[]>([])

  const isFrequency = (freq: number, target: number): boolean => {
    return Math.abs(freq - target) < FREQ_TOLERANCE
  }

  // Transmit customer identity
  const playTone = useCallback(async (frequency: number, duration: number): Promise<void> => {
    if (!txAudioContextRef.current) {
      txAudioContextRef.current = new AudioContext({ sampleRate: 48000 })
    }
    const ctx = txAudioContextRef.current

    // Resume AudioContext if suspended (required on iOS)
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    return new Promise((resolve) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

      // Max gain for phone speakers
      gainNode.gain.setValueAtTime(0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.01)
      gainNode.gain.setValueAtTime(1.0, ctx.currentTime + duration / 1000 - 0.01)
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000)

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start()
      oscillator.stop(ctx.currentTime + duration / 1000)
      oscillator.onended = () => resolve()
    })
  }, [])

  const stringToBinary = (str: string): string => {
    return str.split('').map(char =>
      char.charCodeAt(0).toString(2).padStart(8, '0')
    ).join('')
  }

  const storeCustomerMapping = useCallback(async (code: string, name: string) => {
    try {
      await fetch('/api/customer/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortCode: code, name }),
      })
      console.log('Customer mapping stored:', code, '→', name)
    } catch (err) {
      console.error('Failed to store customer mapping:', err)
    }
  }, [])

  // Save customer name to localStorage
  useEffect(() => {
    if (customerName) {
      localStorage.setItem('customerName', customerName)
    }
  }, [customerName])

  // Emit name once when button is pressed
  const emitNameOnce = useCallback(async () => {
    if (!customerName.trim()) return
    setIsEmittingName(true)

    // Generate code and store mapping
    const code = generateCustomerCode()
    setCustomerCode(code)
    customerCodeRef.current = code
    await storeCustomerMapping(code, customerName.trim())

    // Transmit: ~XX (3 chars = 24 bits)
    const data = `~${code}`
    const binary = stringToBinary(data)
    console.log(`Emitting customer code: ${data} for name: ${customerName}`)

    // Preamble - 10 tones
    for (let i = 0; i < 10; i++) {
      await playTone(TX_FREQ_PREAMBLE, 250)
    }
    await new Promise(r => setTimeout(r, 100))

    // Data bits - 200ms tone + 100ms gap
    for (const bit of binary) {
      const freq = bit === '1' ? TX_FREQ_ONE : TX_FREQ_ZERO
      await playTone(freq, 200)
      await new Promise(r => setTimeout(r, 100))
    }

    // End marker - 5 tones
    for (let i = 0; i < 5; i++) {
      await playTone(TX_FREQ_PREAMBLE, 250)
    }

    console.log('Finished emitting customer code')
    setIsEmittingName(false)
  }, [customerName, playTone, storeCustomerMapping])

  // Offline mode: emit full name without API
  const startOfflineMode = useCallback(() => {
    if (!customerName.trim()) return
    setStatus('offline')
  }, [customerName])

  const emitNameOffline = useCallback(async () => {
    if (!customerName.trim()) return
    setIsEmittingOffline(true)

    // Transmit: !NAME (! prefix for offline, full name)
    const data = `!${customerName.trim()}`
    const binary = stringToBinary(data)
    console.log(`Offline emitting: ${data} (${binary.length} bits)`)

    // Preamble - 10 tones
    for (let i = 0; i < 10; i++) {
      await playTone(TX_FREQ_PREAMBLE, 250)
    }
    await new Promise(r => setTimeout(r, 100))

    // Data bits - 200ms tone + 100ms gap
    for (const bit of binary) {
      const freq = bit === '1' ? TX_FREQ_ONE : TX_FREQ_ZERO
      await playTone(freq, 200)
      await new Promise(r => setTimeout(r, 100))
    }

    // End marker - 5 tones
    for (let i = 0; i < 5; i++) {
      await playTone(TX_FREQ_PREAMBLE, 250)
    }

    console.log('Finished offline emit')
    setIsEmittingOffline(false)
  }, [customerName, playTone])

  const exitOfflineMode = useCallback(() => {
    setStatus('idle')
    setIsEmittingOffline(false)
  }, [])

  // Customer broadcasting disabled for now - focusing on receiving payments
  /*
  useEffect(() => {
    // Stop any existing broadcast first
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current)
      broadcastIntervalRef.current = null
      setIsBroadcasting(false)
    }

    // Debounce: wait 1 second after user stops typing
    const debounceTimer = setTimeout(() => {
      if (customerName.trim() && status === 'idle') {
        // Generate new code for this name
        const code = generateCustomerCode()
        setCustomerCode(code)
        customerCodeRef.current = code
        storeCustomerMapping(code, customerName.trim())

        // Start periodic broadcasting
        setIsBroadcasting(true)
        broadcastIdentity()
        broadcastIntervalRef.current = window.setInterval(() => {
          broadcastIdentity()
        }, 15000) // Broadcast every 15 seconds
      } else {
        setCustomerCode(null)
        customerCodeRef.current = null
      }
    }, 1000) // 1 second debounce

    return () => {
      clearTimeout(debounceTimer)
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current)
        broadcastIntervalRef.current = null
      }
    }
  }, [customerName, status, broadcastIdentity, storeCustomerMapping])
  */

  const binaryToString = (binary: string): string | null => {
    let result = ''
    for (let i = 0; i < binary.length; i += 8) {
      const byte = binary.slice(i, i + 8)
      if (byte.length === 8) {
        const charCode = parseInt(byte, 2)
        if (charCode > 0) {
          result += String.fromCharCode(charCode)
        }
      }
    }
    return result.length > 0 ? result : null
  }

  const resetDecoder = useCallback(() => {
    decodingStateRef.current = 'waitingForPreamble'
    receivedBitsRef.current = []
    preambleCountRef.current = 0
    rxStartTimeRef.current = 0
    currentBitSamplesRef.current = []
    silenceCountRef.current = 0
    waitingForFirstDataBitRef.current = true
    currentBitIndexRef.current = 0
    setBitsReceived(0)
    setIsReceivingData(false)
  }, [])

  const lookupPayment = useCallback(async (shortCode: string) => {
    try {
      console.log('Looking up payment:', shortCode)
      const response = await fetch(`/api/lookup/${shortCode.toUpperCase()}`)
      if (!response.ok) {
        throw new Error('Payment not found')
      }
      const data = await response.json()
      console.log('Payment found:', data)

      // Try to get real merchant name from WalletConnect Gateway API
      let merchantName = data.merchant || 'Merchant'
      try {
        const realMerchantName = await getMerchantName(data.paymentId)
        if (realMerchantName) {
          merchantName = realMerchantName
          console.log('Got real merchant name:', realMerchantName)
        }
      } catch (err) {
        console.log('Could not fetch merchant name from Gateway, using stored:', merchantName)
      }

      setPayment({
        paymentId: data.paymentId,
        gatewayUrl: data.gatewayUrl,
        amount: data.amount,
        merchant: merchantName
      })
      setStatus('received')
      hasTriggeredRef.current = true
    } catch (err) {
      console.error('Lookup error:', err)
      setErrorMessage('Payment not found')
      setStatus('error')
    }
  }, [])

  const processReceivedData = useCallback(() => {
    const bits = receivedBitsRef.current
    if (bits.length < 8) {
      console.log('Not enough bits:', bits.length)
      resetDecoder()
      return
    }

    // Trim to multiple of 8
    const validBits = Math.floor(bits.length / 8) * 8
    const binaryString = bits.slice(0, validBits).join('')
    console.log('Received binary:', binaryString, `(${binaryString.length} bits)`)

    const shortCode = binaryToString(binaryString)
    console.log('Decoded short code:', shortCode)

    // Ignore customer identity broadcasts (start with ~), only process payment codes
    // Payment codes are now 2 chars
    if (shortCode && shortCode.length >= 2 && !shortCode.startsWith('~') && !hasTriggeredRef.current) {
      lookupPayment(shortCode.trim())
    }

    resetDecoder()
  }, [resetDecoder, lookupPayment])

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isListening) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    analyser.getFloatFrequencyData(dataArray)

    // Find dominant frequency in our range (17.5-19.5 kHz)
    const sampleRate = audioContextRef.current?.sampleRate || 48000
    const binSize = sampleRate / (bufferLength * 2)
    const lowBin = Math.floor(17500 / binSize)
    const highBin = Math.ceil(19500 / binSize)

    let maxValue = -Infinity
    let maxBin = lowBin

    for (let i = lowBin; i <= highBin && i < bufferLength; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i]
        maxBin = i
      }
    }

    const dominantFreq = maxBin * binSize
    const energy = Math.max(0, (maxValue + 100) / 100) // Normalize dB to 0-1

    setSignalStrength(Math.min(energy, 1))

    // Need minimum energy
    if (energy < 0.3) {
      silenceCountRef.current++
      if (decodingStateRef.current === 'receivingData' && silenceCountRef.current > 10 && receivedBitsRef.current.length >= 16) {
        const validBits = Math.floor(receivedBitsRef.current.length / 8) * 8
        receivedBitsRef.current = receivedBitsRef.current.slice(0, validBits)
        console.log('Silence detected, processing', receivedBitsRef.current.length, 'bits')
        processReceivedData()
      }
      animationFrameRef.current = requestAnimationFrame(analyzeAudio)
      return
    }
    silenceCountRef.current = 0

    const isPreamble = isFrequency(dominantFreq, RX_FREQ_PREAMBLE)
    const isZero = isFrequency(dominantFreq, RX_FREQ_ZERO)
    const isOne = isFrequency(dominantFreq, RX_FREQ_ONE)
    const isDataFreq = isZero || isOne

    const match = isPreamble ? 'P' : (isZero ? '0' : (isOne ? '1' : '-'))
    setDebugInfo(`${Math.round(dominantFreq)}Hz [${match}] ${decodingStateRef.current === 'waitingForPreamble' ? 'WAIT' : 'RX'} bits:${receivedBitsRef.current.length}`)

    // Update frequency history for visualization
    freqHistoryRef.current.push({ freq: dominantFreq, energy, match })
    if (freqHistoryRef.current.length > 100) {
      freqHistoryRef.current.shift()
    }

    // Draw frequency visualization
    const canvas = freqCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const width = canvas.width
        const height = canvas.height
        const history = freqHistoryRef.current
        const freqToY = (f: number) => height - ((f - 17500) / 2500) * height

        // Clear canvas
        ctx.fillStyle = '#18181b'
        ctx.fillRect(0, 0, width, height)

        // Draw frequency range guides
        ctx.strokeStyle = '#3f3f46'
        ctx.lineWidth = 1
        ;[18000, 18500, 19000].forEach(f => {
          const y = freqToY(f)
          ctx.beginPath()
          ctx.setLineDash([4, 4])
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.stroke()
        })
        ctx.setLineDash([])

        // Draw frequency line
        if (history.length > 1) {
          ctx.beginPath()
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 2

          history.forEach((point, i) => {
            const x = (i / 100) * width
            const y = freqToY(point.freq)
            if (i === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          })
          ctx.stroke()

          // Draw dots for matches
          history.forEach((point, i) => {
            if (point.match !== '-' && point.energy > 0.02) {
              const x = (i / 100) * width
              const y = freqToY(point.freq)
              ctx.beginPath()
              ctx.fillStyle = point.match === 'P' ? '#f59e0b' : (point.match === '1' ? '#10b981' : '#ef4444')
              ctx.arc(x, y, 3, 0, Math.PI * 2)
              ctx.fill()
            }
          })
        }

        // Labels
        ctx.fillStyle = '#52525b'
        ctx.font = '9px monospace'
        ctx.fillText('19k', 4, freqToY(19000) + 3)
        ctx.fillText('18.5k', 4, freqToY(18500) + 3)
        ctx.fillText('18k', 4, freqToY(18000) + 3)
      }
    }

    if (decodingStateRef.current === 'waitingForPreamble') {
      if (isPreamble) {
        preambleCountRef.current++
        if (preambleCountRef.current >= 8) {
          console.log('Preamble detected!')
          decodingStateRef.current = 'receivingData'
          receivedBitsRef.current = []
          currentBitSamplesRef.current = []
          rxStartTimeRef.current = performance.now()
          preambleCountRef.current = 0
          waitingForFirstDataBitRef.current = true
          currentBitIndexRef.current = 0
          setIsReceivingData(true)
          setBitsReceived(0)
        }
      } else {
        preambleCountRef.current = Math.max(0, preambleCountRef.current - 1)
      }
    } else {
      // Receiving data
      if (waitingForFirstDataBitRef.current) {
        if (isDataFreq) {
          console.log('First data bit detected')
          rxStartTimeRef.current = performance.now()
          currentBitSamplesRef.current = [dominantFreq]
          currentBitIndexRef.current = 0
          waitingForFirstDataBitRef.current = false
        }
        animationFrameRef.current = requestAnimationFrame(analyzeAudio)
        return
      }

      const elapsedMs = performance.now() - rxStartTimeRef.current
      const expectedBitIndex = Math.floor(elapsedMs / BIT_WINDOW_MS)
      const timeInCurrentBit = elapsedMs % BIT_WINDOW_MS

      // Check if we've moved to a new bit window
      if (expectedBitIndex > currentBitIndexRef.current) {
        while (currentBitIndexRef.current < expectedBitIndex && currentBitSamplesRef.current.length > 0) {
          const avgFreq = currentBitSamplesRef.current.reduce((a, b) => a + b, 0) / currentBitSamplesRef.current.length
          const bit = isFrequency(avgFreq, RX_FREQ_ONE) ? '1' : '0'
          receivedBitsRef.current.push(bit)
          console.log(`Bit[${currentBitIndexRef.current}]: ${bit} (avg: ${Math.round(avgFreq)}Hz)`)
          currentBitIndexRef.current++
          currentBitSamplesRef.current = []
          setBitsReceived(receivedBitsRef.current.length)
        }
        currentBitIndexRef.current = expectedBitIndex
      }

      // Check for end marker
      if (isPreamble && receivedBitsRef.current.length >= 8) {
        preambleCountRef.current++
        if (preambleCountRef.current >= 3) {
          if (currentBitSamplesRef.current.length > 0) {
            const avgFreq = currentBitSamplesRef.current.reduce((a, b) => a + b, 0) / currentBitSamplesRef.current.length
            const bit = isFrequency(avgFreq, RX_FREQ_ONE) ? '1' : '0'
            receivedBitsRef.current.push(bit)
          }
          const validBits = Math.floor(receivedBitsRef.current.length / 8) * 8
          receivedBitsRef.current = receivedBitsRef.current.slice(0, validBits)
          console.log('End marker detected, processing', receivedBitsRef.current.length, 'bits')
          processReceivedData()
          animationFrameRef.current = requestAnimationFrame(analyzeAudio)
          return
        }
      } else {
        preambleCountRef.current = 0
      }

      // Sample during tone portion
      if (timeInCurrentBit < SAMPLE_WINDOW_MS && isDataFreq) {
        currentBitSamplesRef.current.push(dominantFreq)
      }
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [isListening, processReceivedData])

  const startListening = useCallback(async () => {
    try {
      // Stop any ongoing broadcast
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current)
        broadcastIntervalRef.current = null
      }

      // Start listening for payments
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        }
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 48000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0.1
      source.connect(analyser)
      analyserRef.current = analyser

      setIsListening(true)
      setStatus('listening')
      hasTriggeredRef.current = false
      resetDecoder()

      console.log('Listening started, sample rate:', audioContext.sampleRate)
    } catch (err) {
      console.error('Failed to start listening:', err)
      setErrorMessage('Microphone access denied')
      setStatus('error')
    }
  }, [resetDecoder])

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    setIsListening(false)
    setStatus('idle')
    setSignalStrength(0)
    resetDecoder()
  }, [resetDecoder])

  useEffect(() => {
    if (isListening) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio)
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isListening, analyzeAudio])

  // Initialize canvas with empty state
  useEffect(() => {
    if (status !== 'listening') return
    const canvas = freqCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const freqToY = (f: number) => height - ((f - 17500) / 2500) * height

    // Dark background
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, width, height)

    // Draw frequency range guides
    ctx.strokeStyle = '#3f3f46'
    ctx.lineWidth = 1
    ;[18000, 18500, 19000].forEach(f => {
      const y = freqToY(f)
      ctx.beginPath()
      ctx.setLineDash([4, 4])
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    })
    ctx.setLineDash([])

    // Labels
    ctx.fillStyle = '#52525b'
    ctx.font = '9px monospace'
    ctx.fillText('19k', 4, freqToY(19000) + 3)
    ctx.fillText('18.5k', 4, freqToY(18500) + 3)
    ctx.fillText('18k', 4, freqToY(18000) + 3)

    // Clear history
    freqHistoryRef.current = []
  }, [status])

  const openPayment = () => {
    if (payment?.gatewayUrl) {
      window.open(payment.gatewayUrl, '_blank')
    }
  }

  const reset = () => {
    setPayment(null)
    setStatus('listening')
    hasTriggeredRef.current = false
    resetDecoder()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>👀 dontlook.fyi</h1>
        <div className="merchant-info">
          <Link to="/" className="mode-switch">← POS</Link>
          <span className={`status-dot ${isListening ? 'ready' : 'loading'}`} />
        </div>
      </header>

      <main className="main">
        {status === 'idle' && (
          <div className="transmitting-screen">
            <div className="sonic-animation" style={{ opacity: 0.2 }}>
              <div className="sonic-wave" />
              <div className="sonic-wave" />
              <div className="sonic-wave" />
            </div>
            <h2>Ready to Receive</h2>
            <p className="hint-text">Listen for payment requests</p>

            <div style={{ margin: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <input
                type="text"
                className="name-input"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <button
                onClick={emitNameOnce}
                disabled={!customerName.trim() || isEmittingName || isEmittingOffline}
                className="simulate-btn"
                style={{
                  background: !customerName.trim() || isEmittingName ? 'var(--bg-tertiary)' : 'var(--success)',
                  border: 'none',
                  opacity: !customerName.trim() || isEmittingName ? 0.5 : 1
                }}
              >
                {isEmittingName ? 'Emitting...' : 'Emit My Name'}
              </button>
              <button
                onClick={startOfflineMode}
                disabled={!customerName.trim() || isEmittingOffline || isEmittingName}
                className="simulate-btn"
                style={{
                  background: 'transparent',
                  border: '1px dashed var(--border)',
                  opacity: !customerName.trim() ? 0.5 : 1
                }}
              >
                Offline Mode
              </button>
            </div>

            <button className="charge-btn" onClick={startListening}>
              Start Listening
            </button>
          </div>
        )}

        {status === 'offline' && (
          <div className="transmitting-screen">
            {isEmittingOffline ? (
              <>
                <div className="sonic-animation">
                  <div className="sonic-wave" />
                  <div className="sonic-wave" />
                  <div className="sonic-wave" />
                </div>
                <h2>Emitting Name...</h2>
                <p className="frequency-info">Sending: {customerName}</p>
                <p className="hint-text">No API • Direct ultrasonic transmission</p>
              </>
            ) : (
              <>
                <div className="sonic-animation" style={{ opacity: 0.3 }}>
                  <div className="sonic-wave" />
                  <div className="sonic-wave" />
                  <div className="sonic-wave" />
                </div>
                <h2>Offline Mode</h2>
                <p className="hint-text">Transmit your name without server</p>

                <div className="customer-detected" style={{ margin: '20px 0' }}>
                  <div className="label">Your Name</div>
                  <div className="name" style={{ fontSize: '24px' }}>{customerName}</div>
                </div>

                <button
                  className="charge-btn"
                  onClick={emitNameOffline}
                  disabled={isEmittingOffline}
                >
                  Emit My Name
                </button>
              </>
            )}

            <button className="cancel-btn" onClick={exitOfflineMode} style={{ marginTop: '16px' }}>
              Exit Offline Mode
            </button>
          </div>
        )}

        {status === 'listening' && (
          <div className="transmitting-screen">
            <div className="sonic-animation">
              <div className="sonic-wave" />
              <div className="sonic-wave" />
              <div className="sonic-wave" />
            </div>
            <h2>{isReceivingData ? 'Receiving Payment...' : 'Listening...'}</h2>
            {customerName && customerCode && (
              <p className="frequency-info">Broadcasting as: <strong>{customerName}</strong> ({customerCode})</p>
            )}

            {isReceivingData ? (
              <>
                <div style={{
                  width: '80%',
                  maxWidth: '240px',
                  height: '4px',
                  background: 'var(--border)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  margin: '12px auto'
                }}>
                  <div style={{
                    width: `${Math.min((bitsReceived / 16) * 100, 100)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: '2px',
                    transition: 'width 0.1s'
                  }} />
                </div>
                <p className="frequency-info">{bitsReceived}/16 bits</p>
              </>
            ) : (
              <p className="hint-text">Waiting for payment request</p>
            )}

            <div className="signal-bars">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`signal-bar ${i < signalStrength * 5 ? 'active' : ''}`}
                  style={{ height: `${12 + i * 4}px` }}
                />
              ))}
            </div>
            <p className="instruction">Signal: {Math.round(signalStrength * 100)}%</p>

            {debugInfo && (
              <p className="frequency-info" style={{ fontSize: '10px', opacity: 0.6 }}>{debugInfo}</p>
            )}

            <canvas
              ref={freqCanvasRef}
              width={280}
              height={80}
              style={{
                borderRadius: '8px',
                border: '1px solid var(--border)',
                marginTop: '16px',
              }}
            />

            <button className="cancel-btn" onClick={stopListening} style={{ marginTop: '16px' }}>
              Stop Listening
            </button>
          </div>
        )}

        {status === 'received' && payment && (
          <div className="success-screen">
            <div className="checkmark">$</div>
            <h2>Payment Request</h2>
            <div className="payment-details">
              <p className="amount">${payment.amount}</p>
              <p className="merchant">To: {payment.merchant}</p>
              <p className="payment-id">ID: {payment.paymentId.slice(0, 20)}...</p>
            </div>
            <button className="charge-btn" onClick={openPayment}>
              Pay with WalletConnect
            </button>
            <button className="cancel-btn" onClick={reset} style={{ marginTop: '12px' }}>
              Cancel
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="error-screen">
            <div className="error-icon">!</div>
            <h2>Error</h2>
            <p>{errorMessage}</p>
            <button className="retry-btn" onClick={() => setStatus('idle')}>
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by WalletConnect Pay</p>
      </footer>
    </div>
  )
}

export default Listener
