export type CatalogSection = 'agents' | 'skills'

export type AgentCategory = '文字' | '办公' | '创作' | '研发' | '生活'

export type SkillCategory = '文字' | '分析' | '办公' | '研发' | '生活'

export type PermissionState = 'available' | 'locked' | 'admin-only'

export interface AgentCatalogItem {
  id: string
  key: string
  name: string
  description: string
  category: AgentCategory
  icon: string
  theme: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'pink' | 'cyan' | 'violet'
  permissionState: PermissionState
  scenarios: string[]
  recommended?: boolean
}

export interface SkillCatalogItem {
  id: string
  name: string
  description: string
  category: SkillCategory
  capabilityType: string
  permissionState: PermissionState
  relatedAgentKeys: string[]
  recommended?: boolean
}
