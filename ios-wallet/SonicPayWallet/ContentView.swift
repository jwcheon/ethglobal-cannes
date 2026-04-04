import SwiftUI

struct ContentView: View {
    @StateObject private var receiver = UltrasonicReceiver()
    @State private var walletState: WalletState = .idle
    @State private var showPaymentSheet = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [Color(hex: "0a0a0f"), Color(hex: "12121a")],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 32) {
                    // Header
                    headerView

                    Spacer()

                    // Main content based on state
                    mainContentView

                    Spacer()

                    // Listening toggle
                    listeningToggleView
                }
                .padding()
            }
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showPaymentSheet) {
            if case .paymentPending(let payload) = walletState {
                PaymentConfirmationView(
                    payload: payload,
                    onConfirm: { confirmPayment(payload) },
                    onCancel: { cancelPayment() }
                )
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .paymentRequestReceived)) { notification in
            if let payload = notification.object as? PaymentPayload {
                handlePaymentRequest(payload)
            }
        }
    }

    // MARK: - Header View
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("SonicPay")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(hex: "6366f1"), Color(hex: "a855f7")],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                Text("Wallet")
                    .font(.title2)
                    .foregroundColor(.gray)
            }

            Spacer()

            // Balance display
            VStack(alignment: .trailing, spacing: 4) {
                Text("$1,234.56")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                Text("USDC")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .padding()
            .background(Color(hex: "1a1a25"))
            .cornerRadius(12)
        }
    }

    // MARK: - Main Content View
    @ViewBuilder
    private var mainContentView: some View {
        switch walletState {
        case .idle:
            idleView
        case .listening:
            listeningView
        case .paymentPending:
            // Handled by sheet
            EmptyView()
        case .processing:
            processingView
        case .success(let txHash):
            successView(txHash: txHash)
        case .error(let message):
            errorView(message: message)
        }
    }

    // MARK: - Idle View
    private var idleView: some View {
        VStack(spacing: 24) {
            Image(systemName: "wave.3.right")
                .font(.system(size: 80))
                .foregroundColor(Color(hex: "6366f1").opacity(0.5))

            Text("Ready to Receive")
                .font(.title2)
                .fontWeight(.medium)
                .foregroundColor(.white)

            Text("Enable listening to detect\nnearby payment requests")
                .font(.body)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Listening View
    private var listeningView: some View {
        VStack(spacing: 24) {
            // Animated waves
            ZStack {
                ForEach(0..<3) { i in
                    Circle()
                        .stroke(Color(hex: "6366f1").opacity(0.3), lineWidth: 2)
                        .frame(width: 100 + CGFloat(i * 40), height: 100 + CGFloat(i * 40))
                        .scaleEffect(receiver.isListening ? 1.2 : 1.0)
                        .opacity(receiver.isListening ? 0.5 : 1.0)
                        .animation(
                            .easeInOut(duration: 1.5)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.3),
                            value: receiver.isListening
                        )
                }

                Image(systemName: "ear.and.waveform")
                    .font(.system(size: 50))
                    .foregroundColor(Color(hex: "6366f1"))
            }
            .frame(height: 200)

            Text("Listening...")
                .font(.title2)
                .fontWeight(.medium)
                .foregroundColor(.white)

            // Signal strength indicator
            HStack(spacing: 4) {
                ForEach(0..<5) { i in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(i < Int(receiver.signalStrength * 5) ? Color(hex: "22c55e") : Color.gray.opacity(0.3))
                        .frame(width: 8, height: 12 + CGFloat(i * 4))
                }
            }

            Text("Signal: \(Int(receiver.signalStrength * 100))%")
                .font(.caption)
                .foregroundColor(.gray)

            // Debug info (remove in production)
            if !receiver.debugInfo.isEmpty {
                Text(receiver.debugInfo)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.gray.opacity(0.6))
                    .padding(.top, 8)
            }
        }
    }

    // MARK: - Processing View
    private var processingView: some View {
        VStack(spacing: 24) {
            ProgressView()
                .scaleEffect(2)
                .tint(Color(hex: "6366f1"))

            Text("Processing Payment...")
                .font(.title2)
                .fontWeight(.medium)
                .foregroundColor(.white)
        }
    }

    // MARK: - Success View
    private func successView(txHash: String) -> some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(Color(hex: "22c55e"))

            Text("Payment Sent!")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(Color(hex: "22c55e"))

            Text("Tx: \(txHash.prefix(10))...")
                .font(.caption)
                .foregroundColor(.gray)

            Button("Done") {
                walletState = receiver.isListening ? .listening : .idle
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    // MARK: - Error View
    private func errorView(message: String) -> some View {
        VStack(spacing: 24) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(Color(hex: "ef4444"))

            Text("Payment Failed")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(Color(hex: "ef4444"))

            Text(message)
                .font(.body)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)

            Button("Try Again") {
                walletState = receiver.isListening ? .listening : .idle
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    // MARK: - Listening Toggle View
    private var listeningToggleView: some View {
        Button(action: toggleListening) {
            HStack(spacing: 12) {
                Image(systemName: receiver.isListening ? "stop.fill" : "play.fill")
                Text(receiver.isListening ? "Stop Listening" : "Start Listening")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                Group {
                    if receiver.isListening {
                        Color(hex: "ef4444")
                    } else {
                        LinearGradient(colors: [Color(hex: "6366f1"), Color(hex: "8b5cf6")], startPoint: .leading, endPoint: .trailing)
                    }
                }
            )
            .foregroundColor(.white)
            .cornerRadius(16)
        }
    }

    // MARK: - Actions
    private func toggleListening() {
        if receiver.isListening {
            receiver.stop()
            walletState = .idle
        } else {
            receiver.start()
            walletState = .listening
        }
    }

    private func handlePaymentRequest(_ payload: PaymentPayload) {
        guard !payload.isExpired else {
            print("Payment request expired")
            return
        }

        walletState = .paymentPending(payload)
        showPaymentSheet = true

        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }

    private func confirmPayment(_ payload: PaymentPayload) {
        showPaymentSheet = false

        // If we have a WalletConnect Pay gateway URL, open it
        if let gatewayUrlString = payload.gatewayUrl,
           let gatewayUrl = URL(string: gatewayUrlString) {
            print("Opening WC Pay gateway: \(gatewayUrlString)")
            UIApplication.shared.open(gatewayUrl) { success in
                if success {
                    // User will complete payment in browser/WC Pay
                    // Return to listening state
                    DispatchQueue.main.async {
                        self.receiver.reset()
                        self.walletState = self.receiver.isListening ? .listening : .idle
                    }
                } else {
                    // Failed to open URL
                    DispatchQueue.main.async {
                        self.walletState = .error(message: "Could not open payment URL")
                    }
                }
            }
            return
        }

        // Fallback: simulate payment (demo mode)
        walletState = .processing
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            walletState = .success(txHash: "0x\(UUID().uuidString.prefix(16))")

            // Return to listening after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                receiver.reset() // Reset for next payment
                if receiver.isListening {
                    walletState = .listening
                }
            }
        }
    }

    private func cancelPayment() {
        showPaymentSheet = false
        walletState = receiver.isListening ? .listening : .idle
    }
}

