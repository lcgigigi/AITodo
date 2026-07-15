const MAX_USER_MESSAGE_LENGTH = 180

const TECHNICAL_ERROR_PATTERNS = [
  /#{2,}\s*(?:error|cause|sql)/i,
  /(?:java|javax|jakarta|org\.springframework|com\.ruoyi)\.[\w.$]*(?:exception|error)/i,
  /(?:sqlsyntax|badsqlgrammar|dataaccess|mybatis|ibatis|jdbc).*exception/i,
  /(?:unknown column|unknown table|table .* doesn't exist|syntax error).*?(?:field list|sql|query|database)?/i,
  /(?:select|insert|update|delete)\s+[\s\S]+\s(?:from|into|set|where)\s/i,
  /(?:mapper|jar:file:|\/boot-inf\/|\.xml\]).*?(?:sql|exception|error)/i,
  /(?:caused by:|nested exception|stack trace|\bat\s+[\w.$]+\([^)]*:\d+\))/i,
  /(?:ora|sqlstate|psql|mysql|postgresql)-?\d+/i,
  /<\/?(?:html|body|head|script|style|title)\b/i,
]

function normalizeMessage(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isTechnicalBackendMessage(value: unknown) {
  const message = normalizeMessage(value)

  if (!message) return false
  if (message.length > MAX_USER_MESSAGE_LENGTH) return true
  if (message.includes('\n') || message.includes('\r')) return true

  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

export function getSafeBackendMessage(value: unknown, fallbackMessage: string) {
  const message = normalizeMessage(value)
  const fallback = fallbackMessage.trim() || '请求失败，请稍后再试'

  if (!message || isTechnicalBackendMessage(message)) {
    return fallback
  }

  return message
}
