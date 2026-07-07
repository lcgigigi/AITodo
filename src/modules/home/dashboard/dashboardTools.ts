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
import { agentLaunchUrls, openUrlInNewTab } from '@/modules/agent-center/links'

export type DashboardToolId =
  | 'image-analysis'
  | 'policy-qa'
  | 'meeting-notes'
  | 'ppt-creator'
  | 'agent-workshop'
  | 'code-assistant'
  | 'interview-center'
  | 'more'

export type DashboardTool = {
  id: DashboardToolId
  name: string
  icon: Component
  tone: string
  routeName?: string
  agentKey?: string
  externalUrl?: string
  isMore?: boolean
}

export type DashboardToolTarget = Pick<
  DashboardTool,
  'routeName' | 'agentKey' | 'externalUrl' | 'isMore'
>

const dashboardToolCatalog: Record<DashboardToolId, DashboardTool> = {
  'image-analysis': {
    id: 'image-analysis',
    name: '图文分析',
    icon: IconImage,
    tone: 'orange',
    externalUrl: agentLaunchUrls['image-analysis'],
  },
  'policy-qa': {
    id: 'policy-qa',
    name: '力宝百问',
    icon: IconMessageCircle,
    tone: 'blue',
    externalUrl: agentLaunchUrls['policy-qa'],
  },
  'meeting-notes': {
    id: 'meeting-notes',
    name: '会议纪要',
    icon: IconFileText,
    tone: 'green',
    externalUrl: agentLaunchUrls['meeting-notes'],
  },
  'ppt-creator': {
    id: 'ppt-creator',
    name: '智能PPT',
    icon: IconPresentation,
    tone: 'violet',
    externalUrl: agentLaunchUrls['ppt-creator'],
  },
  'agent-workshop': {
    id: 'agent-workshop',
    name: '智体工坊',
    icon: IconBox,
    tone: 'purple',
    externalUrl: agentLaunchUrls['agent-workshop'],
  },
  'code-assistant': {
    id: 'code-assistant',
    name: '代码辅助',
    icon: IconCode,
    tone: 'cyan',
    externalUrl: agentLaunchUrls['code-assistant'],
  },
  'interview-center': {
    id: 'interview-center',
    name: '面试中心',
    icon: IconUsers,
    tone: 'sky',
    externalUrl: agentLaunchUrls['interview-center'],
  },
  more: {
    id: 'more',
    name: '更多工具',
    icon: IconCompass,
    tone: 'slate',
    isMore: true,
  },
}

const HOME_PANEL_TOOL_IDS: DashboardToolId[] = [
  'policy-qa',
  'image-analysis',
  'meeting-notes',
  'ppt-creator',
  'more',
]

const DASHBOARD_TOOL_IDS: DashboardToolId[] = [
  'image-analysis',
  'policy-qa',
  'meeting-notes',
  'ppt-creator',
  'agent-workshop',
  'code-assistant',
  'interview-center',
  'more',
]

function pickDashboardTools(ids: DashboardToolId[]) {
  return ids.map((id) => dashboardToolCatalog[id])
}

export const homePanelTools = pickDashboardTools(HOME_PANEL_TOOL_IDS)
export const dashboardTools = pickDashboardTools(DASHBOARD_TOOL_IDS)

export function navigateDashboardTool(router: Router, tool: DashboardToolTarget) {
  if (tool.externalUrl) {
    openUrlInNewTab(tool.externalUrl)
    return Promise.resolve()
  }

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
