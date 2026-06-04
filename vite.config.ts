import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'

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
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/prod-api': {
        target: 'http://10.8.7.57:5000',
        changeOrigin: true,
      },
      '/gptData': {
        target: 'http://10.8.7.57:5000',
        changeOrigin: true,
        rewrite: (apiPath) => apiPath.replace(/^\/gptData/, ''),
      },
    },
  },
})
