// GET /api/customer/lookup/:code - Lookup customer by short code
interface Env {
  CUSTOMERS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = (context.params.code as string).toUpperCase();

  const data = await context.env.CUSTOMERS.get(code);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (data) {
    console.log(`[API] Customer found: ${code}`);
    return new Response(data, { headers });
  } else {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers,
    });
  }
};
