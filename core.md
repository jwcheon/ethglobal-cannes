# SonicPay: Core Flow

> Ultrasonic crypto payments powered by WalletConnect Pay

## The Idea

Replace QR code scanning with ultrasonic sound. Customer walks up, phone hears the payment request, confirms with Face ID, done.

```
┌─────────────┐      ~19kHz sound       ┌─────────────┐
│   POS       │  ~~~~~~~~~~~~~~~~~~~~▶  │   Wallet    │
│  (MacBook)  │       "AB3K"            │  (iPhone)   │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       │ Store: AB3K → pay_abc123              │ Lookup: AB3K → ?
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│ POS Server  │◀────── HTTP GET ────────│   iPhone    │
│ /api/lookup │                         │             │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       │ Return: {paymentId, gatewayUrl}       │
       └───────────────────────────────────────┤
                                               ▼
                                        ┌─────────────┐
                                        │ WalletConnect│
                                        │ Pay Gateway │
                                        └─────────────┘
```

---

## Core Flow (Short Code Lookup)

```
MERCHANT (POS)                              CUSTOMER (WALLET)
─────────────────────────────────────────────────────────────────────

1. Enter amount: $4.50
        │
        ▼
2. POST /wcpay/v1/payments
   { referenceId: "sonic-xxx", amount: { value: "450", unit: "iso4217/USD" } }
        │
        ▼
3. Receive { paymentId: "pay_abc123...", gatewayUrl: "..." }
        │
        ▼
4. Generate short code "AB3K" (4 chars)
   Store mapping: AB3K → { paymentId, gatewayUrl, amount }
        │
        ▼
5. Broadcast "AB3K" via ultrasonic (~19kHz FSK)
   Only 4 chars × 8 bits = 32 bits (~7 seconds!)
        │
        └─────────────── 🔊 ──────────────────┐
                                              │
                                              ▼
                                    6. Receive ultrasonic
                                       Decode "AB3K"
                                              │
                                              ▼
                                    7. HTTP GET /api/lookup/AB3K
                                       → { paymentId, gatewayUrl, amount }
                                              │
                                              ▼
                                    8. Display: "Pay $4.50?"
                                       Show payment confirmation UI
                                              │
                                              ▼
                                    9. User confirms (Face ID)
                                       Open WC Pay gateway URL
                                              │
                                              ▼
                                   10. Payment executed via WC Pay
                                              │
        ┌─────────────────────────────────────┘
        │
        ▼
11. Receive confirmation via polling
    Display "Payment Received ✓"
```

---

## What We Build vs What WalletConnect Provides

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WE BUILD                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  POS Web App (Merchant)                                             │
│  ├── Amount input UI                                                │
│  ├── REST call to WalletConnect Pay API (create payment)            │
│  ├── Short code generation + in-memory mapping                      │
│  ├── Custom FSK ultrasonic transmission (Web Audio API)             │
│  ├── HTTP API for short code lookup (/api/lookup/:code)             │
│  └── Payment confirmation display                                   │
│                                                                     │
│  Wallet App (Customer - iOS)                                        │
│  ├── Ultrasonic reception (AVAudioEngine + FFT)                     │
│  ├── FSK decoding with time-based bit detection                     │
│  ├── HTTP call to POS for short code lookup                         │
│  ├── Open WalletConnect Pay gateway URL                             │
│  └── Payment confirmation UI                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    WALLETCONNECT PAY PROVIDES                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ├── Payment creation API (merchant side)                           │
│  ├── Payment options (which tokens/chains customer can pay with)    │
│  ├── Transaction building                                           │
│  ├── Gas abstraction                                                │
│  ├── Token swaps (pay with any token)                               │
│  └── Settlement to merchant                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Ultrasonic Protocol

### Frequency Allocation

```
Human hearing:  20 Hz ─────────────────────────────── 20,000 Hz
                                                           │
Our signal:                                     18,000 ────┴──── 19,000 Hz
                                                     (inaudible to most adults)

FREQ_PREAMBLE = 18,000 Hz   (start/end marker)
FREQ_ZERO     = 18,500 Hz   (binary 0)
FREQ_ONE      = 19,000 Hz   (binary 1)
TOLERANCE     = ±200 Hz
```

### Modulation: FSK (Frequency-Shift Keying)

```
Transmission structure:

┌──────────────┬────────────┬──────────────┬──────────────┐
│  Preamble    │   Silence  │  Data Bits   │  End Marker  │
│  10 × 18kHz  │   100ms    │  FSK encoded │  5 × 18kHz   │
└──────────────┴────────────┴──────────────┴──────────────┘

Each data bit:
├── 100ms tone (18.5kHz for 0, 19kHz for 1)
└── 100ms silence (gap for bit boundary detection)
= 200ms per bit total
```

### Timing (Short Code = FAST!)

```
Payload: "AB3K" = 4 characters = 32 bits

Transmission time:
├── Pre-silence:   500ms
├── Preamble:      10 × 200ms = 2.0s
├── Post-preamble: 100ms
├── Data bits:     32 × 200ms = 6.4s
├── End marker:    5 × 200ms  = 1.0s
└── Total:         ~10 seconds

vs. old method (38-char paymentId = 304 bits = 60+ seconds!)
```

### Reception (iOS)

