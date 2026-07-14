export const agentLaunchUrls = {
  'policy-qa': 'http://10.8.7.57:5500/dataNew',
  'meeting-notes': 'https://hlai-minutes.hlmc.cn:3000/meeting-minutes',
  'image-analysis': 'http://10.8.7.57:5500/analysisNew',
  'ppt-creator': 'http://10.8.7.57:5500/aippt',
  'interview-center': 'https://hrcenter.hlmc.cn/login?redirect=/',
  'code-assistant': 'http://10.8.7.57:5500/aicode',
  'compliance-assistant': 'http://10.8.7.57:5500/inspection',
  'agent-workshop': 'http://10.8.7.57:5500/agent/center',
  'party-affairs': 'http://10.8.2.21:5500/agent/chat/new?agentId=17',
  'policy-consulting': 'http://10.8.2.21:5500/agent/chat/new?agentId=19',
} as const

export function openUrlInNewTab(url: string) {
  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
  if (openedWindow) openedWindow.opener = null
}
