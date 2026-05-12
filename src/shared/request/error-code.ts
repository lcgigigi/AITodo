export const ERROR_CODE_MESSAGE: Record<number, string> = {
  400: '请求参数错误',
  401: '登录状态已过期',
  403: '没有访问权限',
  404: '请求资源不存在',
  500: '服务异常，请稍后再试',
}

export function getErrorMessage(code?: number, fallback = '请求失败') {
  if (!code) {
    return fallback
  }

  return ERROR_CODE_MESSAGE[code] || fallback
}
