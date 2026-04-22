# SonicPay: Ultrasonic Crypto Payments with ENS Identity

> ETHGlobal Cannes 2026 - Targeting ENS + WalletConnect Pay prizes

## Executive Summary

**SonicPay** enables contactless crypto payments using ultrasonic sound waves combined with ENS for merchant identity. Customers walk up to a point-of-sale, their phone automatically hears the payment request (no pairing, no QR scan), resolves the merchant's ENS name, and completes payment via WalletConnect Pay.

---

## Prize Targets

### 1. ENS - Most Creative Use ($5,000 total)
> "Most people know ENS for name → address lookups. We want to see what else it can do."

**Our angle**: Dynamic address resolution via CCIP-Read custom resolver for privacy-preserving payments.

### 2. WalletConnect Pay ($4,000 total)
> "NFC or proximity-based flows that bring crypto payments into the physical world"

**Our angle**: Ultrasonic proximity detection - even more "magical" than NFC tap.

---

## The Problem

Current crypto payment flows:

| Method | Friction |
|--------|----------|
| QR Code | Pull out phone → Open app → Scan → Confirm |
| Copy/Paste address | Error-prone, bad UX |
| NFC | Requires NFC hardware on POS |
| WalletConnect QR | Multiple steps, needs camera |

**Apple Pay benchmark**: Tap → Done. One gesture.

---

## Our Solution: Ultrasonic + ENS + WalletConnect Pay

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ┌─────────────┐         ~19kHz sound         ┌─────────────────────┐  │
│   │             │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~▶│                     │  │
│   │   POS       │                              │   Customer Phone    │  │
│   │  (MacBook)  │   "bluebottle.eth:4.50:USDC" │   (iPhone)          │  │
│   │             │                              │                     │  │
│   └─────────────┘                              └──────────┬──────────┘  │
│                                                           │             │
│                                                           ▼             │
│                                               ┌───────────────────────┐ │
│                                               │ 1. Decode ultrasonic  │ │
│                                               │ 2. Resolve ENS name   │ │
│                                               │ 3. Show payment prompt│ │
│                                               │ 4. WalletConnect Pay  │ │
│                                               └───────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ENS Innovation: Beyond Simple Lookups

### Standard ENS Flow
```
bluebottle.eth → 0x1234...5678 (static address)
```

### Our Enhanced Flow (Future Iteration)

Using **CCIP-Read (EIP-3668)** custom resolver for dynamic address resolution:

```
bluebottle.eth
    → Custom Resolver (on-chain)
    → OffchainLookup error triggers CCIP-Read
    → Gateway generates fresh stealth address
    → Returns 0xABC...unique-per-transaction
```

**Benefits**:
- Merchant has stable identity (`bluebottle.eth`)
- Each payment goes to a different address (privacy)
- Auditors can verify via ENS, but can't link transactions

### Technical Implementation

```
┌─────────────────┐     resolve("bluebottle.eth")    ┌──────────────────┐
│   Wallet App    │ ──────────────────────────────▶  │  Custom Resolver │
└─────────────────┘                                  │    (on-chain)    │
        │                                            └────────┬─────────┘
        │                                                     │
        │  OffchainLookup error                              │
        │  (triggers CCIP-Read)                              ▼
        │                                            ┌──────────────────┐
        └──────────────────────────────────────────▶ │  Gateway Server  │
                                                     │                  │
                                                     │ - HD derivation  │
                                                     │ - Stealth addr   │
                                                     │ - Sign response  │
                                                     └──────────────────┘
```

