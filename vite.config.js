import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/akreative/',
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        curso: resolve(__dirname, 'curso.html')
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: '/admin.html'
  }
})
