import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
//@ts-expect-error no types
import eslint from 'vite-plugin-eslint'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), eslint()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
