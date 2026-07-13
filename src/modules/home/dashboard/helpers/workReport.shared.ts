import {
  loadLatestWorkSummary,
  type WorkReportSource,
} from '@/modules/home/dashboard/services/todo.service'

export async function fetchWorkReportText() {
  const report = await loadLatestWorkSummary()

  if (typeof report === 'string') return report

  return report
    .map((scene) => [scene.title, scene.content, scene.summary].filter(Boolean).join('\n'))
    .join('\n\n')
}

export function fetchWorkReportStorySource(): Promise<WorkReportSource> {
  return loadLatestWorkSummary()
}
