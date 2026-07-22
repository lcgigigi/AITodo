import { describe, expect, it } from 'vitest'
import { agentLaunchUrls } from './links'
import { agents, getAgentByKey } from './mock'

describe('agent center catalog', () => {
  it('only exposes L1 agents and omits the agent workshop entry', () => {
    expect(agents.every((agent) => agent.level === 'L1')).toBe(true)
    expect(getAgentByKey('agent-workshop')).toBeUndefined()
  })

  it('only skips token handoff for meeting notes and interview center', () => {
    const directLaunchKeys = agents
      .filter((agent) => agent.requiresToken === false)
      .map((agent) => agent.key)

    expect(directLaunchKeys).toEqual(['meeting-notes', 'interview-center'])
  })

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
