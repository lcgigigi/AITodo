import { http } from '@/shared/request/http'
import type { AiAgent, AiMessage } from '../types/agent.types'

export function getAgents() {
  return http.get<AiAgent[]>('/ai/agents')
}

export function sendAgentMessage(agentId: string, content: string) {
  return http.post<AiMessage>('/ai/messages', { agentId, content })
}
