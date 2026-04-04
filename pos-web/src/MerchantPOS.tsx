import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { createPayment, getPaymentStatus } from './lib/walletconnect'

interface PaymentPayload {
  merchant: string;
  amount: string;
  paymentId?: string;
  gatewayUrl?: string;
  shortCode?: string;
}

// Generate a short alphanumeric code (2 chars for quick demo)
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 2; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Store payment mapping on server
async function storePaymentMapping(shortCode: string, paymentId: string, gatewayUrl: string, amount: string, merchant: string) {
  await fetch('/api/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shortCode, paymentId, gatewayUrl, amount, merchant }),
  });
}

// Audio context and oscillator
let audioContext: AudioContext | null = null;

function MerchantPOS() {
  const [amount, setAmount] = useState('')
  const [merchantName] = useState(import.meta.env.VITE_MERCHANT_NAME || 'dontlook.fyi')
  const [audioReady, setAudioReady] = useState(false)
  const [status, setStatus] = useState<'idle' | 'creating' | 'transmitting' | 'waiting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [lastPayload, setLastPayload] = useState<PaymentPayload | null>(null)
  const [detectedCustomer, setDetectedCustomer] = useState<string | null>(null)
  const [customerLastSeen, setCustomerLastSeen] = useState<number>(0)
  const [customerDebug, setCustomerDebug] = useState<string>('')
  const stopRef = useRef(false);

  // Customer detection refs
  const rxAudioContextRef = useRef<AudioContext | null>(null)
  const rxAnalyserRef = useRef<AnalyserNode | null>(null)
  const rxStreamRef = useRef<MediaStream | null>(null)
  const rxAnimationFrameRef = useRef<number | null>(null)
  const rxDecodingStateRef = useRef<'waitingForPreamble' | 'receivingData'>('waitingForPreamble')
  const rxBitsRef = useRef<string[]>([])
  const rxPreambleCountRef = useRef(0)
  const rxStartTimeRef = useRef(0)
  const rxSamplesRef = useRef<number[]>([])
  const rxWaitingFirstBitRef = useRef(true)
  const rxBitIndexRef = useRef(0)

  useEffect(() => {
    setAudioReady(true);
  }, []);

  // FSK frequencies for TRANSMITTING payments (18-19kHz range)
  const TX_FREQ_PREAMBLE = 18000;
  const TX_FREQ_ZERO = 18500;
  const TX_FREQ_ONE = 19000;
  const BIT_DURATION = 250;

  // FSK frequencies for RECEIVING customer identity (same as payment for better reception)
  const RX_FREQ_PREAMBLE = 18000;
  const RX_FREQ_ZERO = 18500;
  const RX_FREQ_ONE = 19000;
  const FREQ_TOLERANCE = 200;
  const RX_BIT_WINDOW_MS = 300;  // Same as payment timing
  const RX_SAMPLE_WINDOW_MS = 150;  // Sample first 150ms of 200ms tone
  const RX_TIMEOUT_MS = 15000;  // Reset if no complete message in 15 seconds

  // Customer detection helpers
  const isFrequency = (freq: number, target: number) => Math.abs(freq - target) < FREQ_TOLERANCE;

  const binaryToString = (binary: string): string | null => {
    let result = '';
    for (let i = 0; i < binary.length; i += 8) {
      const byte = binary.slice(i, i + 8);
      if (byte.length === 8) {
        const charCode = parseInt(byte, 2);
        if (charCode > 0) result += String.fromCharCode(charCode);
      }
    }
    return result.length > 0 ? result : null;
  };

  const resetRxDecoder = () => {
    rxDecodingStateRef.current = 'waitingForPreamble';
    rxBitsRef.current = [];
    rxPreambleCountRef.current = 0;
    rxStartTimeRef.current = 0;
    rxSamplesRef.current = [];
    rxWaitingFirstBitRef.current = true;
    rxBitIndexRef.current = 0;
  };

  const lookupCustomer = useCallback(async (code: string) => {
    try {
      const response = await fetch(`/api/customer/lookup/${code}`);
      if (response.ok) {
        const data = await response.json();
        setDetectedCustomer(data.name);
        setCustomerLastSeen(Date.now());
        console.log('Customer found:', code, '→', data.name);
      }
    } catch (err) {
      console.error('Customer lookup failed:', err);
    }
  }, []);

  const processCustomerBroadcast = useCallback(() => {
    const bits = rxBitsRef.current;
    console.log('Processing broadcast:', bits.length, 'bits:', bits.join(''));
    if (bits.length < 8) {
      console.log('Not enough bits, resetting');
      resetRxDecoder();
      return;
    }
    const validBits = Math.floor(bits.length / 8) * 8;
    const binaryString = bits.slice(0, validBits).join('');
    const decoded = binaryToString(binaryString);
    console.log('Binary:', binaryString, '-> Decoded:', decoded);

    // Check if it's a customer broadcast (starts with ~)
    if (decoded && decoded.startsWith('~')) {
      const code = decoded.slice(1).trim().toUpperCase();
      if (code && code.length >= 2) {
        lookupCustomer(code);
      }
    }
    resetRxDecoder();
  }, [lookupCustomer]);

  const analyzeCustomerAudio = useCallback(() => {
    if (!rxAnalyserRef.current) return;

    const analyser = rxAnalyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(dataArray);

    const sampleRate = rxAudioContextRef.current?.sampleRate || 48000;
    const binSize = sampleRate / (bufferLength * 2);
    const lowBin = Math.floor(17500 / binSize);
    const highBin = Math.ceil(19500 / binSize);

    let maxValue = -Infinity;
    let maxBin = lowBin;
    for (let i = lowBin; i <= highBin && i < bufferLength; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i];
        maxBin = i;
      }
    }

    const dominantFreq = maxBin * binSize;
    const energy = Math.max(0, (maxValue + 100) / 100);

    const isPreamble = isFrequency(dominantFreq, RX_FREQ_PREAMBLE);
    const isZero = isFrequency(dominantFreq, RX_FREQ_ZERO);
    const isOne = isFrequency(dominantFreq, RX_FREQ_ONE);
    const isDataFreq = isZero || isOne;

    // Debug display
    const match = isPreamble ? 'P' : (isZero ? '0' : (isOne ? '1' : '-'));
    const state = rxDecodingStateRef.current === 'waitingForPreamble' ? 'WAIT' : (rxWaitingFirstBitRef.current ? 'SYNC' : 'RX');
    setCustomerDebug(`${Math.round(dominantFreq)}Hz [${match}] E:${energy.toFixed(2)} ${state} bits:${rxBitsRef.current.length}/24`);

    // Need minimum energy
    const minEnergy = rxDecodingStateRef.current === 'receivingData' ? 0.01 : 0.03;
    if (energy < minEnergy) {
      rxAnimationFrameRef.current = requestAnimationFrame(analyzeCustomerAudio);
      return;
    }

    if (rxDecodingStateRef.current === 'waitingForPreamble') {
      if (isPreamble) {
        rxPreambleCountRef.current++;
        if (rxPreambleCountRef.current >= 4) {
          console.log('Customer preamble detected!');
          rxDecodingStateRef.current = 'receivingData';
          rxBitsRef.current = [];
          rxSamplesRef.current = [];
          rxStartTimeRef.current = performance.now();
          rxPreambleCountRef.current = 0;
          rxWaitingFirstBitRef.current = true;
          rxBitIndexRef.current = 0;
        }
      } else {
        rxPreambleCountRef.current = Math.max(0, rxPreambleCountRef.current - 1);
      }
    } else {
      // Receiving data
      if (rxWaitingFirstBitRef.current) {
        if (isDataFreq) {
          console.log('First customer data bit detected');
          rxStartTimeRef.current = performance.now();
          rxSamplesRef.current = [dominantFreq];
          rxBitIndexRef.current = 0;
          rxWaitingFirstBitRef.current = false;
        }
        rxAnimationFrameRef.current = requestAnimationFrame(analyzeCustomerAudio);
        return;
      }

      const elapsedMs = performance.now() - rxStartTimeRef.current;
      const expectedBitIndex = Math.floor(elapsedMs / RX_BIT_WINDOW_MS);
      const timeInCurrentBit = elapsedMs % RX_BIT_WINDOW_MS;

      // Timeout after 15 seconds
      if (elapsedMs > RX_TIMEOUT_MS) {
        console.log('Customer RX timeout');
        resetRxDecoder();
        rxAnimationFrameRef.current = requestAnimationFrame(analyzeCustomerAudio);
        return;
      }

      // Record completed bits
      if (expectedBitIndex > rxBitIndexRef.current) {
        while (rxBitIndexRef.current < expectedBitIndex && rxSamplesRef.current.length > 0) {
          const avgFreq = rxSamplesRef.current.reduce((a, b) => a + b, 0) / rxSamplesRef.current.length;
          const bit = isFrequency(avgFreq, RX_FREQ_ONE) ? '1' : '0';
          rxBitsRef.current.push(bit);
          rxBitIndexRef.current++;
          rxSamplesRef.current = [];
        }
        rxBitIndexRef.current = expectedBitIndex;
      }

      // End marker detection - customer sends 5 end preambles
      // At ~60fps, 5 tones × 250ms = ~75 frames, but we detect after ~10 consecutive
      if (isPreamble && rxBitsRef.current.length >= 16) {
        rxPreambleCountRef.current++;
        // Process after seeing ~10 consecutive preamble frames (covers ~2 preamble tones)
        if (rxPreambleCountRef.current >= 10) {
          console.log('Customer end marker detected with', rxBitsRef.current.length, 'bits');
          // Finalize pending bit
          if (rxSamplesRef.current.length > 0) {
            const avgFreq = rxSamplesRef.current.reduce((a, b) => a + b, 0) / rxSamplesRef.current.length;
            const bit = isFrequency(avgFreq, RX_FREQ_ONE) ? '1' : '0';
            rxBitsRef.current.push(bit);
          }
          // Trim to byte boundary and process
          const validBits = Math.floor(rxBitsRef.current.length / 8) * 8;
          rxBitsRef.current = rxBitsRef.current.slice(0, validBits);
          processCustomerBroadcast();
          rxAnimationFrameRef.current = requestAnimationFrame(analyzeCustomerAudio);
          return;
        }
      } else if (isDataFreq) {
        rxPreambleCountRef.current = 0;
        // Sample during tone portion
        if (timeInCurrentBit < RX_SAMPLE_WINDOW_MS) {
          rxSamplesRef.current.push(dominantFreq);
        }
      }
    }

    rxAnimationFrameRef.current = requestAnimationFrame(analyzeCustomerAudio);
  }, [processCustomerBroadcast]);

  const startCustomerDetection = useCallback(async () => {
    try {
      console.log('Requesting microphone for customer detection...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 }
      });
      rxStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      rxAudioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.1;
      source.connect(analyser);
      rxAnalyserRef.current = analyser;

      resetRxDecoder();
      rxAnimationFrameRef.current = requestAnimationFrame(analyzeCustomerAudio);
      console.log('Customer detection started, listening on 18-19kHz');
    } catch (err) {
      console.log('Customer detection not available:', err);
    }
  }, [analyzeCustomerAudio]);

  const stopCustomerDetection = useCallback(() => {
    if (rxAnimationFrameRef.current) cancelAnimationFrame(rxAnimationFrameRef.current);
    if (rxStreamRef.current) rxStreamRef.current.getTracks().forEach(track => track.stop());
    if (rxAudioContextRef.current && rxAudioContextRef.current.state !== 'closed') {
      rxAudioContextRef.current.close();
    }
  }, []);

  // Customer detection only when on idle screen
  useEffect(() => {
    if (status === 'idle') {
      startCustomerDetection();
      return () => stopCustomerDetection();
    } else {
      stopCustomerDetection();
    }
  }, [status, startCustomerDetection, stopCustomerDetection]);

  // Clear customer after 10 seconds of no signal
  useEffect(() => {
    if (!detectedCustomer) return;
    const timer = setInterval(() => {
      if (Date.now() - customerLastSeen > 10000) {
        setDetectedCustomer(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [detectedCustomer, customerLastSeen]);

  const playTone = useCallback((frequency: number, duration: number): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioContext) {
        audioContext = new AudioContext({ sampleRate: 48000 });
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      // Smooth envelope to reduce clicks
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + duration / 1000 - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration / 1000);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration / 1000);

      oscillator.onended = () => resolve();
    });
  }, []);

  const stringToBinary = (str: string): string => {
    return str.split('').map(char =>
      char.charCodeAt(0).toString(2).padStart(8, '0')
    ).join('');
  };

  const transmitData = useCallback(async (data: string) => {
    const binary = stringToBinary(data);
    console.log(`Transmitting: "${data}" as binary: ${binary} (${binary.length} bits)`);

    // Brief silence before transmission
    await new Promise(r => setTimeout(r, 500));

    // Start preamble - 10 tones
    for (let i = 0; i < 10; i++) {
      if (stopRef.current) return;
      await playTone(TX_FREQ_PREAMBLE, BIT_DURATION);
    }

    // Brief silence to separate preamble from data
    await new Promise(r => setTimeout(r, 100));

    // Data bits - 200ms tone + 100ms gap = 300ms per bit
    for (const bit of binary) {
      if (stopRef.current) return;
      const freq = bit === '1' ? TX_FREQ_ONE : TX_FREQ_ZERO;
      await playTone(freq, 200); // 200ms tone
      await new Promise(r => setTimeout(r, 100)); // 100ms gap
    }

    // End marker - 5 tones
    for (let i = 0; i < 5; i++) {
      if (stopRef.current) return;
      await playTone(TX_FREQ_PREAMBLE, BIT_DURATION);
    }
  }, [playTone]);

  const startTransmitting = useCallback(async () => {
    if (!amount) return;

    stopRef.current = false;
    setErrorMessage('');

    try {
      // Step 1: Create WC Pay payment
      setStatus('creating');
      const cents = Math.round(parseFloat(amount) * 100);
      console.log('Creating WC Pay payment for', cents, 'cents');

      const paymentResponse = await createPayment(cents);
      console.log('Payment created:', paymentResponse);

      const paymentId = paymentResponse.paymentId;
      const gatewayUrl = paymentResponse.gatewayUrl;
      console.log('Payment ID:', paymentId);

      // Generate short code and store mapping
      const shortCode = generateShortCode();
      await storePaymentMapping(shortCode, paymentId, gatewayUrl, amount, merchantName);
      console.log('Short code:', shortCode);

      const payload: PaymentPayload = {
        merchant: merchantName,
        amount: amount,
        paymentId: paymentId,
        gatewayUrl: gatewayUrl,
        shortCode: shortCode,
      };

      setLastPayload(payload);
      setStatus('transmitting');

      // Step 2: Transmit SHORT CODE via ultrasound (not full paymentId!)
      console.log('Transmitting short code:', shortCode);
      await transmitData(shortCode);
      console.log('Transmission complete');

      // Step 3: Wait for payment (poll status)
      setStatus('waiting');
      const pollInterval = setInterval(async () => {
        if (stopRef.current) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const status = await getPaymentStatus(paymentId);
          console.log('Payment status:', status.status);

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setStatus('success');
            setTimeout(() => {
              setStatus('idle');
              setAmount('');
              setLastPayload(null);
            }, 5000);
          } else if (status.status === 'failed' || status.status === 'cancelled') {
            clearInterval(pollInterval);
            setErrorMessage(`Payment ${status.status}`);
            setStatus('error');
          }
        } catch (err) {
          console.error('Status poll error:', err);
        }
      }, 3000);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (status === 'waiting') {
          setStatus('idle');
        }
      }, 120000);

    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [amount, merchantName, transmitData]);

  const stopTransmitting = useCallback(() => {
    stopRef.current = true;
    setStatus('idle');
    setLastPayload(null);
  }, []);

  const simulatePaymentReceived = useCallback(() => {
    stopTransmitting();
    setStatus('success');
    setTimeout(() => {
      setStatus('idle');
      setAmount('');
      setLastPayload(null);
    }, 5000);
  }, [stopTransmitting]);

  const handleAmountClick = (value: string) => {
    if (value === 'C') {
      setAmount('');
    } else if (value === 'back') {
      setAmount(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!amount.includes('.')) {
        setAmount(prev => prev === '' ? '0.' : prev + '.');
      }
    } else {
      if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
      setAmount(prev => prev + value);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>👀 dontlook.fyi</h1>
        <div className="merchant-info">
          <span className="merchant-name">{merchantName}</span>
          <span className={`status-dot ${audioReady ? 'ready' : 'loading'}`} />
        </div>
      </header>

      <main className="main">
        {status === 'idle' && (
          <>
            {detectedCustomer && (
              <div className="customer-detected">
                <div className="label">Customer Detected</div>
                <div className="name">{detectedCustomer}</div>
              </div>
            )}

            {customerDebug && (
              <div className="frequency-info" style={{ marginBottom: '8px' }}>
                {customerDebug}
              </div>
            )}

            <div className="amount-display">
              <span className="currency-symbol">$</span>
              <span className="amount-value">{amount || '0.00'}</span>
              <span className="currency-label">USD</span>
            </div>

            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((key) => (
                <button
                  key={key}
                  className="keypad-btn"
                  onClick={() => handleAmountClick(key)}
                >
                  {key === 'back' ? '←' : key}
                </button>
              ))}
            </div>

            <button
              className="charge-btn"
              onClick={startTransmitting}
              disabled={!audioReady || !amount || parseFloat(amount) <= 0}
            >
              Charge ${amount || '0.00'}
            </button>
          </>
        )}

        {status === 'creating' && (
          <div className="transmitting-screen">
            <div className="spinner" />
            <h2>Creating Payment...</h2>
            <p className="frequency-info">Connecting to WalletConnect Pay</p>
            <div className="payment-details">
              <p className="amount">${amount}</p>
            </div>
          </div>
        )}

        {status === 'transmitting' && (
          <div className="transmitting-screen">
            <div className="sonic-animation">
              <div className="sonic-wave" />
              <div className="sonic-wave" />
              <div className="sonic-wave" />
            </div>
            <h2>Emitting Ultrasonic Signal...</h2>
            <p className="frequency-info">Code: {lastPayload?.shortCode}</p>
            <div className="payment-details">
              <p className="amount">${lastPayload?.amount} </p>
            </div>
            <p className="instruction">~10 seconds • Phone will detect automatically</p>

            <div className="action-buttons">
              <button className="cancel-btn" onClick={stopTransmitting}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === 'waiting' && (
          <div className="transmitting-screen">
            <div className="spinner" />
            <h2>Waiting for Payment...</h2>
            <p className="frequency-info">Customer confirming on their device</p>
            <div className="payment-details">
              <p className="amount">${lastPayload?.amount} </p>
              <p className="payment-id">ID: {lastPayload?.paymentId}</p>
            </div>

            <div className="action-buttons">
              <button className="simulate-btn" onClick={simulatePaymentReceived}>
                [Demo] Simulate Payment Received
              </button>
              <button className="cancel-btn" onClick={stopTransmitting}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="success-screen">
            <div className="checkmark">✓</div>
            <h2>Payment Received!</h2>
            <div className="payment-details">
              <p className="amount">${lastPayload?.amount} </p>
              <p className="merchant">From: customer.eth</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="error-screen">
            <div className="error-icon">!</div>
            <h2>Something went wrong</h2>
            <p>{errorMessage || 'Please check your browser supports Web Audio'}</p>
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

export default MerchantPOS
