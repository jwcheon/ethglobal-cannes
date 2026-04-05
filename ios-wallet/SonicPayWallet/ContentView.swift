import SwiftUI

struct ContentView: View {
    @StateObject private var receiver = UltrasonicReceiver()
    @State private var walletState: WalletState = .idle
    @State private var showPaymentSheet = false
    @State private var customerName: String = ""
    @State private var isEmittingName: Bool = false
    @State private var isEmittingOffline: Bool = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Background - solid zinc
                Color(hex: "09090b")
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
        // Customer broadcasting disabled for now
        // .onAppear {
        //     if !customerName.isEmpty {
        //         receiver.startBackgroundBroadcasting(name: customerName)
        //     }
        // }
    }

    // MARK: - Header View
    private var headerView: some View {
        HStack {
            Text("🔊 supersonic.fyi")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.white)

            Spacer()

            // Status indicator
            HStack(spacing: 6) {
                Circle()
                    .fill(receiver.isListening ? Color(hex: "10b981") : Color(hex: "52525b"))
                    .frame(width: 8, height: 8)
                Text(receiver.isListening ? "Listening" : "Ready")
                    .font(.caption)
                    .foregroundColor(Color(hex: "71717a"))
            }
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
                .foregroundColor(Color(hex: "3b82f6").opacity(0.5))

            Text("Ready to Receive")
                .font(.title2)
                .fontWeight(.medium)
                .foregroundColor(.white)

            Text("Tap to listen for\npayment requests")
                .font(.body)
                .foregroundColor(Color(hex: "71717a"))
                .multilineTextAlignment(.center)

            // Name emission disabled - phone speakers don't emit ultrasonic well
            // Use web version (/customer) for name emission instead
            /*
            // Name input and emit button
            VStack(spacing: 12) {
                TextField("Your name", text: $customerName)
                    .padding(14)
                    .background(Color(hex: "18181b"))
                    .cornerRadius(10)
                    .foregroundColor(.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color(hex: "27272a"), lineWidth: 1)
                    )
                    .frame(maxWidth: 240)
                    .autocapitalization(.words)

                Button(action: emitName) {
                    HStack(spacing: 8) {
                        if isEmittingName {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "person.wave.2")
                        }
                        Text(isEmittingName ? "Emitting..." : "Emit My Name")
                    }
                    .frame(maxWidth: 240)
                    .padding(.vertical, 12)
                    .background(
                        customerName.isEmpty || isEmittingName || isEmittingOffline
                            ? Color(hex: "27272a")
                            : Color(hex: "10b981")
                    )
                    .foregroundColor(customerName.isEmpty || isEmittingName ? Color(hex: "52525b") : .white)
                    .cornerRadius(10)
                    .fontWeight(.medium)
                }
                .disabled(customerName.isEmpty || isEmittingName || isEmittingOffline)

                Button(action: emitNameOffline) {
                    HStack(spacing: 8) {
                        if isEmittingOffline {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Color(hex: "71717a")))
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "wifi.slash")
                        }
                        Text(isEmittingOffline ? "Emitting..." : "Offline Mode")
                    }
                    .frame(maxWidth: 240)
                    .padding(.vertical, 12)
                    .background(Color.clear)
                    .foregroundColor(customerName.isEmpty || isEmittingOffline ? Color(hex: "52525b") : Color(hex: "71717a"))
                    .cornerRadius(10)
                    .fontWeight(.medium)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(style: StrokeStyle(lineWidth: 1, dash: [5]))
                            .foregroundColor(Color(hex: "3f3f46"))
                    )
                }
                .disabled(customerName.isEmpty || isEmittingOffline || isEmittingName)
            }
            .padding(.top, 16)
            */
        }
    }

    // MARK: - Listening View
    private var listeningView: some View {
        VStack(spacing: 24) {
            // Animated waves
            ZStack {
                ForEach(0..<3) { i in
                    Circle()
                        .stroke(Color(hex: "3b82f6").opacity(0.3), lineWidth: 2)
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

                Image(systemName: receiver.isReceivingData ? "arrow.down.circle.fill" : "ear.and.waveform")
                    .font(.system(size: 50))
                    .foregroundColor(receiver.isReceivingData ? Color(hex: "10b981") : Color(hex: "3b82f6"))
            }
            .frame(height: 200)

            Text(receiver.isReceivingData ? "Receiving Payment..." : "Listening...")
                .font(.title2)
                .fontWeight(.medium)
                .foregroundColor(.white)

            // Progress bar when receiving data
            if receiver.isReceivingData {
                VStack(spacing: 8) {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color(hex: "27272a"))
                                .frame(height: 8)

                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color(hex: "3b82f6"))
                                .frame(width: geometry.size.width * CGFloat(min(Double(receiver.bitsReceived) / 16.0, 1.0)), height: 8)
                        }
                    }
                    .frame(height: 8)
                    .frame(maxWidth: 250)

                    Text("\(receiver.bitsReceived) / 16 bits (\(Int(Double(receiver.bitsReceived) / 16.0 * 100))%)")
                        .font(.caption)
                        .foregroundColor(Color(hex: "71717a"))
                }
                .padding(.vertical, 8)
            }

            // Signal strength indicator
            HStack(spacing: 4) {
                ForEach(0..<5) { i in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(i < Int(receiver.signalStrength * 5) ? Color(hex: "10b981") : Color(hex: "27272a"))
                        .frame(width: 8, height: 12 + CGFloat(i * 4))
                }
            }

            Text("Signal: \(Int(receiver.signalStrength * 100))%")
                .font(.caption)
                .foregroundColor(Color(hex: "71717a"))

            // Debug info (remove in production)
            if !receiver.debugInfo.isEmpty {
                Text(receiver.debugInfo)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(Color(hex: "52525b"))
                    .padding(.top, 8)
            }
        }
    }

    // MARK: - Processing View
    private var processingView: some View {
        VStack(spacing: 24) {
            ProgressView()
                .scaleEffect(2)
                .tint(Color(hex: "3b82f6"))

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
                .foregroundColor(Color(hex: "10b981"))

            Text("Payment Sent!")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(Color(hex: "10b981"))

            Text("Tx: \(txHash.prefix(10))...")
                .font(.caption)
                .foregroundColor(Color(hex: "71717a"))

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
                .foregroundColor(Color(hex: "71717a"))
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
            .background(receiver.isListening ? Color(hex: "ef4444") : Color(hex: "3b82f6"))
            .foregroundColor(.white)
            .cornerRadius(12)
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

    private func emitName() {
        guard !customerName.isEmpty else { return }
        isEmittingName = true

        // Emit name once via receiver
        Task {
            await receiver.emitNameOnce(name: customerName)
            await MainActor.run {
                isEmittingName = false
            }
        }
    }

    private func emitNameOffline() {
        guard !customerName.isEmpty else { return }
        isEmittingOffline = true

        // Emit full name offline (no API)
        Task {
            await receiver.emitNameOffline(name: customerName)
            await MainActor.run {
                isEmittingOffline = false
            }
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

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "09090b").ignoresSafeArea()

                VStack(spacing: 32) {
                    // Merchant info
                    VStack(spacing: 16) {
                        // Avatar placeholder
                        ZStack {
                            Circle()
                                .fill(Color(hex: "3b82f6").opacity(0.2))
                                .frame(width: 80, height: 80)

                            Text(String(payload.merchant.prefix(2)).uppercased())
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(Color(hex: "3b82f6"))
                        }

                        VStack(spacing: 4) {
                            Text(payload.merchant)
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)

                            if let paymentId = payload.paymentId {
                                Text("ID: \(paymentId.prefix(20))...")
                                    .font(.caption)
                                    .foregroundColor(Color(hex: "71717a"))
                            }

                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundColor(Color(hex: "10b981"))
                                Text("WalletConnect Pay")
                                    .foregroundColor(Color(hex: "10b981"))
                            }
                            .font(.caption)
                        }
                    }

                    // Amount
                    VStack(spacing: 8) {
                        Text(payload.formattedAmount)
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.white)

                        Text("via WalletConnect Pay")
                            .font(.subheadline)
                            .foregroundColor(Color(hex: "71717a"))
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
                            .background(Color(hex: "10b981"))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .fontWeight(.semibold)
                        }

                        Button(action: onCancel) {
                            Text("Cancel")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .foregroundColor(Color(hex: "71717a"))
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
    }
}

// MARK: - Custom Button Style
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color(hex: "3b82f6"))
            .foregroundColor(.white)
            .cornerRadius(12)
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
