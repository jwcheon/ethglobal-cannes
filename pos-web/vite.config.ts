import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In-memory payment store (for API endpoints)
const paymentStore = new Map<string, { paymentId: string; gatewayUrl: string; amount: string; merchant: string; createdAt: number }>();

// In-memory customer store (for customer identity broadcasts)
const customerStore = new Map<string, { name: string; createdAt: number }>();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'payment-api',
      configureServer(server) {
        // Store payment endpoint
        server.middlewares.use('/api/store', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { shortCode, paymentId, gatewayUrl, amount, merchant } = JSON.parse(body);
                paymentStore.set(shortCode, { paymentId, gatewayUrl, amount, merchant: merchant || 'Merchant', createdAt: Date.now() });
                console.log(`[API] Stored: ${shortCode} → ${paymentId}`);

                // Auto-expire after 10 minutes
                setTimeout(() => paymentStore.delete(shortCode), 10 * 60 * 1000);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } else {
            next();
          }
        });

        // Lookup payment endpoint
        server.middlewares.use('/api/lookup', (req, res, next) => {
          if (req.method === 'GET' && req.url) {
            const shortCode = req.url.replace('/', '').toUpperCase();
            const payment = paymentStore.get(shortCode);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (payment) {
              console.log(`[API] Lookup found: ${shortCode}`);
              res.end(JSON.stringify(payment));
            } else {
              console.log(`[API] Lookup not found: ${shortCode}`);
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Not found' }));
            }
          } else {
            next();
          }
        });

        // Store customer identity endpoint
        server.middlewares.use('/api/customer/store', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { shortCode, name } = JSON.parse(body);
                customerStore.set(shortCode, { name, createdAt: Date.now() });
                console.log(`[API] Customer stored: ${shortCode} → ${name}`);

                // Auto-expire after 30 minutes
                setTimeout(() => customerStore.delete(shortCode), 30 * 60 * 1000);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } else {
            next();
          }
        });

        // Lookup customer identity endpoint
        server.middlewares.use('/api/customer/lookup', (req, res, next) => {
          if (req.method === 'GET' && req.url) {
            const shortCode = req.url.replace('/', '').toUpperCase();
            const customer = customerStore.get(shortCode);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (customer) {
              console.log(`[API] Customer found: ${shortCode} → ${customer.name}`);
              res.end(JSON.stringify(customer));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Not found' }));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: true, // Allow external access for iOS to call API
    proxy: {
      '/wcpay': {
        target: 'https://api.pay.walletconnect.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wcpay/, ''),
        secure: true,
      }
    }
  }
})
