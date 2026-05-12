import { useFullscreen as useVueUseFullscreen } from '@vueuse/core'

export function useFullscreen(target?: HTMLElement) {
  return useVueUseFullscreen(target)
}
