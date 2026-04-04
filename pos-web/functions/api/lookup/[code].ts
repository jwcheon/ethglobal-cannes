// GET /api/lookup/:code - Lookup payment by short code
interface Env {
  PAYMENTS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = (context.params.code as string).toUpperCase();

  const data = await context.env.PAYMENTS.get(code);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (data) {
    console.log(`[API] Lookup found: ${code}`);
    return new Response(data, { headers });
  } else {
    console.log(`[API] Lookup not found: ${code}`);
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers,
    });
  }
};
