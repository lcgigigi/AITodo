import { RequestError } from '@/shared/request/request-error'

const INVALID_CREDENTIAL_PATTERNS = [
  /用户名或密码/,
  /账号或密码/,
  /密码(?:错误|不正确)/,
  /用户不存在/,
  /账号不存在/,
]

const UNAVAILABLE_ACCOUNT_PATTERNS = [
  /账号(?:已)?(?:停用|禁用|锁定|冻结|过期)/,
  /用户(?:已)?(?:停用|禁用|锁定|冻结|过期)/,
]

const NETWORK_ERROR_PATTERNS = [
  /network error/i,
  /timeout/i,
  /failed to fetch/i,
  /econn(?:reset|refused)/i,
]

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message.trim() : String(error ?? '').trim()
}

export function getLoginErrorMessage(error: unknown) {
  const message = getErrorText(error)

  if (INVALID_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(message))) {
    return '账号或密码错误，请重新输入'
  }

  if (UNAVAILABLE_ACCOUNT_PATTERNS.some((pattern) => pattern.test(message))) {
    return '账号暂不可用，请联系管理员'
  }

  if (error instanceof RequestError) {
    if (error.status === 401 || error.code === 401) {
      return '账号或密码错误，请重新输入'
    }

    if (error.status === 429 || error.code === 429) {
      return '操作过于频繁，请稍后再试'
    }

    if (error.status === undefined) {
      return '网络连接异常，请检查网络后重试'
    }
  }

  if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return '网络连接异常，请检查网络后重试'
  }

  return '登录服务暂时不可用，请稍后再试'
}
