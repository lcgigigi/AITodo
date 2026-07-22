/** 除 admin 角色外，额外允许查看心声收件箱的工号白名单 */
export const SUGGESTION_INBOX_VIEWER_IDS = ['1102080'] as const

export function isSuggestionInboxViewer(userId: string | undefined | null): boolean {
  if (!userId) return false
  return (SUGGESTION_INBOX_VIEWER_IDS as readonly string[]).includes(userId)
}
