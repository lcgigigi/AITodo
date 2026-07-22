import { describe, expect, it } from 'vitest'
import { buildAgentSsoLaunchUrl } from './links'

describe('agent center SSO launch URL', () => {
  it('passes the token in the fragment and preserves the target route', () => {
    const launchUrl = new URL(
      buildAgentSsoLaunchUrl('http://10.8.2.21:5500/agent/chat/new?agentId=17', 'token+value'),
    )
    const fragment = new URLSearchParams(launchUrl.hash.slice(1))

    expect(launchUrl.origin).toBe('http://10.8.2.21:5500')
    expect(launchUrl.pathname).toBe('/auth/sso/callback')
    expect(launchUrl.search).toBe('')
    expect(fragment.get('token')).toBe('token+value')
    expect(fragment.get('redirect')).toBe('/agent/chat/new?agentId=17')
  })
})
