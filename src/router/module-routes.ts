import type { RouteRecordRaw } from 'vue-router'
import { workbenchRoutes } from '@/modules/workbench/routes'
import { agendaRoutes } from '@/modules/agenda/routes'
import { aiAgentRoutes } from '@/modules/ai-agent/routes'
import { aiChatRoutes } from '@/modules/ai-chat/routes'
import { aiImageRoutes } from '@/modules/ai-image/routes'
import { aiDocRoutes } from '@/modules/ai-doc/routes'
import { knowledgeBaseRoutes } from '@/modules/knowledge-base/routes'
import { approvalRoutes } from '@/modules/approval/routes'
import { projectRoutes } from '@/modules/project/routes'
import { meetingRoutes } from '@/modules/meeting/routes'
import { systemRoutes } from '@/modules/system/routes'

export const moduleRoutes: RouteRecordRaw[] = [
  ...workbenchRoutes,
  ...agendaRoutes,
  ...aiAgentRoutes,
  ...aiChatRoutes,
  ...aiImageRoutes,
  ...aiDocRoutes,
  ...knowledgeBaseRoutes,
  ...approvalRoutes,
  ...projectRoutes,
  ...meetingRoutes,
  ...systemRoutes,
]
