import { describe, expect, it } from 'vitest'
import { dashboardTools, homePanelTools, toDashboardToolTarget } from '../dashboard/config/dashboardTools'

describe('dashboardTools catalog', () => {
  it('uses the same display names for shared tools in both docks', () => {
    const detailNames = new Map(dashboardTools.map((tool) => [tool.id, tool.name]))

    for (const tool of homePanelTools) {
      expect(detailNames.get(tool.id)).toBe(tool.name)
    }
  })

  it('names the ppt tool consistently as 智能PPT', () => {
    const pptInHome = homePanelTools.find((tool) => tool.id === 'ppt-creator')
    const pptInDetail = dashboardTools.find((tool) => tool.id === 'ppt-creator')

    expect(pptInHome?.name).toBe('智能PPT')
    expect(pptInDetail?.name).toBe('智能PPT')
  })

  it('maps catalog entries to navigation targets consistently', () => {
    const tool = dashboardTools[0]

    expect(toDashboardToolTarget(tool)).toEqual({
      routeName: tool.routeName,
      agentKey: tool.agentKey,
      externalUrl: tool.externalUrl,
      isMore: tool.isMore,
    })
  })
})
