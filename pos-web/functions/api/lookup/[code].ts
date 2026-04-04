// GET /api/lookup/:code - Lookup payment by short code
interface Env {
  PAYMENTS: KVNamespace;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = (context.params.code as string).toUpperCase();

  const data = await context.env.PAYMENTS.get(code);

  if (data) {
    console.log(`[API] Lookup found: ${code}`);
    return new Response(data, { headers: corsHeaders });
  } else {
    console.log(`[API] Lookup not found: ${code}`);
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  }
};
