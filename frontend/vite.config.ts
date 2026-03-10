import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
//@ts-expect-error no types
import eslint from 'vite-plugin-eslint'

export default defineConfig({
  plugins: [react(), eslint()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})