import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load ALL env vars (including non-VITE_ ones) for server-side use
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // Proxy Anthropic API calls so the key never touches the browser bundle
      proxy: {
        '/api/claude': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/claude/, ''),
          configure(proxy) {
            proxy.on('proxyReq', proxyReq => {
              if (env.ANTHROPIC_KEY) {
                proxyReq.setHeader('x-api-key', env.ANTHROPIC_KEY)
                proxyReq.setHeader('anthropic-version', '2023-06-01')
              }
            })
          },
        },
      },
    },
  }
})
