// POST /api/customer/store - Store customer identity mapping
interface Env {
  CUSTOMERS: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as {
      shortCode: string;
      name: string;
    };

    const { shortCode, name } = body;

    // Store in KV with 30 minute expiration
    await context.env.CUSTOMERS.put(
      shortCode,
      JSON.stringify({ name, createdAt: Date.now() }),
      { expirationTtl: 1800 }
    );

    console.log(`[API] Customer stored: ${shortCode} → ${name}`);

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
