// POST /api/customer/store - Store customer identity mapping
interface Env {
  CUSTOMERS: KVNamespace;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as {
      shortCode: string;
      name: string;
    };

    const { shortCode, name } = body;

    // Store in KV with 30 minute expiration
    await context.env.CUSTOMERS.put(
      shortCode.toUpperCase(),
      JSON.stringify({ name, createdAt: Date.now() }),
      { expirationTtl: 1800 }
    );

    console.log(`[API] Customer stored: ${shortCode} → ${name}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: corsHeaders,
    });
  }
};
