import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Classic DuckDB workers must be real same-origin assets, never data URLs.
  build: { assetsInlineLimit: 0 },
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
})
