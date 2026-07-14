import { describe, expect, it } from 'vitest'
import { agentLaunchUrls } from './links'
import { getAgentByKey } from './mock'

describe('agent center catalog', () => {
  it.each([
    ['party-affairs', '党务工作智能体', 'http://10.8.2.21:5500/agent/chat/new?agentId=17'],
    ['policy-consulting', '政策咨询智能体', 'http://10.8.2.21:5500/agent/chat/new?agentId=19'],
  ])('registers %s with its external launch URL', (key, name, launchUrl) => {
    expect(agentLaunchUrls[key as keyof typeof agentLaunchUrls]).toBe(launchUrl)
    expect(getAgentByKey(key)).toMatchObject({
      key,
      name,
      launchUrl,
      permissionState: 'available',
    })
  })
})
