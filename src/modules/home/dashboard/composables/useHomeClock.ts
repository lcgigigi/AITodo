import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { getNextHomeAmbienceChangeAt } from '../helpers/homeTimeOfDay'

const sharedNow = ref(new Date())
let subscriberCount = 0
let timer: ReturnType<typeof setTimeout> | undefined

function syncNow() {
  sharedNow.value = new Date()
}

function scheduleNextTick() {
  if (timer) clearTimeout(timer)

  const delay = getNextHomeAmbienceChangeAt(sharedNow.value).getTime() - Date.now()
  timer = setTimeout(
    () => {
      syncNow()
      scheduleNextTick()
    },
    Math.max(delay, 1_000),
  )
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  syncNow()
  scheduleNextTick()
}

function startClock() {
  syncNow()
  scheduleNextTick()
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

function stopClock() {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

function subscribe() {
  subscriberCount += 1
  if (subscriberCount === 1) startClock()
}

function unsubscribe() {
  subscriberCount = Math.max(subscriberCount - 1, 0)
  if (subscriberCount === 0) stopClock()
}

/** 全页共享时钟：仅在问候语/背景切换边界更新，不做高频轮询 */
export function useHomeClock(): { now: Ref<Date> } {
  onMounted(subscribe)
  onBeforeUnmount(unsubscribe)

  return { now: sharedNow }
}
