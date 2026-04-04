import Foundation
import AVFoundation
import Accelerate
import UIKit

/// Receives and decodes ultrasonic FSK audio signals
class UltrasonicReceiver: ObservableObject {

    // MARK: - Published Properties
    @Published var isListening = false
    @Published var lastReceivedPayload: PaymentPayload?
    @Published var signalStrength: Float = 0
    @Published var debugInfo: String = ""

    // MARK: - Audio Properties
    private var audioEngine: AVAudioEngine?
    private let sampleRate: Double = 48000
    private let bufferSize: AVAudioFrameCount = 2048

    // FSK Frequencies - MUST match transmitter exactly
    private let FREQ_PREAMBLE: Float = 18000
    private let FREQ_ZERO: Float = 18500
    private let FREQ_ONE: Float = 19000
    private let FREQ_TOLERANCE: Float = 200  // +/- Hz tolerance (reduced to avoid overlap)

    // FFT setup
    private let fftLog2n: vDSP_Length = 11 // 2^11 = 2048
    private lazy var fftN: Int = 1 << Int(fftLog2n)
    private var fftSetup: FFTSetup?

    // Decoding state
    private var decodingState: DecodingState = .waitingForPreamble
    private var receivedBits: [Character] = []
    private var preambleCount = 0
    private var hasTriggeredPayment = false

    // Time-based bit detection (simpler and more reliable)
    private var rxStartTime: Date = Date()
    private var currentBitSamples: [Float] = []  // Frequencies detected in current bit window
    private var silenceCount = 0
    private var waitingForFirstDataBit = true  // Sync flag
    private var currentBitIndex = 0  // Which bit we're currently receiving
    private let BIT_WINDOW_MS: Double = 300  // Total time per bit (250ms tone + 50ms gap)
    private let SAMPLE_WINDOW_MS: Double = 250  // Only sample during the tone portion

    private enum DecodingState {
        case waitingForPreamble
        case receivingData
    }

    // MARK: - Initialization
    init() {
        fftSetup = vDSP_create_fftsetup(fftLog2n, FFTRadix(kFFTRadix2))
    }

    deinit {
        stop()
        if let fftSetup = fftSetup {
            vDSP_destroy_fftsetup(fftSetup)
        }
    }

