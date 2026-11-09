import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function localTiradaPlugin() {
  return {
    name: 'local-tirada-storage',
    configureServer(server) {
      server.middlewares.use('/api/local-tirada', (req, res, next) => {
        const dataDir = path.resolve(process.cwd(), 'src', 'data')
        const latestPath = path.join(dataDir, 'ultima_tirada.json')
        const historyPath = path.join(dataDir, 'historial_tiradas.json')

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body)
              fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2), 'utf-8')

              let history = []
              if (fs.existsSync(historyPath)) {
                try {
                  history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
                  if (!Array.isArray(history)) history = []
                } catch {
                  history = []
                }
              }
              history.unshift(payload)
              if (history.length > 50) history = history.slice(0, 50)
              fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8')

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, savedTo: latestPath }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: err.message }))
            }
          })
          return
        }

        if (req.method === 'GET') {
          if (fs.existsSync(latestPath)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(fs.readFileSync(latestPath, 'utf-8'))
          } else {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'No hay tirada guardada aún' }))
          }
          return
        }

        next()
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  // Load ALL env vars (including non-VITE_ ones) for server-side use
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), localTiradaPlugin()],
    server: {
      port: 5173,
      strictPort: true,
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

