<script lang="ts" setup>
import type { CalendarRootEmits, CalendarRootProps, DateValue } from 'reka-ui'
import type { HTMLAttributes, Ref } from 'vue'
import type { LayoutTypes } from '.'
import { getLocalTimeZone, today } from '@internationalized/date'
import { createReusableTemplate, reactiveOmit, useVModel } from '@vueuse/core'
import { CalendarRoot, useDateFormatter, useForwardPropsEmits } from 'reka-ui'
import { createYear, createYearRange, toDate } from 'reka-ui/date'
import { computed, ref, toRaw } from 'vue'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
} from '.'

defineOptions({
  name: 'UiCalendar',
})

const props = withDefaults(
  defineProps<
    CalendarRootProps & {
      class?: HTMLAttributes['class']
      layout?: LayoutTypes
      yearRange?: DateValue[]
    }
  >(),
  {
    modelValue: undefined,
    layout: undefined,
  },
)
const emits = defineEmits<CalendarRootEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'layout', 'placeholder')

const placeholder = useVModel(props, 'placeholder', emits, {
  passive: true,
  defaultValue: props.defaultPlaceholder ?? today(getLocalTimeZone()),
}) as Ref<DateValue>

const formatter = useDateFormatter(props.locale ?? 'en')

const yearRange = computed(() => {
  return (
    props.yearRange ??
    createYearRange({
      start:
        props?.minValue ??
        (toRaw(props.placeholder) ?? props.defaultPlaceholder ?? today(getLocalTimeZone())).cycle(
          'year',
          -100,
        ),

      end:
        props?.maxValue ??
        (toRaw(props.placeholder) ?? props.defaultPlaceholder ?? today(getLocalTimeZone())).cycle(
          'year',
          10,
        ),
    })
  )
})

const [DefineMonthTemplate, ReuseMonthTemplate] = createReusableTemplate<{ date: DateValue }>()
const [DefineYearTemplate, ReuseYearTemplate] = createReusableTemplate<{ date: DateValue }>()

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const isMonthSelectOpen = ref(false)
const isYearSelectOpen = ref(false)
const isPeriodSelectOpen = computed(() => isMonthSelectOpen.value || isYearSelectOpen.value)

function closePeriodSelects() {
  isMonthSelectOpen.value = false
  isYearSelectOpen.value = false
}

function updatePlaceholder(part: 'month' | 'year', value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return

  placeholder.value = placeholder.value.set({
    [part]: numericValue,
  })
}
</script>

<template>
  <DefineMonthTemplate v-slot="{ date }">
    <Select
      v-model:open="isMonthSelectOpen"
      :model-value="date.month"
      @update:model-value="updatePlaceholder('month', $event)"
    >
      <SelectTrigger
        class="h-8 min-w-[74px] rounded-xl border-slate-200 bg-slate-50/80 px-2 text-sm font-normal text-slate-800 shadow-none hover:border-blue-200 hover:bg-white"
        size="sm"
        aria-label="选择月份"
      >
        <SelectValue>
          {{ formatter.custom(toDate(date), { month: 'short' }) }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" class="calendar-select-content min-w-[88px] rounded-xl">
        <SelectItem
          v-for="month in createYear({ dateObj: date })"
          :key="month.toString()"
          :value="month.month"
        >
          {{ formatter.custom(toDate(month), { month: 'short' }) }}
        </SelectItem>
      </SelectContent>
    </Select>
  </DefineMonthTemplate>

  <DefineYearTemplate v-slot="{ date }">
    <Select
      v-model:open="isYearSelectOpen"
      :model-value="date.year"
      @update:model-value="updatePlaceholder('year', $event)"
    >
      <SelectTrigger
        class="h-8 min-w-[84px] rounded-xl border-slate-200 bg-slate-50/80 px-2 text-sm font-normal text-slate-800 shadow-none hover:border-blue-200 hover:bg-white"
        size="sm"
        aria-label="选择年份"
      >
        <SelectValue>
          {{ formatter.custom(toDate(date), { year: 'numeric' }) }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" class="calendar-select-content min-w-[96px] rounded-xl">
        <SelectItem v-for="year in yearRange" :key="year.toString()" :value="year.year">
          {{ formatter.custom(toDate(year), { year: 'numeric' }) }}
        </SelectItem>
      </SelectContent>
    </Select>
  </DefineYearTemplate>

  <CalendarRoot
    v-slot="{ grid, weekDays, date }"
    v-bind="forwarded"
    v-model:placeholder="placeholder"
    data-slot="calendar"
    :class="
      cn(
        'relative w-[264px] overflow-hidden rounded-2xl p-3 [--cell-radius:12px] [--cell-size:32px] group/calendar bg-white in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
        props.class,
      )
    "
  >
    <div
      v-if="isPeriodSelectOpen"
      class="calendar-select-scrim absolute inset-0 z-[6] rounded-[inherit] bg-slate-900/10"
      aria-hidden="true"
      @click="closePeriodSelects"
    />

    <CalendarHeader class="relative z-20 px-0 pt-0">
      <nav
        class="pointer-events-none absolute top-0 inset-x-0 flex items-center justify-between gap-1"
      >
        <CalendarPrevButton class="pointer-events-auto">
          <slot name="calendar-prev-icon" />
        </CalendarPrevButton>
        <CalendarNextButton class="pointer-events-auto">
          <slot name="calendar-next-icon" />
        </CalendarNextButton>
      </nav>

      <slot
        name="calendar-heading"
        :date="date"
        :month="ReuseMonthTemplate"
        :year="ReuseYearTemplate"
      >
        <template v-if="layout === 'month-and-year'">
          <div class="relative z-20 flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else-if="layout === 'month-only'">
          <div class="relative z-20 flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            {{ formatter.custom(toDate(date), { year: 'numeric' }) }}
          </div>
        </template>
        <template v-else-if="layout === 'year-only'">
          <div class="relative z-20 flex items-center justify-center gap-1">
            {{ formatter.custom(toDate(date), { month: 'short' }) }}
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else>
          <CalendarHeading />
        </template>
      </slot>
    </CalendarHeader>

    <div class="relative z-[1] mt-3 flex flex-col gap-y-2 sm:flex-row sm:gap-x-2 sm:gap-y-0">
      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell v-for="day in weekDays" :key="day">
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow
            v-for="(weekDates, index) in month.rows"
            :key="`weekDate-${index}`"
            class="mt-1 w-full"
          >
            <CalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
              <CalendarCellTrigger :day="weekDate" :month="month.value" />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>

<style>
[data-slot='select-content'].calendar-select-content {
  --calendar-select-visible-items: 5;
  --calendar-select-item-size: 2rem;
  z-index: 1210 !important;
  max-height: calc(
    var(--calendar-select-item-size) * var(--calendar-select-visible-items)
  ) !important;
  overflow-y: auto !important;
}

[data-slot='select-content'].calendar-select-content
  [data-slot='select-viewport'][data-position='popper'] {
  height: auto !important;
  max-height: calc(
    var(--calendar-select-item-size) * var(--calendar-select-visible-items)
  ) !important;
}
</style>
