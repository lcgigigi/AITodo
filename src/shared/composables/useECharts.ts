import * as echarts from 'echarts/core'
import { LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
])

/**
 * 统一管理一个页面内多个 ECharts 实例的初始化、整体 resize 与销毁。
 *
 * 只封装 agent-center 与 leader-board 完全一致的通用逻辑：
 * - getChart：按 DOM 复用实例，不存在则以 canvas 渲染器初始化，并纳入集合统一管理。
 * - resizeCharts：对集合内所有实例执行 resize。
 * - disposeCharts：销毁全部实例并清空集合。
 *
 * ResizeObserver、window resize 监听、定时器等与页面强相关的编排逻辑仍由各页面自行维护，
 * 以保证行为与配置项和原实现完全一致。
 */
export function useECharts() {
  const chartInstances = new Set<echarts.ECharts>()

  function getChart(el: HTMLElement | null) {
    if (!el) return null

    const chart =
      echarts.getInstanceByDom(el) ?? echarts.init(el, undefined, { renderer: 'canvas' })
    chartInstances.add(chart)
    return chart
  }

  function resizeCharts() {
    chartInstances.forEach((chart) => chart.resize())
  }

  function disposeCharts() {
    chartInstances.forEach((chart) => chart.dispose())
    chartInstances.clear()
  }

  return { chartInstances, getChart, resizeCharts, disposeCharts }
}
