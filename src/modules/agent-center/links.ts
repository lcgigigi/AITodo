export const agentLaunchUrls = {
  'policy-qa': 'http://10.8.2.21:5500/dataNew',
  'meeting-notes': 'https://hlai-minutes.hlmc.cn:3000/meeting-minutes',
  'image-analysis': 'http://10.8.2.21:5500/analysisNew',
  'ppt-creator': 'http://10.8.2.21:5500/aippt',
  'interview-center': 'https://hrcenter.hlmc.cn/login?redirect=/',
  'code-assistant': 'http://10.8.2.21:5500/aicode',
  'compliance-assistant': 'http://10.8.2.21:5500/inspection',
  'agent-workshop': 'http://10.8.2.21:5500/agent/center',
  'party-affairs': 'http://10.8.2.21:5500/agent/chat/new?agentId=17',
  'policy-consulting': 'http://10.8.2.21:5500/agent/chat/new?agentId=19',
} as const

export function buildAgentSsoLaunchUrl(destinationUrl: string, token: string) {
  const destination = new URL(destinationUrl)
  const callbackUrl = new URL('/auth/sso/callback', destination.origin)
  const targetPath = `${destination.pathname}${destination.search}${destination.hash}`

  callbackUrl.hash = new URLSearchParams({
    token,
    redirect: targetPath,
  }).toString()

  return callbackUrl.toString()
}

export function openUrlInNewTab(url: string) {
  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
  if (openedWindow) openedWindow.opener = null
}
