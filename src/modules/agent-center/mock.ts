export type ThemeName = 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'pink' | 'yellow'

export interface CategoryItem {
  key: string
  label: string
  count: number
  icon: string
}

export interface AgentItem {
  id: number
  name: string
  desc: string
  categoryKey: string
  categoryName: string
  icon: string
  theme: ThemeName
  monthlyToken: number
  calls: number
  points: number
  progress: number
  sparkline: number[]
  status: string
}

export interface RankItem {
  name: string
  value: number
}

export interface TrendItem {
  date: string
  value: number
}

export interface SummaryItem {
  label: string
  value: string
  unit: string
  rate: number
  icon: string
  sparkline: number[]
}

export const categories: CategoryItem[] = [
  { key: 'all', label: '全部智能体', count: 6, icon: '⌂' },
  { key: 'knowledge', label: '知识问答', count: 1, icon: '☷' },
  { key: 'data', label: '数据分析', count: 1, icon: '↗' },
  { key: 'content', label: '内容创作', count: 1, icon: '✎' },
  { key: 'dev', label: '研发辅助', count: 1, icon: '⌘' },
  { key: 'meeting', label: '会议效率', count: 1, icon: '◉' },
  { key: 'interview', label: '面试招聘', count: 1, icon: '◎' }
]

export const agents: AgentItem[] = [
  {
    id: 1,
    name: '力宝百问',
    desc: '企业知识中枢，智能检索与问答',
    categoryKey: 'knowledge',
    categoryName: '知识问答',
    icon: '问',
    theme: 'blue',
    monthlyToken: 128450,
    calls: 432,
    points: 12840,
    progress: 64,
    sparkline: [18, 24, 20, 28, 25, 34, 31, 38, 35, 44, 41, 52],
    status: '运行中'
  },
  {
    id: 2,
    name: '图文分析',
    desc: '多模图文解析，洞察提取与归纳',
    categoryKey: 'data',
    categoryName: '数据分析',
    icon: '图',
    theme: 'orange',
    monthlyToken: 72640,
    calls: 241,
    points: 7260,
    progress: 36,
    sparkline: [10, 12, 11, 18, 16, 20, 18, 27, 25, 31, 29, 26],
    status: '运行中'
  },
  {
    id: 3,
    name: 'PPT创作',
    desc: 'AI 一键生成演示文稿，高效汇报表达',
    categoryKey: 'content',
    categoryName: '内容创作',
    icon: 'P',
    theme: 'purple',
    monthlyToken: 86530,
    calls: 278,
    points: 8650,
    progress: 43,
    sparkline: [16, 18, 15, 24, 22, 31, 28, 35, 29, 42, 38, 36],
    status: '运行中'
  },
  {
    id: 4,
    name: '代码助手',
    desc: '代码生成与优化，提升开发效率',
    categoryKey: 'dev',
    categoryName: '研发辅助',
    icon: '</>',
    theme: 'indigo',
    monthlyToken: 24780,
    calls: 88,
    points: 2478,
    progress: 12,
    sparkline: [4, 8, 7, 9, 12, 18, 15, 17, 16, 19, 17, 21],
    status: '运行中'
  },
  {
    id: 5,
    name: '会议纪要',
    desc: '会议记录与总结，智能整理要点',
    categoryKey: 'meeting',
    categoryName: '会议效率',
    icon: '会',
    theme: 'green',
    monthlyToken: 96210,
    calls: 315,
    points: 9210,
    progress: 48,
    sparkline: [12, 20, 15, 18, 25, 22, 30, 28, 34, 29, 37, 35],
    status: '运行中'
  },
  {
    id: 6,
    name: '面试中心',
    desc: '面试题生成、候选人评估与复盘',
    categoryKey: 'interview',
    categoryName: '面试招聘',
    icon: '面',
    theme: 'pink',
    monthlyToken: 58930,
    calls: 193,
    points: 5890,
    progress: 29,
    sparkline: [9, 14, 12, 21, 19, 25, 23, 28, 26, 31, 29, 33],
    status: '运行中'
  }
]

export const tokenOverview = {
  monthTotal: 467540,
  today: 20320,
  todayRate: 12.4,
  average: 77923,
  remaining: 1532460,
  quotaUsed: 23,
  categoryPercent: [
    { name: '知识问答', percent: 27, color: '#2f68ff' },
    { name: '会议效率', percent: 21, color: '#20b97a' },
    { name: '内容创作', percent: 18, color: '#7b61ff' },
    { name: '数据分析', percent: 16, color: '#f6b73c' },
    { name: '面试招聘', percent: 13, color: '#f06aa6' },
    { name: '研发辅助', percent: 5, color: '#465782' }
  ]
}

export const tokenRanking: RankItem[] = [
  { name: '力宝百问', value: 128450 },
  { name: '会议纪要', value: 96210 },
  { name: 'PPT创作', value: 86530 },
  { name: '图文分析', value: 72640 },
  { name: '面试中心', value: 58930 },
  { name: '代码助手', value: 24780 }
]

export const pointsRanking: RankItem[] = [
  { name: '力宝百问', value: 12840 },
  { name: '会议纪要', value: 9210 },
  { name: 'PPT创作', value: 8650 },
  { name: '图文分析', value: 7260 },
  { name: '面试中心', value: 5890 },
  { name: '代码助手', value: 2478 }
]

export const trendData: TrendItem[] = [
  { date: '05-16', value: 32460 },
  { date: '05-17', value: 41280 },
  { date: '05-18', value: 38170 },
  { date: '05-19', value: 45620 },
  { date: '05-20', value: 52930 },
  { date: '05-21', value: 48610 },
  { date: '05-22', value: 20320 }
]

export const summaryStats: SummaryItem[] = [
  { label: '智能体总数', value: '6', unit: '个', rate: 9.1, icon: '▣', sparkline: [10, 12, 11, 14, 13, 18, 17, 22, 20, 23] },
  { label: '本月调用次数', value: '1,547', unit: '次', rate: 12.6, icon: '↗', sparkline: [8, 10, 12, 11, 15, 18, 16, 24, 19, 26] },
  { label: '累计 Token', value: '4,675,400', unit: '', rate: 18.3, icon: '☁', sparkline: [18, 22, 21, 25, 27, 31, 29, 36, 33, 41] },
  { label: '活跃用户数', value: '428', unit: '人', rate: 8.7, icon: '👥', sparkline: [9, 11, 10, 13, 15, 14, 17, 19, 18, 22] },
  { label: '积分总池', value: '46,328', unit: '分', rate: 14.2, icon: '★', sparkline: [13, 14, 16, 18, 17, 22, 20, 26, 24, 29] }
]
