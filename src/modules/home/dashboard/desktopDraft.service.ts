import { http } from '@/shared/request/http'
import type { CalendarEvent, CalendarTodoDraft } from './types'

export interface DesktopTodoDraftDetail {
  draftId: string
  rawText: string
  confidence: number
  needConfirm?: boolean
  status: 'pending' | 'confirmed'
  result: CalendarTodoDraft
}

export interface CreateFromDraftResponse {
  success: boolean
  event: CalendarEvent
}

export function getDesktopTodoDraft(draftId: string): Promise<DesktopTodoDraftDetail> {
  return http.get<DesktopTodoDraftDetail>(
    `/todo/draft/detail?draftId=${encodeURIComponent(draftId)}`,
  ) as Promise<DesktopTodoDraftDetail>
}

export function createTodoFromDesktopDraft(
  draftId: string,
  payload: CalendarTodoDraft,
): Promise<CreateFromDraftResponse> {
  return http.post<CreateFromDraftResponse, { draftId: string; payload: CalendarTodoDraft }>(
    '/todo/createFromDraft',
    {
      draftId,
      payload,
    },
  ) as Promise<CreateFromDraftResponse>
}
