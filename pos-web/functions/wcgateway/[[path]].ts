// Proxy to WalletConnect Pay Gateway API (for getting payment options/merchant info)
interface Env {
  WC_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/wcgateway', '');

  // Gateway API is at .org, not .com
  const targetUrl = `https://api.pay.walletconnect.org${path}${url.search}`;

  // Clone the request with the new URL
  const headers = new Headers(context.request.headers);
  headers.delete('host');

  // Inject API key if not present
  if (!headers.has('Api-Key') && context.env.WC_API_KEY) {
    headers.set('Api-Key', context.env.WC_API_KEY);
  }

  console.log('Gateway proxy:', context.request.method, targetUrl);

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD'
      ? context.request.body
      : undefined,
  });

  // Clone response and add CORS headers
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Api-Key, Merchant-Id');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Api-Key',
    },
  });
};
