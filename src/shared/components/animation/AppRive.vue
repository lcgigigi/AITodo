<template>
  <div class="app-rive" :aria-label="ariaLabel">
    <canvas ref="canvasRef" class="app-rive-canvas" />
    <div v-if="hasFallback" class="app-rive-fallback">
      <slot name="fallback" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Alignment, Fit, Layout, Rive } from '@rive-app/canvas-lite'

const props = withDefaults(
  defineProps<{
    src: string
    artboard?: string
    animations?: string | string[]
    stateMachines?: string | string[]
    autoplay?: boolean
    ariaLabel?: string
  }>(),
  {
    artboard: undefined,
    animations: undefined,
    stateMachines: undefined,
    autoplay: true,
    ariaLabel: undefined,
  },
)

const canvasRef = ref<HTMLCanvasElement>()
const isLoaded = ref(false)
const isFailed = ref(false)
const hasFallback = computed(() => !isLoaded.value || isFailed.value || !props.src)

let riveInstance: Rive | undefined
let resizeObserver: ResizeObserver | undefined
let loadToken = 0

function cleanupRive() {
  riveInstance?.cleanup()
  riveInstance = undefined
  isLoaded.value = false
}

function resizeRive() {
  riveInstance?.resizeDrawingSurfaceToCanvas()
}

async function createRive() {
  const currentToken = ++loadToken
  cleanupRive()
  isFailed.value = false

  await nextTick()
  if (!canvasRef.value || !props.src) {
    isFailed.value = true
    return
  }

  try {
    const response = await fetch(props.src)
    if (currentToken !== loadToken) return
    if (!response.ok) throw new Error(`Failed to load Rive file: ${props.src}`)

    const buffer = await response.arrayBuffer()
    if (currentToken !== loadToken || !canvasRef.value) return

    riveInstance = new Rive({
      buffer,
      canvas: canvasRef.value,
      artboard: props.artboard,
      animations: props.animations,
      stateMachines: props.stateMachines,
      autoplay: props.autoplay,
      layout: new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
      onLoad: () => {
        if (currentToken !== loadToken) return
        isLoaded.value = true
        resizeRive()
      },
      onLoadError: () => {
        if (currentToken !== loadToken) return
        isFailed.value = true
        cleanupRive()
      },
    })
  } catch {
    if (currentToken !== loadToken) return
    isFailed.value = true
    cleanupRive()
  }
}

onMounted(() => {
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(resizeRive)
    resizeObserver.observe(canvasRef.value)
  }
  void createRive()
})

watch(
  () => [
    props.src,
    props.artboard,
    props.autoplay,
    JSON.stringify(props.animations),
    JSON.stringify(props.stateMachines),
  ],
  () => {
    void createRive()
  },
)

onBeforeUnmount(() => {
  loadToken += 1
  resizeObserver?.disconnect()
  cleanupRive()
})
</script>

<style scoped>
.app-rive {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-rive-canvas,
.app-rive-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.app-rive-canvas {
  display: block;
  opacity: v-bind('isLoaded ? 1 : 0');
  transition: opacity 0.18s ease;
}
</style>
