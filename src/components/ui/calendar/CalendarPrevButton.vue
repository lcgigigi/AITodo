<script lang="ts" setup>
import { ChevronLeftIcon } from '@lucide/vue';

import type { CalendarPrevProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CalendarPrev, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<CalendarPrevProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <CalendarPrev
    data-slot="calendar-prev-button"
    :class="cn(
      buttonVariants({ variant: 'outline' }),
      'size-8 rounded-xl border-slate-200 bg-white p-0 text-slate-500 opacity-100 shadow-none hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600',
      props.class,
    )"
    v-bind="forwardedProps"
  >
    <slot>
      <ChevronLeftIcon class="cn-rtl-flip size-4" />
    </slot>
  </CalendarPrev>
</template>
