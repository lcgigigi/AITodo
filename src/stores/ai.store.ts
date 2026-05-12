import { defineStore } from 'pinia'

export const useAiStore = defineStore('ai', {
  state: () => ({
    currentModel: 'default',
    currentAgentCode: 'workbench-assistant',
    streaming: false,
    conversationId: '',
  }),
  actions: {
    setCurrentModel(modelCode: string) {
      this.currentModel = modelCode
    },
    setCurrentAgent(agentCode: string) {
      this.currentAgentCode = agentCode
    },
    setStreaming(streaming: boolean) {
      this.streaming = streaming
    },
    setConversation(conversationId: string) {
      this.conversationId = conversationId
    },
  },
})
