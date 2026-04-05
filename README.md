# ultrasonic.fyi

> Ultrasonic crypto payments. No QRs, no bluetooth.

[![WalletConnect Pay](https://img.shields.io/badge/WalletConnect-Pay-blue)](https://walletconnect.com/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-API-green)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## Overview

ultrasonic.fyi enables crypto payments through ultrasonic sound waves. A merchant POS broadcasts payment requests at frequencies humans can't hear (18-19kHz), and any nearby device with a microphone can receive them.

One merchant. Every customer in range. No pairing required.

## Why Ultrasonic?

| Method | Range | Pairing | Hardware |
|--------|-------|---------|----------|
| QR Code | Close (camera align) | No | Camera required |
| NFC | Touch only | No | NFC chip required |
| Bluetooth | ~10m (bleeds through walls) | Yes | BLE required |
| **Ultrasonic** | **30+ feet (contained to room)** | **No** | **Any speaker/mic** |

## Tech Stack

- **WalletConnect Pay** - Payment rails and merchant APIs
- **Web Audio API** - OscillatorNode for tone generation, AnalyserNode + FFT for frequency detection
- **FSK Encoding** - Frequency-shift keying at ultrasonic frequencies
  - 18.0kHz = Preamble/sync
  - 18.5kHz = Binary 0
  - 19.0kHz = Binary 1
- **iOS AVFoundation + Accelerate** - Native audio capture and vDSP FFT analysis

## Structure

```
pos-web/          # Web app (React + TypeScript)
├── /             # Merchant POS - emits payment requests
└── /customer     # Customer listener - receives and pays

ios-wallet/       # iOS app (Swift)
└── Listens for ultrasonic signals, opens WalletConnect Pay
```

## Future Directions

- **Multi-customer broadcast** - Split bills, group payments
- **Loyalty integration** - Proximity-based rewards at point of sale
- **Transit/ticketing** - Tap-free fare payment
- **Offline P2P** - Direct device-to-device transfers without internet
- **Hardware terminals** - Dedicated ultrasonic POS devices

## License

MIT

---

_Sound is the new QR code._