    // MARK: - Audio Session Configuration
    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .mixWithOthers])
        try session.setPreferredSampleRate(sampleRate)
        try session.setPreferredIOBufferDuration(Double(bufferSize) / sampleRate)
        try session.setActive(true)
    }

    // MARK: - Start/Stop Listening
    func start() {
        guard !isListening else { return }

        do {
            try configureAudioSession()

            audioEngine = AVAudioEngine()
            guard let audioEngine = audioEngine else { return }

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)

            print("UltrasonicReceiver: Sample rate = \(recordingFormat.sampleRate)")

            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: recordingFormat) { [weak self] buffer, _ in
                self?.processAudioBuffer(buffer)
            }

            try audioEngine.start()

            DispatchQueue.main.async {
                self.isListening = true
                self.hasTriggeredPayment = false
                self.resetDecoder()
            }

            print("UltrasonicReceiver: Started listening")

        } catch {
            print("UltrasonicReceiver: Failed to start - \(error)")
            DispatchQueue.main.async {
                self.debugInfo = "Error: \(error.localizedDescription)"
            }
        }
    }

    func stop() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil

        DispatchQueue.main.async {
            self.isListening = false
            self.signalStrength = 0
            self.resetDecoder()
        }

        print("UltrasonicReceiver: Stopped listening")
    }

    func reset() {
        hasTriggeredPayment = false
        resetDecoder()
        lastReceivedPayload = nil
    }

    private func resetDecoder() {
        decodingState = .waitingForPreamble
        receivedBits = []
        preambleCount = 0
        rxStartTime = Date()
        currentBitSamples = []
        silenceCount = 0
        waitingForFirstDataBit = true
        currentBitIndex = 0
    }

    // MARK: - Audio Processing
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }
        let frameCount = Int(buffer.frameLength)

        let samples = Array(UnsafeBufferPointer(start: channelData, count: frameCount))

        // Analyze frequencies
        let (dominantFreq, energy) = analyzeSpectrum(samples)

        // Update signal strength
        DispatchQueue.main.async {
            self.signalStrength = min(energy * 50, 1.0)
        }

        // Need minimum energy to process
        guard energy > 0.0003 else {
            silenceCount += 1
            // After extended silence (10+ frames = ~400ms), process what we have
            if decodingState == .receivingData && silenceCount > 10 && receivedBits.count >= 16 {
                // Trim to nearest multiple of 8 bits
                let validBits = (receivedBits.count / 8) * 8
                receivedBits = Array(receivedBits.prefix(validBits))
                print("Silence detected, trimmed to \(receivedBits.count) bits")
                processReceivedData()
            }
            return
        }
        silenceCount = 0

        // Identify which frequency we're detecting
        let isPreamble = isFrequency(dominantFreq, target: FREQ_PREAMBLE)
        let isZero = isFrequency(dominantFreq, target: FREQ_ZERO)
        let isOne = isFrequency(dominantFreq, target: FREQ_ONE)

        let match = isPreamble ? "P" : (isZero ? "0" : (isOne ? "1" : "-"))

        DispatchQueue.main.async {
            self.debugInfo = String(format: "%.0fHz [%@] %@ bits:%d",
                                    dominantFreq, match,
                                    self.decodingState == .waitingForPreamble ? "WAIT" : "RX",
                                    self.receivedBits.count)
        }

        // FSK decoding state machine
        switch decodingState {
        case .waitingForPreamble:
            if isPreamble {
                preambleCount += 1
                // Require 8+ preambles to start (transmitter sends 10)
                if preambleCount >= 8 {
                    print("Preamble detected (\(preambleCount))! Waiting for first data bit...")
                    decodingState = .receivingData
                    receivedBits = []
                    currentBitSamples = []
                    rxStartTime = Date()
                    preambleCount = 0
                    silenceCount = 0
                    currentBitIndex = 0
                    waitingForFirstDataBit = true  // Wait for first data bit to sync timing
                }
            } else {
                preambleCount = max(0, preambleCount - 1)
            }

        case .receivingData:
            // Time-based detection: fixed windows for each bit

            let isDataFreq = isFrequency(dominantFreq, target: FREQ_ZERO) || isFrequency(dominantFreq, target: FREQ_ONE)
            let isPreambleFreq = isFrequency(dominantFreq, target: FREQ_PREAMBLE)

            // Sync timing on first data bit
            if waitingForFirstDataBit {
                if isDataFreq {
                    print("First data bit detected, starting timed reception...")
                    rxStartTime = Date()
                    currentBitSamples = [dominantFreq]
                    currentBitIndex = 0
                    waitingForFirstDataBit = false
                }
                return
            }

            // Calculate which bit window we're in based on elapsed time
            let elapsedMs = Date().timeIntervalSince(rxStartTime) * 1000
            let expectedBitIndex = Int(elapsedMs / BIT_WINDOW_MS)
            let timeInCurrentBit = elapsedMs.truncatingRemainder(dividingBy: BIT_WINDOW_MS)

            // Debug output
            print("t:\(Int(elapsedMs))ms bit:\(expectedBitIndex) phase:\(Int(timeInCurrentBit))ms F:\(Int(dominantFreq)) samples:\(currentBitSamples.count)")

            // Check if we've moved to a new bit window
            if expectedBitIndex > currentBitIndex {
                // Record the previous bit(s)
                while currentBitIndex < expectedBitIndex && currentBitSamples.count > 0 {
                    let avgFreq = currentBitSamples.reduce(0, +) / Float(currentBitSamples.count)
                    let bit: Character = isFrequency(avgFreq, target: FREQ_ONE) ? "1" : "0"
                    receivedBits.append(bit)
                    print("Bit[\(currentBitIndex)]: \(bit) (avg: \(Int(avgFreq))Hz, samples: \(currentBitSamples.count), total: \(receivedBits.count))")
                    currentBitIndex += 1
                    currentBitSamples = []
                }
                currentBitIndex = expectedBitIndex
            }

            // Check for end marker (preamble frequency after receiving data)
            if isPreambleFreq && receivedBits.count >= 8 {
                preambleCount += 1
                if preambleCount >= 3 {
                    // Finalize any pending bit
                    if currentBitSamples.count > 0 {
                        let avgFreq = currentBitSamples.reduce(0, +) / Float(currentBitSamples.count)
                        let bit: Character = isFrequency(avgFreq, target: FREQ_ONE) ? "1" : "0"
                        receivedBits.append(bit)
                        print("Final bit: \(bit) (avg: \(Int(avgFreq))Hz)")
                    }
                    let validBits = (receivedBits.count / 8) * 8
                    receivedBits = Array(receivedBits.prefix(validBits))
                    print("End marker detected, processing \(receivedBits.count) bits")
                    processReceivedData()
                    return
                }
            } else {
                preambleCount = 0
            }

            // Only sample during the "tone" portion of the bit window (first 150ms)
            if timeInCurrentBit < SAMPLE_WINDOW_MS && isDataFreq {
                currentBitSamples.append(dominantFreq)
            }
        }
    }

    private func isFrequency(_ freq: Float, target: Float) -> Bool {
        return abs(freq - target) < FREQ_TOLERANCE
    }

    // MARK: - Spectrum Analysis
    private func analyzeSpectrum(_ samples: [Float]) -> (dominantFreq: Float, energy: Float) {
        guard let fftSetup = fftSetup, samples.count >= fftN else {
            return (0, 0)
        }

        var inputSamples = Array(samples.prefix(fftN))

        // Apply Hanning window
        var window = [Float](repeating: 0, count: fftN)
        vDSP_hann_window(&window, vDSP_Length(fftN), Int32(vDSP_HANN_NORM))
        vDSP_vmul(inputSamples, 1, window, 1, &inputSamples, 1, vDSP_Length(fftN))

        // Prepare for FFT
        var realp = [Float](repeating: 0, count: fftN / 2)
        var imagp = [Float](repeating: 0, count: fftN / 2)

        inputSamples.withUnsafeBufferPointer { inputPtr in
            realp.withUnsafeMutableBufferPointer { realpPtr in
                imagp.withUnsafeMutableBufferPointer { imagpPtr in
                    var splitComplex = DSPSplitComplex(realp: realpPtr.baseAddress!, imagp: imagpPtr.baseAddress!)

                    inputPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftN / 2) { complexPtr in
                        vDSP_ctoz(complexPtr, 2, &splitComplex, 1, vDSP_Length(fftN / 2))
                    }

                    vDSP_fft_zrip(fftSetup, &splitComplex, 1, fftLog2n, FFTDirection(kFFTDirection_Forward))
                }
            }
        }

        // Calculate magnitudes
        var magnitudes = [Float](repeating: 0, count: fftN / 2)
        realp.withUnsafeMutableBufferPointer { realpPtr in
            imagp.withUnsafeMutableBufferPointer { imagpPtr in
                var splitComplex = DSPSplitComplex(realp: realpPtr.baseAddress!, imagp: imagpPtr.baseAddress!)
                vDSP_zvmags(&splitComplex, 1, &magnitudes, 1, vDSP_Length(fftN / 2))
            }
        }

        let freqResolution = Float(sampleRate) / Float(fftN)

        // Focus on our frequency range (17.5-19.5 kHz)
        let lowBin = max(0, Int(17500 / freqResolution))
        let highBin = min(fftN / 2 - 1, Int(19500 / freqResolution))

        guard highBin > lowBin else { return (0, 0) }

        // Find peak in range
        let rangeMags = Array(magnitudes[lowBin...highBin])
        var peakValue: Float = 0
        var peakIndex: vDSP_Length = 0
        vDSP_maxvi(rangeMags, 1, &peakValue, &peakIndex, vDSP_Length(rangeMags.count))

        let peakFrequency = Float(lowBin + Int(peakIndex)) * freqResolution

        // Calculate energy
        var energy: Float = 0
        vDSP_meanv(rangeMags, 1, &energy, vDSP_Length(rangeMags.count))

        return (peakFrequency, energy)
    }

    // MARK: - POS Server Configuration
    // Option 1: Local network (same WiFi) - use your Mac's IP
    // Option 2: Cloudflare tunnel - run `npm run tunnel` in pos-web, paste URL here
    //
    // To get tunnel URL:
    //   cd pos-web && npm run dev    (in terminal 1)
    //   cd pos-web && npm run tunnel (in terminal 2)
    //   Copy the https://xxx.trycloudflare.com URL
    //
    private let posServerURL = "https://hood-cart-del-gifts.trycloudflare.com"

    // MARK: - Data Processing
    private func processReceivedData() {
        guard receivedBits.count >= 8 else {
            print("Not enough bits: \(receivedBits.count)")
            resetDecoder()
            return
        }

        let binaryString = String(receivedBits)
        print("Received binary: \(binaryString) (\(binaryString.count) bits)")

        // Convert binary to string - expecting 4-char short code
        if let shortCode = binaryToString(binaryString) {
            print("Decoded short code: \(shortCode)")

            // Look up payment from POS server
            lookupPayment(shortCode: shortCode.uppercased())
        } else {
            print("Failed to decode binary data")
        }

        resetDecoder()
    }

    // MARK: - Payment Lookup
    private func lookupPayment(shortCode: String) {
        guard let url = URL(string: "\(posServerURL)/api/lookup/\(shortCode)") else {
            print("Invalid lookup URL")
            return
        }

        print("Looking up payment: \(url)")

        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let error = error {
                print("Lookup error: \(error)")
                return
            }

            guard let data = data else {
                print("No data received")
                return
            }

            do {
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                guard let paymentId = json?["paymentId"] as? String,
                      let gatewayUrl = json?["gatewayUrl"] as? String,
                      let amount = json?["amount"] as? String else {
                    print("Invalid payment data: \(String(data: data, encoding: .utf8) ?? "nil")")
                    return
                }

                let merchant = json?["merchant"] as? String ?? "Merchant"
                print("Payment found: \(paymentId), amount: $\(amount), merchant: \(merchant)")

                // Reset flag to allow this payment
                self?.hasTriggeredPayment = false
                self?.triggerPayment(amount: amount, merchant: merchant, paymentId: paymentId, gatewayUrl: gatewayUrl)

            } catch {
                print("JSON parse error: \(error)")
            }
        }.resume()
    }

    private func binaryToString(_ binary: String) -> String? {
        var result = ""
        var index = binary.startIndex

        while index < binary.endIndex {
            let endIndex = binary.index(index, offsetBy: 8, limitedBy: binary.endIndex) ?? binary.endIndex
            let byte = String(binary[index..<endIndex])

            if byte.count == 8, let charCode = UInt8(byte, radix: 2) {
                result.append(Character(UnicodeScalar(charCode)))
            }
            index = endIndex
        }

        return result.isEmpty ? nil : result
    }

    // MARK: - Payment Trigger
    private func triggerPayment(amount: String, merchant: String, paymentId: String? = nil, gatewayUrl: String? = nil) {
        guard !hasTriggeredPayment else { return }
        hasTriggeredPayment = true

        print("Payment detected! Amount: \(amount), PaymentId: \(paymentId ?? "none")")

        let payload = PaymentPayload(
            merchant: merchant,
            amount: amount,
            nonce: String(UUID().uuidString.prefix(8)).lowercased(),
            timestamp: Int(Date().timeIntervalSince1970),
            paymentId: paymentId,
            gatewayUrl: gatewayUrl
        )

        DispatchQueue.main.async {
            self.lastReceivedPayload = payload

            // Haptic feedback
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

            // Post notification
            NotificationCenter.default.post(
                name: .paymentRequestReceived,
                object: payload
            )
        }
    }
}

// MARK: - Notification Extension
extension Notification.Name {
    static let paymentRequestReceived = Notification.Name("paymentRequestReceived")
}
