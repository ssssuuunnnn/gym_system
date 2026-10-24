import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 開發時把 /api、/media 轉給後端並保留 Host（不 changeOrigin），後端才能從子網域判斷是哪家健身房／平台：
// http://alpha.localhost:5173、http://platform.localhost:5173（見 docs/adr/0001、0002）
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: false },
      '/media': { target: 'http://localhost:8000', changeOrigin: false },
    },
  },
})
