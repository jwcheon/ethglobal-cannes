# ultrasonic.fyi iOS Wallet

iOS wallet app that listens for ultrasonic payment requests.

## Setup Instructions

### 1. Open Project

1. Open `SonicPayWallet.xcodeproj` in Xcode
2. Select your development team in Signing & Capabilities

### 2. Microphone Permission

The project includes microphone permission in Info.plist:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>ultrasonic.fyi needs microphone access to detect ultrasonic payment requests.</string>
```

### 3. Build and Run

1. Connect your iPhone
2. Select your device as the build target
3. Build and run (Cmd+R)

## Files

- `SonicPayWalletApp.swift` - App entry point
- `ContentView.swift` - Main UI with wallet state management
- `UltrasonicReceiver.swift` - Custom FSK audio processing
- `Models.swift` - Data models (PaymentPayload, WalletState, etc.)

## How It Works

1. **Start Listening**: User taps "Start Listening" to begin monitoring for ultrasonic signals
2. **FSK Decoding**: Audio input is processed using FFT (Accelerate/vDSP) to detect frequencies:
   - 18.0kHz = Preamble/sync
   - 18.5kHz = Binary 0
   - 19.0kHz = Binary 1
3. **Payment Lookup**: Decoded short code is looked up on server to get full payment details
4. **WalletConnect Pay**: Opens WalletConnect Pay gateway for payment completion

## Technical Details

- **Sample Rate**: 48kHz
- **FFT Size**: 2048 samples
- **Frequency Range**: 18-19kHz ultrasonic
- **Bit Duration**: 300ms per bit (200ms tone + 100ms gap)
- **Data Format**: 2-character short code

## Requirements

- iOS 16.0+
- iPhone with microphone access
- Xcode 15.0+
