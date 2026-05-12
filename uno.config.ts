import { defineConfig, presetAttributify, presetIcons, presetUno } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.1,
      warn: true,
    }),
  ],
  theme: {
    colors: {
      app: {
        primary: 'var(--app-primary)',
        bg: 'var(--app-bg)',
        panel: 'var(--app-panel-bg)',
      },
    },
  },
})
