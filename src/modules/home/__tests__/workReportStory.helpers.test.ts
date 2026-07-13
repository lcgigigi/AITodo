import { describe, expect, it } from 'vitest'
import {
  buildWorkReportStorySlides,
  extractGreeting,
  extractReportPeriod,
  formatDurationMinutes,
} from '@/modules/home/dashboard/helpers/workReportStory.helpers'

const SAMPLE_WORK_REPORT = `美华，你好！

回顾2026年上半年，你的工作轨迹充实而坚定。6月27日08:50，你便已投入到“寻访红色足迹，致敬大国工匠”的主题党日活动中，展现了良好的精神风貌；而在6月12日19:30，你仍坚守在工会花艺课的岗位上，这份对集体活动的热情与投入值得点赞。期间，你在“2025年度公司绩效指标完成情况-集团沟通会”中持续专注了3小时30分钟，体现了极强的耐心与专业度。

3月18日是你最为忙碌的一天，当天处理了8项事务，涵盖康四系统Code建立、H0V系统搭建推进、仪电集团交流以及多次党课学习等。面对如此高密度的任务切换，你依然有条不紊，辛苦了！

从整体工作来看，你的核心精力主要聚焦于**数智化转型与AI技术落地**。你深度参与了数据治理全周期工作，从方案讨论到阶段总结，推动了数据价值的释放。同时，在AI应用方面，你广泛对接了多家厂商，深入探讨了RTL代码辅助生成、合同智能审核、培训智能体选型及可靠性AI进展等前沿议题，为公司的智能化升级提供了丰富的技术视野。此外，H0V系统搭建、备件与原物料数智化优化也是你长期持续推进的重点事项，确保了业务系统的稳定迭代。

会议与协同是你工作的重要组成部分。你频繁参与集团数智化专家库技术交流、FAB流片问题沟通及各类供应商选型会议，展现了出色的跨部门协同与外部沟通能力。无论是OB数据库的双周跟进，还是人力驾驶舱的项目周会，都见证了你扎实的执行力度。

这半年，你在繁忙中保持节奏，在探索中积累成果。“博观而约取，厚积而薄发”，期待你在下半年继续发挥专业优势，在数智化浪潮中创造更多价值！`

describe('workReportStory.helpers', () => {
  it('extracts period and greeting from sample report text', () => {
    expect(extractReportPeriod(SAMPLE_WORK_REPORT)).toBe('2026年上半年')
    expect(extractGreeting(SAMPLE_WORK_REPORT, '你')).toBe('美华')
  })

  it('builds a multi-slide story from sample report text', () => {
    const slides = buildWorkReportStorySlides(SAMPLE_WORK_REPORT, '美华')

    expect(slides.length).toBeGreaterThanOrEqual(6)
    expect(slides[0]?.kind).toBe('cover')
    expect(slides.at(-1)?.kind).toBe('closing')

    const statsSlide = slides.find((slide) => slide.kind === 'stats')
    expect(statsSlide?.metrics?.some((metric) => metric.value === 8)).toBe(true)
    expect(statsSlide?.metrics?.some((metric) => metric.displayAsDuration)).toBe(true)

    const busiestSlide = slides.find((slide) => slide.kind === 'busiest')
    expect(busiestSlide?.title).toBe('3月18日')
    expect(busiestSlide?.tags?.length).toBeGreaterThan(0)
  })

  it('formats duration minutes for story metrics', () => {
    expect(formatDurationMinutes(210)).toBe('3小时30分钟')
    expect(formatDurationMinutes(45)).toBe('45分钟')
  })
})
