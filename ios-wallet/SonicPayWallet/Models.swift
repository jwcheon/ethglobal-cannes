import Foundation

/// Payment payload received via ultrasonic signal
struct PaymentPayload: Codable, Identifiable {
    var id: String { nonce }

    let merchant: String
    let amount: String
    let nonce: String
    let timestamp: Int
    let paymentId: String?      // WalletConnect Pay payment ID
    let gatewayUrl: String?     // WalletConnect Pay gateway URL

    var formattedAmount: String {
        "$\(amount)"
    }

    var isExpired: Bool {
        let expiryTime = TimeInterval(timestamp + 120) // 2 minute expiry
        return Date().timeIntervalSince1970 > expiryTime
    }
}

/// Wallet state
enum WalletState {
    case idle
    case listening
    case paymentPending(PaymentPayload)
    case processing
    case success(txHash: String)
    case error(message: String)
}

