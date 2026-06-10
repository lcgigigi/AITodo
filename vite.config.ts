import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'

const smartTodoApiTarget = 'http://192.168.0.210:8066'

export default defineConfig({
  plugins: [
    vue(),
    Icons({
      compiler: 'vue3',
      autoInstall: false,
    }),
  ],
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
      },
      '/getInfo': {
        target: smartTodoApiTarget,
        changeOrigin: true,
      },
      '/smart-todo': {
        target: smartTodoApiTarget,
        changeOrigin: true,
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
