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
      // Proxy API requests (including WebSocket at /api/ws) to backend
      '/api': {
        target: 'http://localhost:3033',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3033',
        changeOrigin: true,
      },
    },
  },
})
