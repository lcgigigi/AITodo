export type StorySlideKind =
  | 'cover'
  | 'intro'
  | 'content'
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

export function normalizeWorkReportStoryboardItems(source: WorkReportSource): WorkReportStoryboardItem[] {
  if (Array.isArray(source)) return source.filter((scene) => scene.title || scene.content || scene.summary)

  try {
    const parsed: unknown = JSON.parse(source)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (scene): scene is WorkReportStoryboardItem =>
        typeof scene === 'object' &&
        scene !== null &&
        ('title' in scene || 'content' in scene || 'summary' in scene),
    )
  } catch {
    return []
  }
}

function splitParagraphs(text: string) {
  return text
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
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

function extractClosingQuote(text: string) {
  const matched = text.match(/[“"]([^”"]{4,24})[”"]/)
  return matched?.[1]?.trim() ?? ''
}

export function buildWorkReportStorySlides(source: WorkReportSource, displayName: string): StorySlide[] {
  const storyboardItems = normalizeWorkReportStoryboardItems(source)

  if (storyboardItems.length > 0) {
    const accents: StorySlideAccent[] = ['blue', 'amber', 'violet', 'teal']

    return [
      {
        id: 'cover',
        kind: 'cover',
        accent: 'blue',
        eyebrow: 'AI Work Review',
        title: '你的工作回顾',
        subtitle: '工作回顾',
        body: '把每一段投入，化成值得回看的成长故事。',
      },
      ...storyboardItems.map((scene, index) => {
        const isClosing = index === storyboardItems.length - 1
        const body = scene.content?.trim() || ''

        return {
          id: `scene-${index + 1}`,
          kind: (isClosing ? 'closing' : 'content') as StorySlideKind,
          accent: isClosing ? 'gold' : accents[index % accents.length],
          eyebrow: `工作片段 ${String(index + 1).padStart(2, '0')}`,
          title: scene.title?.trim() || '工作回顾',
          subtitle: scene.summary?.trim() || undefined,
          body,
          quote: isClosing ? extractClosingQuote(body) || undefined : undefined,
        }
      }),
    ]
  }

  const text = typeof source === 'string' ? source : ''
  const paragraphs = splitParagraphs(text)
  const greeting = extractGreeting(text, displayName)
  const period = extractReportPeriod(text)

  const contentParagraphs = paragraphs.filter(
    (paragraph, index) => !(index === 0 && /你好[！!]?$/.test(paragraph)),
  )

  const introParagraph = contentParagraphs[0] ?? ''
  const closingParagraph = contentParagraphs.length > 1
    ? contentParagraphs[contentParagraphs.length - 1]
    : ''
  const closingQuote = extractClosingQuote(closingParagraph)

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

  const middleParagraphs = contentParagraphs.slice(1, -1)
  const accents: StorySlideAccent[] = ['amber', 'violet', 'teal', 'blue']

  middleParagraphs.forEach((paragraph, index) => {
    slides.push({
      id: `content-${index + 1}`,
      kind: 'content',
      accent: accents[index % accents.length],
      eyebrow: `工作片段 ${String(index + 2).padStart(2, '0')}`,
      title: '每一段投入，都值得被记住',
      body: paragraph,
    })
  })

  slides.push({
    id: 'closing',
    kind: 'closing',
    accent: 'gold',
    eyebrow: '下一程',
    title: '把积累带向新的可能',
    subtitle: period,
    body: closingParagraph || '这段回顾，是下一程继续前行的底气。',
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
import type { WorkReportSource, WorkReportStoryboardItem } from '@/modules/home/dashboard/services/todo.service'
