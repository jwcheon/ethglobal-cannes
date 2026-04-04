// WalletConnect Pay API integration
// Docs: https://docs.walletconnect.com/payments

// Use Vite proxy to avoid CORS (proxies /wcpay/* to api.pay.walletconnect.com/*)
const WC_API_URL = '/wcpay';
const WC_API_KEY = import.meta.env.VITE_WC_API_KEY || '';
const WC_MERCHANT_ID = import.meta.env.VITE_WC_MERCHANT_ID || '';

interface PaymentAmount {
  value: string;  // Amount in cents as STRING
  unit: string;   // "iso4217/USD"
}

interface CreatePaymentRequest {
  referenceId: string;
  amount: PaymentAmount;
}

interface CreatePaymentResponse {
  paymentId: string;
  gatewayUrl: string;
  expiresAt: string;
}

interface PaymentStatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentId: string;
  amount?: PaymentAmount;
}

// Generate a unique reference ID (only letters, digits, spaces, / - : . , + allowed)
function generateReferenceId(): string {
  return `sonic-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Create a new payment
export async function createPayment(amountCents: number): Promise<CreatePaymentResponse> {
  if (!WC_API_KEY) {
    throw new Error('WC Pay API key not configured (VITE_WC_API_KEY)');
  }
  if (!WC_MERCHANT_ID) {
    throw new Error('WC Pay Merchant ID not configured (VITE_WC_MERCHANT_ID)');
  }

  const request: CreatePaymentRequest = {
    referenceId: generateReferenceId(),
    amount: {
      value: String(amountCents),  // Must be string
      unit: 'iso4217/USD',
    },
  };

  console.log('Creating WC Pay payment:', request);
  console.log('Using API URL:', WC_API_URL);

  // Endpoint: POST /v1/payments (from OpenAPI spec)
  const response = await fetch(`${WC_API_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Api-Key': WC_API_KEY,
      'Merchant-Id': WC_MERCHANT_ID,
      'Content-Type': 'application/json',
      'Sdk-Name': 'sonicpay',
      'Sdk-Version': '1.0.0',
      'Sdk-Platform': 'web',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('WC Pay error:', response.status, errorText);
    throw new Error(`WC Pay API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('WC Pay payment created:', data);
  return data;
}

// Check payment status
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`${WC_API_URL}/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Api-Key': WC_API_KEY,
      'Merchant-Id': WC_MERCHANT_ID,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WC Pay API error: ${response.status}`);
  }

  return response.json();
}

// Cancel a payment
export async function cancelPayment(paymentId: string): Promise<void> {
  const response = await fetch(`${WC_API_URL}/v1/payments/${paymentId}/cancel`, {
    method: 'POST',
    headers: {
      'Api-Key': WC_API_KEY,
      'Merchant-Id': WC_MERCHANT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`WC Pay API error: ${response.status}`);
  }
}

// Poll for payment completion
export async function waitForPayment(
  paymentId: string,
  onStatusUpdate?: (status: string) => void,
  timeoutMs: number = 120000
): Promise<PaymentStatusResponse> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const status = await getPaymentStatus(paymentId);

    if (onStatusUpdate) {
      onStatusUpdate(status.status);
    }

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error(`Payment ${status.status}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Payment timeout');
}

// Extract payment ID from gateway URL
export function extractPaymentId(gatewayUrl: string): string {
  // URL format: https://pay.walletconnect.com/pay_abc123
  const match = gatewayUrl.match(/pay_[a-zA-Z0-9]+/);
  if (match) {
    return match[0];
  }
  // If it's already just the ID
  if (gatewayUrl.startsWith('pay_')) {
    return gatewayUrl;
  }
  throw new Error('Invalid gateway URL format');
}
