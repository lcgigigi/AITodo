import type { AgentCatalogItem, AgentCategory, SkillCatalogItem, SkillCategory } from './types'
import { agentLaunchUrls } from './links'

export const agentCategories: AgentCategory[] = ['文字', '办公', '创作', '研发', '生活']

export const skillCategories: SkillCategory[] = ['文字', '分析', '办公', '研发', '生活']

export const permissionLabels = {
  available: '可用',
  locked: '需申请',
  'admin-only': '管理者',
} as const

export const agents: AgentCatalogItem[] = [
  {
    id: 'agent-policy-qa',
    key: 'policy-qa',
    name: '力宝百问',
    description: '企业知识中枢，支持制度、流程与 FAQ 的智能检索与问答。',
    category: '文字',
    icon: '问',
    theme: 'blue',
    permissionState: 'available',
    level: 'L1',
    scenarios: ['制度查询', '流程入口定位', '新人入职问答'],
    launchUrl: agentLaunchUrls['policy-qa'],
    recommended: true,
  },
  {
    id: 'agent-image-analysis',
    key: 'image-analysis',
    name: '图文分析',
    description: '多模态图文解析，提取要点、表格与结构化洞察。',
    category: '创作',
    icon: '图',
    theme: 'orange',
    permissionState: 'available',
    level: 'L1',
    scenarios: ['素材审阅', '图片内容摘要', '竞品图文拆解'],
    launchUrl: agentLaunchUrls['image-analysis'],
  },
  {
    id: 'agent-meeting-notes',
    key: 'meeting-notes',
    name: '会议纪要',
    description: '会议记录与总结，自动整理结论、待办与负责人。',
    category: '办公',
    icon: '会',
    theme: 'green',
    permissionState: 'available',
    level: 'L2',
    scenarios: ['周会纪要', '项目复盘', '行动项拆解'],
    launchUrl: agentLaunchUrls['meeting-notes'],
  },
  {
    id: 'agent-ppt-creator',
    key: 'ppt-creator',
    name: '智能PPT',
    description: 'AI 一键生成演示文稿，快速完成汇报结构与页面文案。',
    category: '创作',
    icon: 'P',
    theme: 'purple',
    permissionState: 'available',
    level: 'L2',
    scenarios: ['经营汇报', '项目复盘', '客户方案初稿'],
    launchUrl: agentLaunchUrls['ppt-creator'],
    recommended: true,
  },
  {
    id: 'agent-workshop',
    key: 'agent-workshop',
    name: '智体工坊',
    description: '可视化搭建与调试智能体，支持模板复用与能力组合。',
    category: '研发',
    icon: '坊',
    theme: 'violet',
    permissionState: 'available',
    level: 'L1',
    scenarios: ['智能体搭建', '流程编排', '能力调试'],
    launchUrl: agentLaunchUrls['agent-workshop'],
  },
  {
    id: 'agent-code-assistant',
    key: 'code-assistant',
    name: '代码辅助',
    description: '代码生成、排查与重构建议，提升研发交付效率。',
    category: '研发',
    icon: '</>',
    theme: 'cyan',
    permissionState: 'available',
    level: 'L1',
    scenarios: ['组件开发', '接口联调', '代码审查辅助'],
    launchUrl: agentLaunchUrls['code-assistant'],
  },
  {
    id: 'agent-interview-center',
    key: 'interview-center',
    name: '面试中心',
    description: '统一进入招聘面试流程，支持候选人信息与面试安排管理。',
    category: '办公',
    icon: '面',
    theme: 'blue',
    permissionState: 'available',
    level: 'L1',
    scenarios: ['面试安排', '候选人管理', '招聘协同'],
    launchUrl: agentLaunchUrls['interview-center'],
  },
]

export const skills: SkillCatalogItem[] = [
  {
    id: 'skill-knowledge-search',
    name: '知识库检索',
    description: '跨制度、流程、FAQ 进行语义检索，并返回引用来源。',
    category: '文字',
    capabilityType: '知识检索',
    permissionState: 'available',
    relatedAgentKeys: ['policy-qa'],
    recommended: true,
  },
  {
    id: 'skill-meeting-summary',
    name: '会议纪要抽取',
    description: '从会议文本中提取结论、风险、负责人和待办时间。',
    category: '办公',
    capabilityType: '文本结构化',
    permissionState: 'available',
    relatedAgentKeys: ['meeting-notes'],
  },
  {
    id: 'skill-slide-outline',
    name: '汇报大纲生成',
    description: '根据主题、受众和素材生成汇报结构与页面要点。',
    category: '文字',
    capabilityType: '内容生成',
    permissionState: 'locked',
    relatedAgentKeys: ['ppt-creator'],
  },
  {
    id: 'skill-image-reading',
    name: '图文素材识别',
    description: '识别素材中的主体、文案、布局和可复用卖点。',
    category: '分析',
    capabilityType: '多模态分析',
    permissionState: 'available',
    relatedAgentKeys: ['image-analysis'],
  },
]

export function getAgentByKey(key: string) {
  return agents.find((agent) => agent.key === key)
}

export function getAgentsByCategory(category: AgentCategory | '全部') {
  if (category === '全部') return agents
  return agents.filter((agent) => agent.category === category)
}

export function getSkillsByCategory(category: SkillCategory | '全部') {
  if (category === '全部') return skills
  return skills.filter((skill) => skill.category === category)
}
