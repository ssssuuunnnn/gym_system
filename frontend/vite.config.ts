import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://localhost:8000'

// https://vite.dev/config/
// 開發時把 /api、/media 轉給後端並保留 Host（不 changeOrigin），後端才能從子網域判斷是哪家健身房／平台：
// http://alpha.localhost:5173、http://platform.localhost:5173（見 docs/adr/0001、0002）。
// 健身房的首頁 / 是後端產生的形象網站（docs/adr/0003），與 frontend/nginx.conf 的規則一致。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
      '/media': { target: BACKEND, changeOrigin: false },
      '/site': { target: BACKEND, changeOrigin: false },
      '^/(robots\\.txt|sitemap\\.xml)$': { target: BACKEND, changeOrigin: false },
      '^/$': {
        target: BACKEND,
        changeOrigin: false,
        // 平台後台的首頁仍是 SPA
        bypass: (req) => (req.headers.host?.startsWith('platform.') ? '/index.html' : undefined),
      },
    },
  },
})