**References**:
- [CCIP-Read Documentation](https://docs.ens.domains/resolvers/ccip-read/)
- [ENS Offchain Resolver](https://github.com/ensdomains/offchain-resolver)
- [EIP-1825 Discussion](https://github.com/ethereum/EIPs/issues/1825) (closed but informative)

### ENS Text Records for Merchant Metadata

```solidity
// Merchant can store rich metadata
bluebottle.eth:
  - address: 0x1234...
  - com.twitter: @bluebottle
  - description: "Premium coffee roaster"
  - url: https://bluebottle.com
  - avatar: ipfs://Qm...
  - payments.accepted: "USDC,USDT,ETH"
  - payments.chains: "base,arbitrum,polygon"
```

Customer wallet can display merchant info before confirming payment.

---

## Ultrasonic Technology Deep Dive

### How It Works

```
Data: "PAY:bluebottle.eth:4.50:USDC"
         │
         ▼
┌─────────────────┐
│ Encode to bits  │  → 01010000 01000001 01011001...
└────────┬────────┘
         ▼
┌─────────────────┐
│ FSK Modulation  │  → 0 = 18.5kHz, 1 = 19.5kHz
└────────┬────────┘
         ▼
┌─────────────────┐
│ Speaker Output  │  → Inaudible sound waves
└────────┬────────┘
         │
    ~~~~ AIR ~~~~
         │
         ▼
┌─────────────────┐
│ Microphone In   │  → Capture audio
└────────┬────────┘
         ▼
┌─────────────────┐
│ FFT Analysis    │  → Detect 18-20kHz frequencies
└────────┬────────┘
         ▼
┌─────────────────┐
│ Demodulate      │  → Recover original bits
└────────┬────────┘
         ▼
"PAY:bluebottle.eth:4.50:USDC"
```

### Frequency Selection

```
Human hearing:  20 Hz ──────────────────────────── 20,000 Hz
                                                        │
Our range:                                    18,000 ───┴─── 20,000 Hz
                                                  │
                                          Near-ultrasonic
                                          (inaudible to most adults)
```

### Comparison: Ultrasonic vs Bluetooth vs UWB vs NFC

| Aspect | Ultrasonic | Bluetooth LE | UWB | NFC |
|--------|------------|--------------|-----|-----|
| **Range** | 1-10m | 10-100m | 10-200m | 4cm |
| **Pairing** | None | Sometimes | Yes | None |
| **Hardware** | Universal | Universal | Limited | Limited |
| **Precision** | Room-level | ~3m | ~10cm | Touch |
| **Through walls** | No | Yes | Partial | No |
| **Data rate** | ~100 bps | ~1 Mbps | ~27 Mbps | 424 kbps |
| **Direction aware** | No | No | Yes | No |

### Security Considerations

| Threat | Risk | Mitigation |
|--------|------|------------|
| Eavesdropping | Medium | Encrypt payload, short-lived tokens |
| Replay attack | High | Nonce + timestamp + expiry |
| Injection | Medium | Merchant signature verification |
| Relay attack | Medium | User confirmation required |

**Secure Payload Structure**:
```json
{
  "merchant": "bluebottle.eth",
  "amount": "4.50",
  "currency": "USDC",
  "chain": "base",
  "nonce": "a1b2c3d4e5f6",
  "timestamp": 1712150400,
  "expiry": 60,
  "signature": "0x..."
}
```

### Cross-Platform Support

| Platform | Send | Receive | Library |
|----------|------|---------|---------|
| iOS (Native) | ✅ | ✅ | AVAudioEngine + FFT |
| Android | ✅ | ✅ | react-native-ultrasonic |
| Web (Chrome) | ✅ | ✅ | Quiet.js |
| Web (Safari) | ✅ | ❌ | Quiet.js (no mic access) |
| macOS | ✅ | ✅ | Quiet.js / native |

---

## User Scenario

### Happy Path

```
1. ALICE walks into Blue Bottle Coffee

2. She orders a latte ($4.50)

3. Barista taps "Charge $4.50" on POS (MacBook/iPad)
   └─▶ POS emits ultrasonic: "bluebottle.eth:4.50:USDC:nonce123:sig..."

4. Alice's iPhone (in her pocket) picks up the sound
   └─▶ Notification: "Pay $4.50 to Blue Bottle Coffee?"
   └─▶ Shows merchant avatar, verified ENS name

5. Alice confirms with Face ID
   └─▶ WalletConnect Pay sends 4.50 USDC on Base

6. Both devices show confirmation
   └─▶ Total time: ~3 seconds
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Multiple customers near POS | Each phone shows prompt, only payer confirms |
| Phone in pocket/bag | Sound passes through fabric (may need higher volume) |
| Noisy environment | Retry at higher volume, fallback to QR |
| Expired payload | Reject and request fresh ultrasonic |
| Wrong amount displayed | User declines, barista regenerates |

---

## Technical Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MERCHANT SIDE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    POS Web App (Next.js)                     │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│   │  │ Amount      │  │ Quiet.js    │  │ WalletConnect Pay   │  │   │
│   │  │ Input       │  │ Ultrasonic  │  │ Merchant SDK        │  │   │
│   │  │             │  │ Transmit    │  │                     │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER SIDE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  iOS Wallet App (Swift)                      │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│   │  │ AVAudio     │  │ ENS         │  │ WalletConnect Pay   │  │   │
│   │  │ Engine      │  │ Resolution  │  │ Wallet SDK          │  │   │
│   │  │ + FFT       │  │ (viem/ethers│  │                     │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Merchant│    │  POS    │    │  Air    │    │ iPhone  │    │ Block-  │
│ Input   │───▶│ Encode  │───▶│ (Sound) │───▶│ Decode  │───▶│ chain   │
│ $4.50   │    │ + Sign  │    │  ~~~~   │    │ + Pay   │    │ Confirm │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │                              │
                   │         WebSocket            │
                   └──────────────────────────────┘
                        (payment confirmation)
```

---

## MVP Scope (Hackathon)

### In Scope ✅
- [ ] POS web app on MacBook (Next.js + Quiet.js)
- [ ] iOS wallet app (Swift + AVAudioEngine)
- [ ] Ultrasonic transmission/reception
- [ ] ENS name resolution
- [ ] WalletConnect Pay integration
- [ ] Basic payment flow demo

### Out of Scope (Future) 🔮
- [ ] CCIP-Read custom resolver for stealth addresses
- [ ] Full merchant dashboard
- [ ] Transaction history
- [ ] Multi-chain support
- [ ] Android app
- [ ] Production security hardening

---

## Production Vision: Wallet SDK (Not a Website)

### Why SDK, Not Website?

A website requires internet to load. But the core value of ultrasonic payments is **offline detection**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WEBSITE vs SDK                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   WEBSITE APPROACH (Demo only)                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   Customer at coffee shop (no WiFi)                            │   │
│   │   📱 "Let me open sonicpay.app/wallet..."                      │   │
│   │      ↓                                                          │   │
│   │   🚫 "No internet connection"                                   │   │
│   │      ↓                                                          │   │
│   │   😞 Can't receive ultrasonic                                   │   │
│   │                                                                 │   │
│   │   ❌ DOESN'T WORK FOR REAL USE CASE                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   SDK APPROACH (Production)                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   Customer at coffee shop (no WiFi)                            │   │
│   │   📱 MetaMask/Rainbow already installed                        │   │
│   │      ↓                                                          │   │
│   │   👂 App has SonicPay SDK embedded                             │   │
│   │      ↓                                                          │   │
│   │   🔊 Detects ultrasonic from POS                               │   │
│   │      ↓                                                          │   │
│   │   💳 "Pay $4.50 to bluebottle.eth?"                            │   │
│   │      ↓                                                          │   │
│   │   ✅ User confirms → Transaction queued                        │   │
│   │      ↓                                                          │   │
│   │   📡 Submits when internet available                           │   │
│   │                                                                 │   │
│   │   ✅ WORKS OFFLINE (like LISNR)                                │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Product Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SONICPAY PRODUCT LAYERS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   LAYER 1: HACKATHON DEMO (Web App)                                     │
│   ├── sonicpay.app/pos - Merchant POS                                  │
│   ├── sonicpay.app/wallet - Customer wallet (needs internet to load)   │
│   ├── Proves the concept works                                         │
│   └── Audience can try on laptops (Chrome/Firefox)                     │
│                                                                         │
│   LAYER 2: HACKATHON DEMO (Native iOS)                                  │
│   ├── Swift app for iPhone                                             │
│   ├── Works offline for detection                                      │
│   ├── Shows "real world" potential                                     │
│   └── ~200 lines of code                                               │
│                                                                         │
│   LAYER 3: PRODUCTION (Wallet SDK)                                      │
│   ├── NPM: @sonicpay/wallet-sdk (React Native / Web)                   │
│   ├── Swift: SonicPaySDK (iOS native)                                  │
│   ├── Kotlin: SonicPaySDK (Android native)                             │
│   ├── Wallets integrate like any other SDK                             │
│   └── Customers never install "SonicPay" - it's inside their wallet    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### SDK Integration Example

**For React Native / Web Wallets:**
```typescript
// NPM package: @sonicpay/wallet-sdk
import { SonicPaySDK } from '@sonicpay/wallet-sdk';

const sonicPay = new SonicPaySDK({
  onPaymentRequest: (request) => {
    // Show payment UI to user
    showPaymentModal({
      merchant: request.merchant,      // "bluebottle.eth"
      amount: request.amount,          // "4.50"
      currency: request.currency,      // "USDC"
      chain: request.chain,            // "base"
    });
  },
  signTransaction: async (tx) => {
    // Use wallet's existing signing infrastructure
    return wallet.signTransaction(tx);
  },
  resolveENS: async (name) => {
    // Use wallet's existing ENS resolution
    return wallet.resolveENS(name);
  }
});

// Start listening (works offline!)
sonicPay.startListening();
```

**For Native iOS Wallets:**
```swift
// Swift package: SonicPaySDK
import SonicPaySDK

class WalletViewController: UIViewController {
    let sonicPay = SonicPayReceiver()

    override func viewDidLoad() {
        super.viewDidLoad()

        sonicPay.onPaymentRequest = { request in
            self.showPaymentSheet(
                merchant: request.merchant,
                amount: request.amount
            )
        }

        // Start listening (works offline!)
        sonicPay.startListening()
    }
}
```

### Offline Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OFFLINE TRANSACTION FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   STEP 1: Detection (OFFLINE ✅)                                        │
│   └── Phone mic picks up 19kHz signal                                  │
│   └── SDK decodes: "bluebottle.eth, 4.50, USDC, base, nonce123"        │
│                                                                         │
│   STEP 2: UI Prompt (OFFLINE ✅)                                        │
│   └── App shows: "Pay $4.50 to Blue Bottle Coffee?"                    │
│   └── Merchant ENS name displayed (cached or from payload)             │
│                                                                         │
│   STEP 3: User Confirmation (OFFLINE ✅)                                │
│   └── User taps "Pay" + Face ID                                        │
│   └── Transaction signed locally with private key                      │
│                                                                         │
│   STEP 4: Queue Transaction (OFFLINE ✅)                                │
│   └── Signed tx stored locally                                         │
│   └── App shows: "Payment queued, will submit when online"             │
│                                                                         │
│   STEP 5: Submit Transaction (NEEDS INTERNET)                          │
│   └── When internet available, submit to blockchain                    │
│   └── Or: POS has internet, receives signed tx via ultrasonic          │
│                                                                         │
│   STEP 6: Confirmation                                                  │
│   └── Both devices show confirmation                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Hackathon Demo Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HACKATHON DELIVERABLES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. WEB APP (for audience participation)                               │
│      └── sonicpay.app/pos - merchant                                   │
│      └── sonicpay.app/wallet - customer                                │
│      └── Share QR code: "Open this URL to try it!"                     │
│      └── Works on laptops (Chrome/Firefox/Edge)                        │
│                                                                         │
│   2. NATIVE iOS APP (for "real world" demo)                             │
│      └── Shows offline detection capability                            │
│      └── Demo with your own iPhone on stage                            │
│                                                                         │
│   3. SDK DOCUMENTATION (for the vision)                                 │
│      └── README showing how wallets would integrate                    │
│      └── "Here's what MetaMask would add to support SonicPay"          │
│                                                                         │
│   DEMO SCRIPT:                                                          │
│   "First, let me show the web version so you can all try it..."        │
│   [Audience opens URL on laptops, receives payment request]            │
│   "But for production, here's the native app working offline..."       │
│   [Demo with iPhone, no WiFi]                                          │
│   "And here's how any wallet can add this with our SDK..."             │
│   [Show SDK code snippets]                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Multi-Device Demo URLs

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    URL STRUCTURE                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   MERCHANT (POS):                                                       │
│   sonicpay.app/pos                                                      │
│   sonicpay.app/pos?merchant=bluebottle.eth                             │
│   localhost:3000/pos (dev)                                             │
│                                                                         │
│   CUSTOMER (Wallet):                                                    │
│   sonicpay.app/wallet                                                   │
│   localhost:3000/wallet (dev)                                          │
│                                                                         │
│   Browser support for /wallet:                                         │
│   ✅ Chrome (macOS, Windows, Linux, Android)                           │
│   ✅ Firefox (macOS, Windows, Linux, Android)                          │
│   ✅ Edge (Windows)                                                     │
│   ❌ Any iOS browser (WebKit limitation)                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Pitch to Judges

> "Today we're demoing SonicPay as a web app so you can all try it.
>
> But the real product is an SDK that wallet developers integrate.
>
> Just like LISNR powers Ticketmaster and McDonald's without customers knowing 'LISNR' exists...
>
> ...SonicPay would power MetaMask, Rainbow, and Coinbase Wallet without customers knowing 'SonicPay' exists.
>
> The ultrasonic detection happens offline in the wallet app. Only the final transaction submission needs internet.
>
> This is the missing piece for crypto payments to work like Apple Pay - ambient, instant, no scanning."

---

## Competitive Landscape & Market Research

### ETHGlobal Related Projects

**NFC-Based Payment Projects (Closest Competitors):**

| Project | Event | Similarity | Key Difference |
|---------|-------|------------|----------------|
| [Tap Ether](https://ethglobal.com/showcase/tap-ether-ote2h) | Brussels 2024 | Uses ENS + WalletConnect | NFC requires physical tap, not ultrasonic |
| [Tap Contacts](https://ethglobal.com/showcase/tap-contacts-s3ds7) | Brussels 2024 | WalletConnect + NFC payments | Phone-to-phone NFC tap |
| [NFC Wallet](https://ethglobal.com/showcase/nfc-wallet-xwuff) | Brussels 2024 | Tap-to-pay on Base | NFC tags, not sound |
| [Nominal](https://ethglobal.com/showcase) | NY 2025 | ENS subnames for payments | Payroll focus, not POS |
| [OmiSwap](https://m.theblockbeats.info/en/news/55433) | SF 2024 | Audio/voice interaction | Voice commands for swaps, not proximity |

### Existing Web3 Products

**[BlockBolt SoundBox](https://www.globenewswire.com/news-release/2026/01/21/3222393/0/en/BlockBolt-Brings-Contactless-Web3-Payments-to-Hedera-with-IoT-SoundBox.html)** (Hedera, Jan 2026)
- IoT device for merchants accepting HBAR/USDC
- Uses **audio confirmation** after QR payment (announces "Payment received!")
- **Not ultrasonic data transmission** - still relies on QR codes

### LISNR Deep Dive (Commercial Ultrasonic Leader)

**[LISNR](https://lisnr.com/)** - Enterprise ultrasonic SDK
- Backed by Visa, Intel, Synchrony Financial
- Deployed in 8 countries via Radius SDK
- **Not crypto-native** - focuses on traditional finance
- Has CBDC partnership with [SunCash/Bahamas](https://globalfintechseries.com/digital-wallet/sun-fintech-suncash-partners-with-lisnr-to-enable-cbdc-payments-within-its-digital-wallet/)
- Key clients: AT&T, Ticketmaster, Live Nation, Land Rover, Heineken

#### LISNR's B2B2C Business Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                     LISNR's Business Model                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   LISNR sells SDK to:           Customer uses:                         │
│   ┌─────────────────┐           ┌─────────────────┐                    │
│   │ McDonald's      │──embeds──▶│ McDonald's App  │ ◀── Customer has   │
│   │ Walmart         │──embeds──▶│ Walmart App     │     this already   │
│   │ Chase Bank      │──embeds──▶│ Chase App       │                    │
│   │ Starbucks       │──embeds──▶│ Starbucks App   │                    │
│   └─────────────────┘           └─────────────────┘                    │
│                                                                        │
│   Customer never installs "LISNR" - they use existing merchant/bank    │
│   apps that have Radius SDK embedded                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### LISNR Use Case #1: Ticketmaster/Live Nation (Biggest Deployment)

"Presence" system - **hundreds of millions of tickets** powered by LISNR.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TICKETMASTER "PRESENCE" SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PURCHASE                          ENTRY                               │
│   ┌─────────────────┐               ┌─────────────────┐                 │
│   │ Buy ticket      │               │ Walk up to      │                 │
│   │ online          │               │ venue gate      │                 │
│   └────────┬────────┘               └────────┬────────┘                 │
│            ▼                                 ▼                          │
│   ┌─────────────────┐               ┌─────────────────┐                 │
│   │ Unique          │               │ Phone emits     │                 │
│   │ "Smart Tone"    │               │ Smart Tone      │  18.75-19.2 kHz │
│   │ generated       │               │ (inaudible)     │                 │
│   └─────────────────┘               └────────┬────────┘                 │
│                                              ▼                          │
│                                     ┌─────────────────┐                 │
│                                     │ Gate mic        │                 │
│                                     │ validates       │                 │
│                                     │ → Gate opens    │                 │
│                                     └─────────────────┘                 │
│                                                                         │
│   Key: No WiFi/Bluetooth/NFC needed. Works in crowded stadiums.        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### LISNR Use Case #2: McDonald's Drive-Thru

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    McDONALD'S DRIVE-THRU FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. Customer in car has McDonald's app (with Radius SDK)               │
│   2. App emits ultrasonic tone with customer ID                         │
│   3. Drive-thru kiosk microphone picks it up                            │
│   4. Screen shows: "Welcome back, John!"                                │
│   5. Loyalty points auto-updated, payment linked                        │
│                                                                         │
│   Key insight: No yelling name/rewards number. No language barriers.   │
│   Customer identified before they even speak.                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### LISNR Use Case #3: Retail In-Store Zones

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RETAIL STORE ZONES                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   🔊 Entry Speaker              🔊 Electronics Dept Speaker             │
│   "Welcome! 20% off            "New iPhone deals this week"             │
│    today only"                                                          │
│                                                                         │
│   🔊 Grocery Aisle             🔊 Checkout Speaker                      │
│   "Buy 2 get 1 free            "Scan to pay with your wallet"           │
│    on cereals"                                                          │
│                                                                         │
│   Customer phone detects which zone they're in via ultrasonic           │
│   → Receives contextual offers. Attribution: know if ad → purchase.    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### LISNR Use Case #4: Offline Payments (with Crunchfish)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OFFLINE PAYMENT CAPABILITY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Problem: Rural areas, festivals, basements - no internet              │
│                                                                         │
│   Solution:                                                             │
│   • SDK works offline for up to 24 hours after last sync                │
│   • AES-256 encryption happens locally on device                        │
│   • Payment tokens validated without internet                           │
│   • Transactions queued and settled when back online                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### LISNR Use Case #5: Google Pay India (Audio QR)

Google Pay (formerly Tez) in India uses Audio QR for payments:
- Send money by bringing two phones close together
- No internet needed for the pairing
- Sound-based device discovery
- Works on any phone with speaker/mic (even feature phones)

#### How LISNR Handles Multiple People Nearby

**The Model: Broadcast + User Confirmation**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTIPLE PEOPLE NEARBY                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   POS broadcasts: "Pay $4.50 to merchant"                               │
│                                                                         │
│        🔊 ════════════════════════════════════════════                  │
│                      │                                                  │
│          ┌──────────┼──────────┬──────────┐                            │
│          ▼          ▼          ▼          ▼                            │
│       📱 Alice   📱 Bob    📱 Carol   📱 Dave                          │
│       (paying)   (nearby)  (nearby)   (no app)                         │
│                                                                         │
│       ┌────────┐ ┌────────┐ ┌────────┐                                 │
│       │Pay $4.5│ │Pay $4.5│ │Pay $4.5│  ALL see prompt                 │
│       │  [✓]   │ │  [✗]   │ │ ignore │                                 │
│       └────────┘ └────────┘ └────────┘                                 │
│           │                                                             │
│           ▼                                                             │
│       Alice confirms → Only Alice pays                                  │
│                                                                         │
│   KEY: User intent is the filter, not technical targeting.             │
│   Like a waiter saying "That'll be $47" - everyone hears,              │
│   only the payer responds.                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### LISNR Range Profiles

| Profile | Range | Use Case |
|---------|-------|----------|
| **Point 1000/2000** | Sub-1 meter | POS checkout, self-service kiosks |
| **Standard** | 1-3 meters | Drive-thru, curbside |
| **Extended** | 3-10 meters | Venue entry, retail zones |

#### Bi-Directional Handshake (Two-Way Communication)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BI-DIRECTIONAL PAYMENT FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Step 1: POS → ALL PHONES (broadcast)                                  │
│   ┌─────────┐         ~~~~~~~~~~~~         ┌─────────┐                  │
│   │   POS   │ ──────────────────────────▶  │ Phones  │                  │
│   │ Speaker │   "Pay $4.50, nonce: xyz"    │  (all)  │                  │
│   └─────────┘                              └─────────┘                  │
│                                                                         │
│   Step 2: User confirms on THEIR phone (Face ID / tap)                  │
│                                                                         │
│   Step 3: Alice's phone → POS (response on different channel)           │
│   ┌─────────┐         ~~~~~~~~~~~~         ┌─────────┐                  │
│   │ Alice's │ ──────────────────────────▶  │   POS   │                  │
│   │  Phone  │   "Payment token + sig"      │   Mic   │                  │
│   └─────────┘                              └─────────┘                  │
│                                                                         │
│   Step 4: POS confirms receipt back to Alice                            │
│                                                                         │
│   Multi-channel: 3 separate frequency channels for simultaneous         │
│   send/receive without interference                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Signal Strength Detection (Proximity Filtering)

LISNR Radius 3.0 provides **Tone Quality/Strength Indicators** for proximity detection.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SIGNAL STRENGTH = DISTANCE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Signal     🔊 POS                                                     │
│   Strength    │                                                         │
│   (dB)        │                                                         │
│               │                                                         │
│    -10 ──────┼── Alice (at counter, 0.5m) ──────────▶ PROCESS          │
│              │                                                          │
│    -25 ──────┼────── Bob (1m away) ─────────────────▶ PROCESS          │
│              │                                                          │
│    -40 ──────┼────────── Carol (2m) ────────────────▶ MAYBE            │
│              │                                                          │
│    -55 ──────┼──────────────── Dave (3m) ───────────▶ IGNORE           │
│              │                                                          │
│              └──────────────────────────────────────────▶ Distance      │
│                                                                         │
│   Ultrasonic attenuation: ~2-6 dB per meter (varies by humidity)       │
│                                                                         │
│   Implementation: Use Web Audio API AnalyserNode to measure             │
│   amplitude at 18-20kHz. Only process if above threshold.               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**For SonicPay**: We can implement signal strength detection using:
```javascript
// Web Audio API - measure amplitude at 18-20kHz
const analyser = audioContext.createAnalyser();
const frequencyData = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(frequencyData);

// Check amplitude in ultrasonic range
const signalStrength = getAverageAmplitude(frequencyData, 18000, 20000);
if (signalStrength > PROXIMITY_THRESHOLD) {
  processPaymentRequest(); // Strong signal = close proximity
}
```

#### ToneLock Security

> "ToneLock guarantees that only intended receivers can demodulate Radius Tone payloads."

Even if an attacker records the ultrasonic signal:
- Payload is encrypted (AES-256)
- Contains nonce + timestamp (expires in seconds)
- Requires authorized app to decode
- Response must come from authenticated device

#### Implication for SonicPay

| LISNR's Approach | SonicPay Equivalent |
|------------------|---------------------|
| SDK in McDonald's app | SDK in MetaMask, Rainbow, Coinbase Wallet |
| SDK in Chase app | SDK in any WalletConnect-compatible wallet |
| Customer has merchant app | Customer has crypto wallet |
| Ticketmaster Presence | SonicPay for crypto payments |

**The vision**: Wallets like MetaMask/Rainbow would integrate ultrasonic listening. Customer doesn't install "SonicPay" - their existing wallet gains this capability.

### Gap Analysis: SonicPay's Unique Position

| Feature | SonicPay | Tap Ether | BlockBolt | LISNR |
|---------|----------|-----------|-----------|-------|
| Ultrasonic data | Yes | No (NFC) | No (QR) | Yes |
| ENS identity | Yes | Yes | No | No |
| WalletConnect Pay | Yes | Yes | No | No |
| No pairing needed | Yes | No | Yes | Yes |
| Works in pocket | Yes | No | No | Yes |
| Crypto-native | Yes | Yes | Yes | No |

**Verdict**: No direct ETHGlobal finalist or existing web3 product combines ultrasonic + ENS + WalletConnect Pay. SonicPay's unique angle is "LISNR-style UX meets crypto-native ENS identity."

---

## iOS Browser Limitation (Critical for Architecture)

### All iOS Browsers Use WebKit

Apple requires all iOS browsers to use Safari's WebKit engine:

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Chrome iOS  ───┐                                          │
│   Firefox iOS ───┼──▶  All use WebKit  ──▶  Same limitations│
│   Edge iOS    ───┤     (Safari engine)                      │
│   Brave iOS   ───┘                                          │
│                                                             │
│   They're just different UIs on top of Safari               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       Android                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Chrome Android ──▶  Chromium/Blink  ──▶  Full Web Audio   │
│   Firefox Android ─▶  Gecko engine    ──▶  Full Web Audio   │
│                                                             │
│   Actual different browser engines with full APIs           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Ultrasonic Reception by Platform (Updated)

| Platform | Browser | Mic for Ultrasonic | Notes |
|----------|---------|-------------------|-------|
| iOS | Safari | Limited | No background mic, Web Audio restricted |
| iOS | Chrome | Limited | It's WebKit underneath |
| iOS | Firefox | Limited | It's WebKit underneath |
| Android | Chrome | Works | Full Web Audio API |
| Android | Firefox | Works | Full Web Audio API |
| macOS/Windows | Chrome | Works | Full Web Audio API |

### Hackathon Demo Options

| Approach | Effort | Demo Quality | Judges Impression |
|----------|--------|--------------|-------------------|
| Browser-only (Chrome Android) | Low | Good | "Why not iPhone?" |
| Browser POS + Native iOS wallet | Medium | Excellent | "This is real" |
| Two laptops | Lowest | Okay | "It's a demo" |

**Recommendation**: For iPhone support, native app (Swift) is required. A minimal Swift app for ultrasonic listening + payment prompt is ~200 lines of code.

---

## Resources & References

### ENS
- [ENS Documentation](https://docs.ens.domains/)
- [CCIP-Read / Offchain Resolvers](https://docs.ens.domains/resolvers/ccip-read/)
- [ENSIP-5: Text Records](https://docs.ens.domains/ensip/5/)
- [ENS Offchain Resolver GitHub](https://github.com/ensdomains/offchain-resolver)

### WalletConnect Pay
- [WalletConnect Pay Overview](https://docs.walletconnect.com/payments/overview)
- [Wallet SDK](https://docs.walletconnect.com/payments/wallets/overview)
- [Merchant SDK](https://docs.walletconnect.com/payments/merchant/onboarding)
- [Example: PassKey Wallet](https://github.com/rtomas/pay-wallet)

### Ultrasonic
- [Quiet.js - Web Audio Data Transmission](https://github.com/quiet/quiet-js)
- [react-native-ultrasonic](https://github.com/aboozaid/react-native-ultrasonic)
- [AudioUI - Swift Ultrasonic](https://github.com/tothepoweroftom/AudioUI)
- [LISNR - Commercial Ultrasonic](https://lisnr.com/)

### Previous Art
- [ENSpin - ETHGlobal Taipei 2025](https://ethglobal.com/) - IPFS pinning via ENS
- [ING UWB Payment Pilot](https://www.finextra.com/newsarticle/40625/ing-pilots-ultra-wideband-tech-for-p2p-contactless-payments)

---

## Team Notes

- **Primary Demo**: MacBook (POS) → iPhone (Customer Wallet)
- **Backup Demo**: QR code fallback if ultrasonic fails
- **Test Environment**: WalletConnect Pay test POS at https://pos-demo.walletconnect.com/
- **Get test USDC**: Fill form at https://forms.gle/JpVxaYtYv3PMivC99

---

## Quick Start Guide

### Project Structure

```
ethglobal-cannes/
├── RESEARCH.md          # This file - project documentation
├── pos-web/             # POS Web App (MacBook)
│   ├── src/
│   │   ├── App.tsx      # Main POS component
│   │   ├── App.css      # Styling
│   │   └── main.tsx     # Entry point
│   ├── public/quiet/    # Quiet.js ultrasonic library
│   └── package.json
└── ios-wallet/          # iOS Wallet App (iPhone)
    └── SonicPayWallet/
        ├── SonicPayWalletApp.swift    # App entry point
        ├── ContentView.swift          # Main UI
        ├── UltrasonicReceiver.swift   # Audio processing
        ├── Models.swift               # Data models
        └── Info.plist                 # Permissions
```

### Running the POS (MacBook)

```bash
cd pos-web
npm install
npm run dev
# Open http://localhost:3000
```

### Running the iOS Wallet

1. Open Xcode
2. Create new iOS App project named "SonicPayWallet"
3. Copy Swift files from `ios-wallet/SonicPayWallet/` into project
4. Add microphone permission to Info.plist
5. Build and run on iPhone

### Demo Flow

1. **POS**: Enter amount (e.g., 4.50) → Click "Charge"
2. **iPhone**: App detects ultrasonic signal → Shows payment prompt
3. **iPhone**: Confirm with Face ID → Payment sent
4. **POS**: Shows "Payment Received"

---

*Last updated: April 3, 2026*
