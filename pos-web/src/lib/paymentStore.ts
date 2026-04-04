// In-memory store for short code → paymentId mapping
// For hackathon demo only - not production ready

interface PaymentMapping {
  paymentId: string;
  gatewayUrl: string;
  amount: string;
  createdAt: number;
}

const store = new Map<string, PaymentMapping>();

// Generate a short alphanumeric code
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Store a payment mapping
export function storePayment(shortCode: string, payment: PaymentMapping): void {
  store.set(shortCode, payment);
  console.log(`Stored payment: ${shortCode} → ${payment.paymentId}`);

  // Auto-expire after 10 minutes
  setTimeout(() => {
    store.delete(shortCode);
    console.log(`Expired payment: ${shortCode}`);
  }, 10 * 60 * 1000);
}

// Look up a payment by short code
export function lookupPayment(shortCode: string): PaymentMapping | undefined {
  return store.get(shortCode);
}

// Get all active payments (for debugging)
export function getAllPayments(): Record<string, PaymentMapping> {
  const result: Record<string, PaymentMapping> = {};
  store.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
