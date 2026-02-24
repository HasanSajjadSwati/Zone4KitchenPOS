import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // WebSocket endpoint - must be listed first for proper matching
      '/api/ws': {
        target: 'http://127.0.0.1:3033',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // Proxy API requests to backend
      '/api': {
        target: 'http://127.0.0.1:3033',
        changeOrigin: true,
      },
    },
  },
})