```
Sample rate:     48,000 Hz
Buffer size:     2,048 samples (~42ms per buffer)
FFT size:        2,048 (11-bit)
Detection:       Time-based windows (200ms per bit, sample first 100ms)
```

---

## Technical Stack

### POS (Merchant) - Web App

```
Location:     pos-web/
Framework:    Vite + React + TypeScript
Ultrasonic:   Custom FSK via Web Audio API (OscillatorNode)
WC Pay:       REST API calls via Vite proxy
API Server:   Vite middleware (in-memory store for short codes)

Files:
├── src/App.tsx              # POS UI + ultrasonic transmission + short code
├── src/lib/walletconnect.ts # WC Pay API integration
├── vite.config.ts           # Proxy + /api/store + /api/lookup endpoints
├── .env                     # API keys
└── package.json
```

### Wallet - iOS App

```
Location:     ios-wallet/SonicPayWallet/
Language:     Swift + SwiftUI
Ultrasonic:   AVAudioEngine + vDSP FFT
WC Pay:       Opens gateway URL in browser

Files:
├── SonicPayWalletApp.swift    # App entry
├── ContentView.swift          # Wallet UI + WC Pay gateway open
├── UltrasonicReceiver.swift   # Audio processing + FSK decoding + lookup
├── Models.swift               # PaymentPayload model
└── Info.plist                 # Microphone permission
```

---

## Setup & Configuration

### POS (Merchant)

```bash
cd pos-web
npm install
npm run dev          # Start dev server on port 3000
```

`.env` file:
```env
VITE_WC_API_KEY=wcp_xxxxx
VITE_WC_MERCHANT_ID=your_merchant_id
```

### Cloudflare Tunnel (Recommended for iOS Testing)

Using a tunnel avoids local network/IP issues. In a second terminal:

```bash
cd pos-web
npm run tunnel
```

This outputs something like:
```
Your quick Tunnel has been created! Visit it at:
https://random-words-here.trycloudflare.com
```

Copy that URL for the iOS app.

### Wallet (iOS)

1. Open `ios-wallet/SonicPayWallet.xcodeproj` in Xcode
2. Update POS server URL in `UltrasonicReceiver.swift`:
   ```swift
   // Paste your cloudflare tunnel URL here:
   private let posServerURL = "https://random-words-here.trycloudflare.com"
   ```
3. Build and run on device (simulator won't have mic access)

**Alternative: Local Network (same WiFi)**
```bash
# Find your Mac's IP
ipconfig getifaddr en0
# Use: http://YOUR_IP:3000
```

---

## Project Structure

```
ethglobal-cannes/
├── core.md              # This file - core architecture
├── .gitignore           # Ignores node_modules, DerivedData, etc.
│
├── pos-web/             # Merchant POS (Vite + React)
│   ├── src/
│   │   ├── App.tsx              # POS UI + ultrasonic TX + short codes
│   │   ├── lib/walletconnect.ts # WC Pay API
│   │   └── App.css
│   ├── vite.config.ts           # Server + API endpoints
│   ├── .env                     # Credentials
│   └── package.json
│
└── ios-wallet/          # Customer Wallet (Swift)
    └── SonicPayWallet/
        ├── SonicPayWalletApp.swift
        ├── ContentView.swift         # Wallet UI + WC Pay open
        ├── UltrasonicReceiver.swift  # FSK reception + short code lookup
        ├── Models.swift
        └── Info.plist
```

---

## API Endpoints (POS Server)

### POST /api/store
Store short code → payment mapping
```json
{
  "shortCode": "AB3K",
  "paymentId": "pay_abc123...",
  "gatewayUrl": "https://pay.walletconnect.com/pay_abc123",
  "amount": "4.50"
}
```

### GET /api/lookup/{shortCode}
Lookup payment by short code
```json
{
  "paymentId": "pay_abc123...",
  "gatewayUrl": "https://pay.walletconnect.com/pay_abc123",
  "amount": "4.50",
  "createdAt": 1712345678000
}
```

---

## Bounty Target

### WalletConnect Pay - $4,000

> "Tap-to-Pay — Design a seamless tap-to-pay experience using WalletConnect Pay. If Apple Pay is the gold standard, beat it with crypto."

**Our angle**: Ultrasonic IS proximity-based tap-to-pay. Better than QR because:
- No camera needed
- Works from pocket (phone just needs to hear it)
- No special hardware on POS (any speaker works)
- Hands-free for customer

---

## Implementation Status

### Done
- [x] POS: Amount input UI
- [x] POS: Ultrasonic FSK transmission (custom Web Audio)
- [x] POS: WC Pay API integration (create payment)
- [x] POS: Short code generation + storage
- [x] POS: Lookup API endpoint
- [x] Wallet (iOS): Ultrasonic reception (AVAudioEngine + FFT)
- [x] Wallet (iOS): FSK decoding with time-based detection
- [x] Wallet (iOS): Short code lookup via HTTP
- [x] Wallet (iOS): Open WC Pay gateway URL
- [x] End-to-end flow connected

### TODO
- [ ] Test full flow end-to-end
- [ ] Handle network errors gracefully
- [ ] Payment status confirmation on POS

### Nice to Have
- [ ] Error correction (checksums)
- [ ] Payment success webhook on POS
- [ ] Better UX animations
- [ ] Retry transmission on failure

---

*Last updated: April 4, 2026*
