# SonicPay: Crypto Payments via Sound Waves

> **ETHGlobal Cannes 2026** | Targeting ENS ($5k) + WalletConnect Pay ($4k)

---

## One-Liner

**Pay with crypto using sound waves — no internet required on your phone.**

---

## The Problem

| Current Crypto Payments | Friction |
|------------------------|----------|
| QR Code | Pull out phone → Open camera → Scan → Confirm → Wait |
| WalletConnect | Scan QR → Approve connection → Approve tx → Wait |
| Copy/paste address | Error-prone, terrible UX |
| NFC | Requires special hardware, iOS restrictions |

**Apple Pay benchmark**: Hold phone near terminal → Done. Sub-2 seconds.

**Crypto can't compete on UX** — until now.

---

## Our Solution: SonicPay

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│    ┌─────────┐      ~19kHz sound      ┌─────────────────────┐     │
│    │   POS   │  ~~~~~~~~~~~~~~~~~~~▶  │   Customer Phone    │     │
│    │ Terminal│                        │   (even offline!)   │     │
│    └─────────┘                        └─────────────────────┘     │
│                                                                    │
│    "bluebottle.eth wants $4.50"       [Sign] → [Transmit back]    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. Merchant POS emits ultrasonic payment request (~19kHz, inaudible)
2. Customer's phone **automatically detects** it (no scanning, no pairing)
3. Customer sees: "Pay $4.50 to Blue Bottle Coffee (bluebottle.eth)?"
4. One tap to confirm → Payment complete

**Total time: ~3 seconds. Zero camera. Zero QR codes. Zero NFC hardware.**

---

## The Killer Feature: Offline Payments

> **"What if the customer has no internet?"**

### SonicPay works in airplane mode.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OFFLINE USER FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   MERCHANT (online)              CUSTOMER (offline)                 │
│                                                                     │
│   1. Emit payment request ──────▶ 2. Receive via sound             │
│      (includes nonce, gas)           (no internet needed)          │
│                                                                     │
│                                   3. Sign tx locally                │
│                                      (private key on device)        │
│                                                                     │
│   5. Receive signed tx ◀────────── 4. Transmit signed tx           │
│      via microphone                   via ultrasonic                │
│                                                                     │
│   6. Broadcast to blockchain                                        │
│      (merchant has internet)                                        │
│                                                                     │
│   7. Confirm payment ───────────▶ 8. Show confirmation             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this works:**
- Signing a transaction = pure cryptography (no internet needed)
- A signed transaction is just ~300 bytes of data
- Anyone can broadcast a valid signed transaction
- Sound waves carry the signed tx from customer → merchant

**Use cases:**
- Festival/concert with overloaded cell towers
- Developing regions with spotty connectivity
- Subway stations, airplanes, basements
- Privacy-conscious users who keep phones offline

---

## Technical Innovation

### 1. Ultrasonic Data Transmission

| Technology | How We Use It |
|------------|---------------|
| **Frequency** | 18-20 kHz (inaudible to most humans) |
| **Library** | Quiet.js (web), AVAudioEngine + FFT (iOS) |
| **Data rate** | ~100-500 bps (enough for payment data) |
| **Range** | 1-5 meters (perfect for POS scenarios) |

