import { defineStore } from 'pinia'
import type { AiAgent, AiConversation, AiMessage } from '../types/agent.types'

export const useAgentStore = defineStore('agent', {
  state: () => ({
    agents: [] as AiAgent[],
    conversations: [] as AiConversation[],
    messages: [] as AiMessage[],
  }),
  actions: {
    setAgents(agents: AiAgent[]) {
      this.agents = agents
    },
    setConversations(conversations: AiConversation[]) {
      this.conversations = conversations
    },
    appendMessage(message: AiMessage) {
      this.messages.push(message)
    },
  },
})