// MARK: - Payment Confirmation View
struct PaymentConfirmationView: View {
    let payload: PaymentPayload
    let onConfirm: () -> Void
    let onCancel: () -> Void

    @State private var ensProfile: ENSProfile?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "0a0a0f").ignoresSafeArea()

                VStack(spacing: 32) {
                    // Merchant info
                    VStack(spacing: 16) {
                        // Avatar placeholder
                        ZStack {
                            Circle()
                                .fill(Color(hex: "6366f1").opacity(0.2))
                                .frame(width: 80, height: 80)

                            Text(String(payload.merchant.prefix(2)).uppercased())
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(Color(hex: "6366f1"))
                        }

                        VStack(spacing: 4) {
                            Text(payload.merchant)
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)

                            if let paymentId = payload.paymentId {
                                Text("Payment: \(paymentId.prefix(16))...")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            } else if let profile = ensProfile {
                                Text(profile.description ?? "")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }

                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundColor(Color(hex: "22c55e"))
                                Text(payload.paymentId != nil ? "WalletConnect Pay" : "Verified ENS")
                                    .foregroundColor(Color(hex: "22c55e"))
                            }
                            .font(.caption)
                        }
                    }

                    // Amount
                    VStack(spacing: 8) {
                        Text(payload.formattedAmount)
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.white)

                        Text("on \(payload.chain.capitalized)")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }

                    Spacer()

                    // Action buttons
                    VStack(spacing: 12) {
                        Button(action: onConfirm) {
                            HStack {
                                Image(systemName: payload.gatewayUrl != nil ? "link" : "faceid")
                                Text(payload.gatewayUrl != nil ? "Pay with WalletConnect" : "Confirm with Face ID")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(colors: [Color(hex: "22c55e"), Color(hex: "16a34a")], startPoint: .leading, endPoint: .trailing)
                            )
                            .foregroundColor(.white)
                            .cornerRadius(16)
                            .fontWeight(.semibold)
                        }

                        Button(action: onCancel) {
                            Text("Cancel")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .foregroundColor(.gray)
                        }
                    }
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Payment Request")
                        .foregroundColor(.white)
                        .fontWeight(.semibold)
                }
            }
        }
        .onAppear {
            // Mock ENS resolution
            ensProfile = ENSProfile.mock(for: payload.merchant)
        }
    }
}

// MARK: - Custom Button Style
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(colors: [Color(hex: "6366f1"), Color(hex: "8b5cf6")], startPoint: .leading, endPoint: .trailing)
            )
            .foregroundColor(.white)
            .cornerRadius(16)
            .fontWeight(.semibold)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    ContentView()
}
