import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

interface PaymentPayload {
  merchant: string;
  amount: string;
  currency: string;
  chain: string;
  nonce: string;
  timestamp: number;
}

// Audio context and oscillator
let audioContext: AudioContext | null = null;

function App() {
  const [amount, setAmount] = useState('')
  const [merchantName] = useState('bluebottle.eth')
  const [currency] = useState('USDC')
  const [chain] = useState('base')
  const [audioReady, setAudioReady] = useState(false)
  const [status, setStatus] = useState<'idle' | 'transmitting' | 'success' | 'error'>('idle')
  const [lastPayload, setLastPayload] = useState<PaymentPayload | null>(null)
  const stopRef = useRef(false);

  useEffect(() => {
    setAudioReady(true);
  }, []);

  // Simple FSK frequencies - cleaner ultrasound
  const FREQ_PREAMBLE = 18000;  // Start/end marker
  const FREQ_ZERO = 18500;      // Binary 0
  const FREQ_ONE = 19000;       // Binary 1
  const BIT_DURATION = 200;     // ms per bit (slower for reliability)

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

    // Data bits with long gaps for reliable detection
    for (const bit of binary) {
      if (stopRef.current) return;
      const freq = bit === '1' ? FREQ_ONE : FREQ_ZERO;
      await playTone(freq, 150); // 150ms tone
      await new Promise(r => setTimeout(r, 200)); // 200ms gap - should be clearly silent
    }

    // End marker - 5 tones
    for (let i = 0; i < 5; i++) {
      if (stopRef.current) return;
      await playTone(FREQ_PREAMBLE, BIT_DURATION);
    }
  }, [playTone]);

  const startTransmitting = useCallback(async () => {
    if (!amount) return;

    const payload: PaymentPayload = {
      merchant: merchantName,
      amount: amount,
      currency: currency,
      chain: chain,
      nonce: Math.random().toString(36).substring(2, 10),
      timestamp: Math.floor(Date.now() / 1000)
    };

    setStatus('transmitting');
    setLastPayload(payload);
    stopRef.current = false;

    // Send cents as payload (e.g., "450" for $4.50)
    const cents = Math.round(parseFloat(amount) * 100).toString();
    console.log('Transmitting cents:', cents);

    // Single transmission for testing (no loop)
    await transmitData(cents);
    console.log('Transmission complete');

    // Wait a bit then go back to idle for another charge
    await new Promise(r => setTimeout(r, 2000));
    if (!stopRef.current) {
      setStatus('idle');
    }
  }, [amount, merchantName, currency, chain, transmitData]);

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

        {status === 'transmitting' && (
          <div className="transmitting-screen">
            <div className="sonic-animation">
              <div className="sonic-wave" />
              <div className="sonic-wave" />
              <div className="sonic-wave" />
            </div>
            <h2>Emitting Ultrasonic Signal...</h2>
            <p className="frequency-info">18-19 kHz FSK</p>
            <div className="payment-details">
              <p className="amount">${lastPayload?.amount} {lastPayload?.currency}</p>
              <p className="merchant">To: {lastPayload?.merchant}</p>
              <p className="chain">Chain: {lastPayload?.chain}</p>
            </div>
            <p className="instruction">Customer's phone will detect this automatically</p>

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
            <p>Please check your browser supports Web Audio</p>
            <button className="retry-btn" onClick={() => setStatus('idle')}>
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by WalletConnect Pay + ENS</p>
        <p className="chain-info">{chain} network</p>
      </footer>
    </div>
  )
}

export default App
