export interface AiAgent {
  id: string
  name: string
  code: string
  description: string
  icon?: string
  modelCode?: string
  promptId?: string
  enabled: boolean
}

export interface AiConversation {
  id: string
  title: string
  agentId?: string
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status: 'pending' | 'streaming' | 'done' | 'error'
  createdAt: string
}

export interface AiParsedTask {
  title: string
  deadline: string
  assigneeList: string[]
  reminderRule: string
  priority: 'low' | 'medium' | 'high'
  steps: string[]
}
