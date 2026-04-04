import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API server URL - change this for production
const API_SERVER = 'https://sonicpay-pos.pages.dev'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Proxy all API calls to deployed server
      '/api': {
        target: API_SERVER,
        changeOrigin: true,
        secure: true,
      },
      // Proxy WalletConnect Pay calls
      '/wcpay': {
        target: API_SERVER,
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
