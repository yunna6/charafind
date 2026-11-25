import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署环境会注入 PORT；本地开发回落到 5173
const port = Number(process.env.PORT) || 5173

// GitHub Pages 的项目站点挂在 /<repo>/ 子路径下，构建时由工作流注入 BASE_PATH
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port,
    host: '0.0.0.0',
    // 反向代理域名不固定，放开 host 校验（内容为公开静态站点，无敏感接口）
    allowedHosts: true,
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
