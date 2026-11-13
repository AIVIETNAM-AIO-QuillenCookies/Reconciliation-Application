import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const server = await createServer({
  configFile: false,
  plugins: [
    {
      name: 'qa-ready-engine-layout-only',
      enforce: 'pre',
      load(id) {
        if (id.replaceAll('\\', '/').endsWith('/src/hooks/useDuckDB.tsx'))
          return 'export function useDuckDB() { return {status: "ready", database: null, error: null, retry() {}} }'
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
  server: { port: 5175, host: '127.0.0.1', strictPort: true },
})
await server.listen()
server.printUrls()
