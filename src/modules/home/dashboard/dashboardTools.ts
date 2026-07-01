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

export type DashboardTool = {
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

export const homePanelTools: DashboardTool[] = [
  {
    name: '图文分析',
    icon: IconImage,
    tone: 'orange',
    externalUrl: agentLaunchUrls['image-analysis'],
  },
  {
    name: '力宝百问',
    icon: IconMessageCircle,
    tone: 'blue',
    externalUrl: agentLaunchUrls['policy-qa'],
  },
  {
    name: '会议纪要',
    icon: IconFileText,
    tone: 'green',
    externalUrl: agentLaunchUrls['meeting-notes'],
  },
  {
    name: 'PPT创作',
    icon: IconPresentation,
    tone: 'violet',
    externalUrl: agentLaunchUrls['ppt-creator'],
  },
  { name: '更多工具', icon: IconCompass, tone: 'slate', isMore: true },
]

export const dashboardTools: DashboardTool[] = [
  {
    name: '图文分析',
    icon: IconImage,
    tone: 'orange',
    externalUrl: agentLaunchUrls['image-analysis'],
  },
  {
    name: '力宝百问',
    icon: IconMessageCircle,
    tone: 'blue',
    externalUrl: agentLaunchUrls['policy-qa'],
  },
  {
    name: '会议纪要',
    icon: IconFileText,
    tone: 'green',
    externalUrl: agentLaunchUrls['meeting-notes'],
  },
  {
    name: '智能PPT',
    icon: IconPresentation,
    tone: 'violet',
    externalUrl: agentLaunchUrls['ppt-creator'],
  },
  {
    name: '智体工坊',
    icon: IconBox,
    tone: 'purple',
    externalUrl: agentLaunchUrls['agent-workshop'],
  },
  {
    name: '代码辅助',
    icon: IconCode,
    tone: 'cyan',
    externalUrl: agentLaunchUrls['code-assistant'],
  },
  {
    name: '面试中心',
    icon: IconUsers,
    tone: 'sky',
    externalUrl: agentLaunchUrls['interview-center'],
  },
  { name: '更多工具', icon: IconCompass, tone: 'slate', isMore: true },
]

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
