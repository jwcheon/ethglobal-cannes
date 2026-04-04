import Foundation

/// Payment payload received via ultrasonic signal
struct PaymentPayload: Codable, Identifiable {
    var id: String { nonce }

    let merchant: String
    let amount: String
    let currency: String
    let chain: String
    let nonce: String
    let timestamp: Int

    var formattedAmount: String {
        "$\(amount) \(currency)"
    }

    var isExpired: Bool {
        let expiryTime = TimeInterval(timestamp + 60) // 60 second expiry
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

/// Mock ENS resolution result
struct ENSProfile {
    let name: String
    let address: String
    let avatar: String?
    let description: String?

    static func mock(for name: String) -> ENSProfile {
        ENSProfile(
            name: name,
            address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8B55D",
            avatar: nil,
            description: "Premium coffee roaster"
        )
    }
}
