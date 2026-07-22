import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'

const smartTodoApiTarget = 'http://223.244.82.97:18086'

export default defineConfig({
  plugins: [
    vue(),
    Icons({
      compiler: 'vue3',
      autoInstall: false,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        h5: path.resolve(__dirname, 'h5/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/login': {
        target: smartTodoApiTarget,
        changeOrigin: true,
        bypass(req) {
          // 前端登录页路由也是 /login；刷新时浏览器发 GET，应返回 SPA 而非转发后台
          if (req.method === 'GET' || req.method === 'HEAD') {
            return '/index.html'
          }
        },
      },
      '/getInfo': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/user-feature-status': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/logout': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/smart-todo': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/token-usage': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/opinion-box': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/sys-message': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/work-summary': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/websocket': {
        target: smartTodoApiTarget,
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/prod-api': {
        target: 'http://10.8.7.57:5000',
        changeOrigin: true,
      },
    },
  },
})
