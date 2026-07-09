import type { SysMessage } from './sys-message.service'

export function mergeSysMessages(
  currentMessages: SysMessage[],
  incomingMessages: SysMessage[],
  options: { prepend?: boolean } = {},
) {
  const nextMessages = options.prepend
    ? [...incomingMessages, ...currentMessages]
    : [...currentMessages, ...incomingMessages]
  const seen = new Set<string>()

  return nextMessages.filter((message) => {
    if (seen.has(message.id)) return false
    seen.add(message.id)
    return true
  })
}

export function markSysMessageIdsReadInList(messages: SysMessage[], ids: Array<string | number>) {
  const idSet = new Set(ids.map((id) => String(id)))

  return messages.map((message) =>
    idSet.has(message.id) || idSet.has(String(message.rawId))
      ? {
          ...message,
          msgStatus: 1 as const,
          readTime: message.readTime ?? new Date().toISOString(),
        }
      : message,
  )
}

export function markAllSysMessagesReadInList(messages: SysMessage[]) {
  const readTime = new Date().toISOString()

  return messages.map((message) => ({
    ...message,
    msgStatus: 1 as const,
    readTime: message.readTime ?? readTime,
  }))
}

export function removeSysMessageIdsFromList(messages: SysMessage[], ids: Array<string | number>) {
  const idSet = new Set(ids.map((id) => String(id)))

  return messages.filter((message) => !idSet.has(message.id) && !idSet.has(String(message.rawId)))
}

export function countUnreadSysMessages(messages: SysMessage[]) {
  return messages.filter((message) => message.msgStatus === 0).length
}

export function hasSysMessage(messages: SysMessage[], id: string | number) {
  const normalizedId = String(id)
  return messages.some(
    (message) => message.id === normalizedId || String(message.rawId) === normalizedId,
  )
}
