import { loadLatestWorkSummary } from '@/modules/home/dashboard/services/todo.service'

export function fetchWorkReportText() {
  return loadLatestWorkSummary()
}
