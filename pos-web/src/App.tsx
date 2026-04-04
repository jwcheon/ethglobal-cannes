import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { createPayment, extractPaymentId, getPaymentStatus } from './lib/walletconnect'

interface PaymentPayload {
  merchant: string;
  amount: string;
  currency: string;
  paymentId?: string;
  gatewayUrl?: string;
  shortCode?: string;
}

// Generate a short alphanumeric code (4 chars, no confusing characters)
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Store payment mapping on server
async function storePaymentMapping(shortCode: string, paymentId: string, gatewayUrl: string, amount: string) {
  await fetch('/api/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shortCode, paymentId, gatewayUrl, amount }),
  });
}

// Audio context and oscillator
let audioContext: AudioContext | null = null;

function App() {
  const [amount, setAmount] = useState('')
  const [merchantName] = useState('SonicPay Demo')
  const [currency] = useState('USDC')
  const [audioReady, setAudioReady] = useState(false)
  const [status, setStatus] = useState<'idle' | 'creating' | 'transmitting' | 'waiting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [lastPayload, setLastPayload] = useState<PaymentPayload | null>(null)
  const stopRef = useRef(false);

  useEffect(() => {
    setAudioReady(true);
  }, []);

  // Simple FSK frequencies - cleaner ultrasound
  const FREQ_PREAMBLE = 18000;  // Start/end marker
  const FREQ_ZERO = 18500;      // Binary 0
  const FREQ_ONE = 19000;       // Binary 1
  const BIT_DURATION = 250;     // ms per preamble tone

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
      await playTone(FREQ_PREAMBLE, BIT_DURATION);
    }

    // Brief silence to separate preamble from data
    await new Promise(r => setTimeout(r, 100));

    // Data bits - 250ms tone + 50ms gap = 300ms per bit for reliability
    for (const bit of binary) {
      if (stopRef.current) return;
      const freq = bit === '1' ? FREQ_ONE : FREQ_ZERO;
      await playTone(freq, 250); // 250ms tone
      await new Promise(r => setTimeout(r, 50)); // 50ms gap
    }

    // End marker - 5 tones
    for (let i = 0; i < 5; i++) {
      if (stopRef.current) return;
      await playTone(FREQ_PREAMBLE, BIT_DURATION);
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
      await storePaymentMapping(shortCode, paymentId, gatewayUrl, amount);
      console.log('Short code:', shortCode);

      const payload: PaymentPayload = {
        merchant: merchantName,
        amount: amount,
        currency: currency,
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
  }, [amount, merchantName, currency, transmitData]);

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
        <h1>SonicPay POS</h1>
        <div className="merchant-info">
          <span className="merchant-name">{merchantName}</span>
          <span className={`status-dot ${audioReady ? 'ready' : 'loading'}`} />
        </div>
      </header>

      <main className="main">
        {status === 'idle' && (
          <>
            <div className="amount-display">
              <span className="currency-symbol">$</span>
              <span className="amount-value">{amount || '0.00'}</span>
              <span className="currency-label">{currency}</span>
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
              Charge ${amount || '0.00'} {currency}
            </button>
          </>
        )}

        {status === 'creating' && (
          <div className="transmitting-screen">
            <div className="spinner" />
            <h2>Creating Payment...</h2>
            <p className="frequency-info">Connecting to WalletConnect Pay</p>
            <div className="payment-details">
              <p className="amount">${amount} {currency}</p>
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
              <p className="amount">${lastPayload?.amount} {lastPayload?.currency}</p>
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
              <p className="amount">${lastPayload?.amount} {lastPayload?.currency}</p>
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
              <p className="amount">${lastPayload?.amount} {lastPayload?.currency}</p>
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

export default App
