<script lang="ts" setup>
import type { CalendarCellTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { CalendarCellTrigger, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(
  defineProps<CalendarCellTriggerProps & { class?: HTMLAttributes['class'] }>(),
  {
    as: 'button',
  },
)

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <CalendarCellTrigger
    data-slot="calendar-cell-trigger"
    :class="
      cn(
        buttonVariants({ variant: 'ghost' }),
        'size-[var(--cell-size)] rounded-[var(--cell-radius)] p-0 text-[15px] font-normal text-slate-950 aria-selected:opacity-100 cursor-pointer hover:bg-blue-50 hover:text-blue-700',
        '[&[data-today]:not([data-selected])]:bg-slate-100 [&[data-today]:not([data-selected])]:text-slate-950',
        // Selected
        'data-[selected]:bg-blue-500 data-[selected]:text-white data-[selected]:shadow-[0_8px_18px_-12px_rgba(37,99,235,0.9)] data-[selected]:opacity-100 data-[selected]:hover:bg-blue-500 data-[selected]:hover:text-white data-[selected]:focus:bg-blue-500 data-[selected]:focus:text-white',
        // Disabled
        'data-[disabled]:text-slate-300 data-[disabled]:opacity-50',
        // Unavailable
        'data-[unavailable]:text-destructive-foreground data-[unavailable]:line-through',
        // Outside months
        'data-[outside-view]:text-slate-400',
        props.class,
      )
    "
    v-bind="forwardedProps"
  >
    <slot />
  </CalendarCellTrigger>
</template>
