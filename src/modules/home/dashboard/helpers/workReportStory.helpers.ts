export type StorySlideKind =
  | 'cover'
  | 'intro'
  | 'stats'
  | 'busiest'
  | 'focus'
  | 'collaboration'
  | 'closing'

export type StorySlideAccent = 'blue' | 'amber' | 'violet' | 'teal' | 'gold'

export interface StoryMetric {
  id: string
  value: number
  suffix?: string
  label: string
  displayAsDuration?: boolean
}

export interface StorySlide {
  id: string
  kind: StorySlideKind
  accent: StorySlideAccent
  eyebrow?: string
  title: string
  subtitle?: string
  body?: string
  metrics?: StoryMetric[]
  tags?: string[]
  quote?: string
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, '').trim())
    .filter(Boolean)
}

export function extractReportPeriod(text: string) {
  const matched = text.match(/回顾\s*([^，。！？\n]{2,30})[，。！？]/)
  return matched?.[1]?.trim() || '工作回顾'
}

export function extractGreeting(text: string, fallbackName: string) {
  const firstParagraph = splitParagraphs(text)[0] ?? ''
  const matched = firstParagraph.match(/^(.{1,16}?)，?你好[！!]?/)
  return matched?.[1]?.trim() || fallbackName
}

function extractBoldPhrases(text: string) {
  return [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1]?.trim() ?? '').filter(Boolean)
}

function extractBusiestDay(text: string) {
  const matched = text.match(
    /(\d{1,2}月\d{1,2}日)[^。！？\n]{0,24}?(?:最为忙碌|最忙)[^。！？\n]{0,24}?处理了\s*(\d+)\s*项/,
  )

  if (!matched) return null

  return {
    date: matched[1],
    count: Number(matched[2]),
  }
}

function extractBusiestTags(text: string) {
  const matched = text.match(/涵盖(?:了)?([^。]+)[。！？]/)
  if (!matched?.[1]) return []

  return matched[1]
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function extractFocusDurationMinutes(text: string) {
  const hourMinute = text.match(/(\d+)\s*小时\s*(\d+)\s*分钟/)
  if (hourMinute) {
    return Number(hourMinute[1]) * 60 + Number(hourMinute[2])
  }

  const minuteOnly = text.match(/(\d+)\s*分钟/)
  return minuteOnly ? Number(minuteOnly[1]) : 0
}

function extractEarliestStart(text: string) {
  const matched = text.match(/(\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2})/)
  return matched?.[1]?.replace(/\s+/g, '') ?? ''
}

function extractClosingQuote(text: string) {
  const matched = text.match(/[“"]([^”"]{4,24})[”"]/)
  return matched?.[1]?.trim() ?? ''
}

export function buildWorkReportStorySlides(text: string, displayName: string): StorySlide[] {
  const paragraphs = splitParagraphs(text)
  const greeting = extractGreeting(text, displayName)
  const period = extractReportPeriod(text)
  const busiestDay = extractBusiestDay(text)
  const focusDurationMinutes = extractFocusDurationMinutes(text)
  const earliestStart = extractEarliestStart(text)
  const focusTags = extractBoldPhrases(text)

  const contentParagraphs = paragraphs.filter(
    (paragraph, index) => !(index === 0 && /你好[！!]?$/.test(paragraph)),
  )

  const introParagraph =
    contentParagraphs.find((paragraph) => /工作轨迹|回顾|投入/.test(paragraph)) ??
    contentParagraphs[0] ??
    ''

  const busiestParagraph = contentParagraphs.find((paragraph) =>
    /忙碌|处理了\d+项|高密度/.test(paragraph),
  )

  const focusParagraph = contentParagraphs.find((paragraph) =>
    /核心精力|数智化|AI技术|数据治理/.test(paragraph),
  )

  const collaborationParagraph = contentParagraphs.find((paragraph) =>
    /会议|协同|沟通|对接|交流/.test(paragraph),
  )

  const closingParagraph = contentParagraphs[contentParagraphs.length - 1] ?? ''
  const closingQuote = extractClosingQuote(closingParagraph)

  const metrics: StoryMetric[] = []

  if (busiestDay?.count) {
    metrics.push({
      id: 'busiest-count',
      value: busiestDay.count,
      suffix: '项',
      label: '最忙一天处理事务',
    })
  }

  if (focusDurationMinutes > 0) {
    metrics.push({
      id: 'focus-duration',
      value: focusDurationMinutes,
      label: '最长专注时长',
      displayAsDuration: true,
    })
  }

  if (earliestStart) {
    metrics.push({
      id: 'earliest-start',
      value: 0,
      suffix: earliestStart,
      label: '最早开始投入',
    })
  }

  const slides: StorySlide[] = [
    {
      id: 'cover',
      kind: 'cover',
      accent: 'blue',
      eyebrow: 'AI Work Review',
      title: '你的工作回顾',
      subtitle: period,
      body: '把上半年的投入，化成一段值得回看的成长故事。',
    },
    {
      id: 'intro',
      kind: 'intro',
      accent: 'blue',
      eyebrow: '开场',
      title: `${greeting}，你好`,
      subtitle: `这是属于你的 ${period}`,
      body: introParagraph,
    },
  ]

  if (metrics.length > 0) {
    slides.push({
      id: 'stats',
      kind: 'stats',
      accent: 'amber',
      eyebrow: '高光数据',
      title: '这些数字，记录你的投入',
      subtitle: '每一次专注，都会被时间记住',
      metrics,
    })
  }

  if (busiestDay) {
    slides.push({
      id: 'busiest',
      kind: 'busiest',
      accent: 'amber',
      eyebrow: '高光时刻',
      title: busiestDay.date,
      subtitle: '你最为忙碌的一天',
      body: busiestParagraph,
      tags: extractBusiestTags(text),
      metrics: [
        {
          id: 'busiest-day-count',
          value: busiestDay.count,
          suffix: '项事务',
          label: '当天处理',
        },
      ],
    })
  }

  if (focusParagraph || focusTags.length > 0) {
    slides.push({
      id: 'focus',
      kind: 'focus',
      accent: 'violet',
      eyebrow: '核心投入',
      title: '向智能化纵深推进',
      subtitle: '你的精力，主要聚焦在这里',
      body: focusParagraph,
      tags: focusTags.length > 0 ? focusTags : ['数智化', 'AI 落地', '系统迭代'],
    })
  }

  if (collaborationParagraph) {
    slides.push({
      id: 'collaboration',
      kind: 'collaboration',
      accent: 'teal',
      eyebrow: '协同连接',
      title: '让共识在行动中落地',
      subtitle: '会议与协同，是你工作的重要组成',
      body: collaborationParagraph,
    })
  }

  slides.push({
    id: 'closing',
    kind: 'closing',
    accent: 'gold',
    eyebrow: '下一程',
    title: '把积累带向新的可能',
    subtitle: period,
    body: closingParagraph,
    quote: closingQuote || '博观而约取，厚积而薄发',
  })

  return slides
}

export function formatDurationMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) return `${minutes}分钟`
  if (minutes <= 0) return `${hours}小时`
  return `${hours}小时${minutes}分钟`
}
