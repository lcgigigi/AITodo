export type AgentLevel = 'L1' | 'L2' | 'L3' | 'L4'

export type PermissionState = 'available' | 'locked' | 'admin-only'

export type AgentStatus = 'online' | 'beta' | 'maintenance' | 'draft'

export type SkillStatus = 'ready' | 'beta' | 'maintenance'

export interface AgentEntry {
  id: string
  name: string
  description: string
  level: AgentLevel
  category: string
  status: AgentStatus
  owner: string
  usageCount: number
  updatedAt: string
  permissionState: PermissionState
  skillIds: string[]
  scenarios: string[]
  inputExample: string
  outputExample: string
  recommended?: boolean
}

export interface SkillEntry {
  id: string
  name: string
  description: string
  capabilityType: string
  callableByAgentIds: string[]
  callType: string
  status: SkillStatus
  owner: string
  updatedAt: string
  permissionState: PermissionState
  boundary: string
  recommended?: boolean
}
