import type { Router } from 'vue-router'
import type { Component } from 'vue'
import IconBox from '~icons/lucide/box'
import IconCode from '~icons/lucide/code'
import IconCompass from '~icons/lucide/compass'
import IconFileText from '~icons/lucide/file-text'
import IconImage from '~icons/lucide/image'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconPresentation from '~icons/lucide/presentation'
import IconUsers from '~icons/lucide/users'

export type DashboardTool = {
  name: string
  icon: Component
  tone: string
  routeName?: string
  agentKey?: string
  isMore?: boolean
}

export type DashboardToolTarget = Pick<DashboardTool, 'routeName' | 'agentKey' | 'isMore'>

export const dashboardTools: DashboardTool[] = [
  { name: '图文分析', icon: IconImage, tone: 'orange', agentKey: 'image-analysis' },
  { name: '办事咨询', icon: IconMessageCircle, tone: 'blue', routeName: 'LeaderBoard' },
  { name: '会议纪要', icon: IconFileText, tone: 'green', agentKey: 'meeting-notes' },
  { name: 'PPT创作', icon: IconPresentation, tone: 'violet', agentKey: 'ppt-creator' },
  { name: '智体工坊', icon: IconBox, tone: 'purple', agentKey: 'agent-workshop' },
  { name: '代码辅助', icon: IconCode, tone: 'cyan', agentKey: 'code-assistant' },
  { name: '面试中心', icon: IconUsers, tone: 'sky', agentKey: 'interview-center' },
  { name: '更多工具', icon: IconCompass, tone: 'slate', isMore: true },
]

export function navigateDashboardTool(router: Router, tool: DashboardToolTarget) {
  if (tool.routeName) {
    return router.push({ name: tool.routeName })
  }

  if (tool.agentKey) {
    return router.push({
      name: 'AgentCenter',
      query: { agent: tool.agentKey },
    })
  }

  if (tool.isMore) {
    return router.push({ name: 'AgentCenter' })
  }

  return Promise.resolve()
}
