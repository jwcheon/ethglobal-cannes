// POST /api/store - Store payment mapping
interface Env {
  PAYMENTS: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as {
      shortCode: string;
      paymentId: string;
      gatewayUrl: string;
      amount: string;
      merchant: string;
    };

    const { shortCode, paymentId, gatewayUrl, amount, merchant } = body;

    // Store in KV with 10 minute expiration
    await context.env.PAYMENTS.put(
      shortCode,
      JSON.stringify({ paymentId, gatewayUrl, amount, merchant, createdAt: Date.now() }),
      { expirationTtl: 600 }
    );

    console.log(`[API] Stored: ${shortCode} → ${paymentId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
