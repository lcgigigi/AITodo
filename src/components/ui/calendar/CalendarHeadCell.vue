<script lang="ts" setup>
import type { CalendarHeadCellProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CalendarHeadCell, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<CalendarHeadCellProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <CalendarHeadCell
    data-slot="calendar-head-cell"
    :class="cn('flex h-8 w-[var(--cell-size)] items-center justify-center rounded-md text-[13px] font-normal text-slate-500', props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </CalendarHeadCell>
</template>
