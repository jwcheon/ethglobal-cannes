// GET /api/customer/lookup/:code - Lookup customer by short code
interface Env {
  CUSTOMERS: KVNamespace;
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

  const data = await context.env.CUSTOMERS.get(code);

  if (data) {
    console.log(`[API] Customer found: ${code}`);
    return new Response(data, { headers: corsHeaders });
  } else {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  }
};