**Advantages over Bluetooth/NFC:**
- No pairing required
- Works through pockets/bags
- Naturally bounded by walls (won't trigger from next room)
- Universal — every device has speakers and microphones

### 2. ENS Integration (Creative Use)

| Feature | Implementation |
|---------|----------------|
| **Merchant Identity** | `bluebottle.eth` instead of `0x742d35...` |
| **Trust Display** | Show ENS avatar, description from text records |
| **Verified Badge** | Customer sees "✓ Verified ENS" before paying |
| **Future: CCIP-Read** | Dynamic address resolution for privacy |

**Why this matters:** Customers trust paying "bluebottle.eth" more than a random hex address.

### 3. WalletConnect Pay Integration

- Handles actual USDC/USDT transfers
- Multi-chain support (Base, Arbitrum, Polygon)
- Merchant settlement and off-ramp
- Battle-tested infrastructure

---

## Competitive Landscape

| Solution | Ultrasonic | ENS Identity | Works Offline | No Hardware |
|----------|------------|--------------|---------------|-------------|
| **SonicPay** | ✅ | ✅ | ✅ | ✅ |
| Apple Pay | ❌ NFC | ❌ | ❌ | ❌ |
| Tap Ether | ❌ NFC | ✅ | ❌ | ❌ |
| QR Payments | ❌ | ❌ | ❌ | ✅ |
| LISNR | ✅ | ❌ | ❌ | ✅ |

**LISNR** (backed by Visa, Intel) proves ultrasonic payments work at scale — but they're not crypto-native. We bring the same UX to web3.

---

## Demo Flow

### Setup
- **MacBook**: POS web app (localhost:3000)
- **iPhone**: SonicPay wallet app

### Script

1. **Merchant** enters $4.50 on POS, taps "Charge"
2. **POS** emits ultrasonic signal (animated waves on screen)
3. **Customer's iPhone** (in pocket) vibrates, shows notification
4. **Customer** sees: "Pay $4.50 to Blue Bottle Coffee?"
   - Shows ENS name, verified badge, merchant avatar
5. **Customer** taps "Confirm with Face ID"
6. **Both screens** show "Payment Complete!"

**Offline Demo** (if time permits):
1. Put iPhone in airplane mode
2. Repeat flow — still works!
3. Show that merchant broadcasts the signed tx

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MERCHANT SIDE                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              POS Web App (React + Vite)                      │    │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────────────────┐  │    │
│  │  │ Quiet.js  │  │ ENS       │  │ WalletConnect Pay       │  │    │
│  │  │ Ultrasonic│  │ Resolution│  │ Merchant SDK            │  │    │
│  │  └───────────┘  └───────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER SIDE                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              iOS Wallet App (Swift + SwiftUI)                │    │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────────────────┐  │    │
│  │  │ AVAudio   │  │ ENS       │  │ WalletConnect Pay       │  │    │
│  │  │ FFT       │  │ Verified  │  │ Wallet SDK              │  │    │
│  │  └───────────┘  └───────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why We Win

### ENS Prize: "Most Creative Use"

> "Store verifiable credentials or zk proofs in text records. Build privacy features. Use subnames as access tokens. **Surprise us!**"

**Our angle:**
- ENS as **merchant identity layer** for physical payments
- Future: CCIP-Read resolver for **rotating stealth addresses** (privacy)
- Text records store merchant metadata (description, logo, accepted tokens)

### WalletConnect Pay Prize: "Proximity-Based Flows"

> "NFC or proximity-based flows that bring crypto payments into the physical world. **Beat Apple Pay.**"

**Our angle:**
- Ultrasonic is **more magical than NFC** — no tap required
- Works with **any device** — no special hardware
- **Offline capability** — Apple Pay can't do this

---

## Future Vision

### Phase 1: Hackathon MVP ✅
- POS → Customer ultrasonic payment request
- ENS merchant identity display
- WalletConnect Pay integration

### Phase 2: Bidirectional Communication
- Customer → POS signed transaction relay
- Full offline payment support

### Phase 3: Wallet SDK
- Integrate into MetaMask, Rainbow, Coinbase Wallet
- "Enable SonicPay" toggle in settings
- Background listening for payments

### Phase 4: Enterprise
- Partner with POS providers (Square, Toast, Clover)
- White-label SDK for merchants
- LISNR-style B2B2C model

---

## The Ask

**For Judges:**
- Try the demo — feel the magic of paying via sound
- Consider the offline angle — this is genuinely novel
- ENS + WalletConnect Pay + Ultrasonic = unique combination

**For Partners:**
- Wallet teams: Integrate our SDK
- POS providers: Let's pilot this
- ENS team: Explore CCIP-Read for merchant identity

---

## Team

[Add team info]

---

## Links

- **Demo**: [Live at booth]
- **GitHub**: [repo link]
- **Video**: [demo video link]

---

*"The best payment is the one you don't notice. SonicPay makes crypto invisible."*
