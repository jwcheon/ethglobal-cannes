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
  status: 'requires_action' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  paymentId: string;
  amount?: PaymentAmount;
  info?: {
    txId?: string;
    optionAmount?: {
      value: string;
      display?: {
        assetSymbol?: string;
        decimals?: number;
        networkName?: string;
      };
    };
  };
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

  // Endpoint: POST /v1/payments
  const response = await fetch(`${WC_API_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Api-Key': WC_API_KEY,
      'Merchant-Id': WC_MERCHANT_ID,
      'Content-Type': 'application/json',
      'Sdk-Name': 'ultrasonicfyi',
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

    if (status.status === 'succeeded') {
      return status;
    }

    if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'expired') {
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

// Gateway API for getting payment options and merchant info
const WC_GATEWAY_URL = '/wcgateway';

interface PaymentOptionsResponse {
  options: Array<{
    id: string;
    amount: {
      value: string;
      unit: string;
    };
  }>;
  info?: {
    merchant: {
      name: string;
    };
    amount: {
      value: string;
      display?: {
        assetSymbol?: string;
      };
    };
    expiresAt?: string;
  };
}

// Get payment options and merchant info from Gateway API
export async function getPaymentInfo(paymentId: string): Promise<PaymentOptionsResponse> {
  // Use a dummy account to get payment info
  const dummyAccount = 'eip155:8453:0x0000000000000000000000000000000000000000';

  console.log('Fetching payment info from Gateway API for:', paymentId);

  const response = await fetch(`${WC_GATEWAY_URL}/v1/gateway/payment/${paymentId}/options`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accounts: [dummyAccount],
      includePaymentInfo: true,
    }),
  });

  const responseText = await response.text();
  console.log('Gateway API response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Gateway API error: ${response.status} - ${responseText}`);
  }

  const data = JSON.parse(responseText);
  console.log('Gateway API parsed data:', data);
  console.log('Merchant info:', data.info);

  return data;
}

// Get just the merchant name
export async function getMerchantName(paymentId: string): Promise<string | null> {
  try {
    const info = await getPaymentInfo(paymentId);
    return info.info?.merchant?.name || null;
  } catch (err) {
    console.error('Failed to get merchant name:', err);
    return null;
  }
}
