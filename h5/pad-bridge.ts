interface PadUserInfoResult {
  loginName?: string
  errMsg?: string
}

interface PadBridge {
  config?: {
    getUserInfo?: (options: {
      success: (result: PadUserInfoResult) => void
      fail: (result: PadUserInfoResult) => void
    }) => void
  }
}

declare global {
  interface Window {
    mbs?: PadBridge
  }
}

const BRIDGE_WAIT_TIMEOUT_MS = 3_000
const BRIDGE_POLL_INTERVAL_MS = 100

function waitForPadBridge() {
  return new Promise<PadBridge | null>((resolve) => {
    const startedAt = Date.now()

    function check() {
      if (window.mbs) {
        resolve(window.mbs)
        return
      }

      if (Date.now() - startedAt >= BRIDGE_WAIT_TIMEOUT_MS) {
        resolve(null)
        return
      }

      window.setTimeout(check, BRIDGE_POLL_INTERVAL_MS)
    }

    check()
  })
}

/** 通过 PAD WebView 注入的 UU Bridge 获取当前账号工号。 */
export async function getPadAccount() {
  const bridge = await waitForPadBridge()
  if (!bridge) {
    throw new Error('未检测到 PAD 登录环境，请从移动端工作台打开')
  }

  const getUserInfo = bridge.config?.getUserInfo
  if (typeof getUserInfo !== 'function') {
    throw new Error('当前 PAD 版本不支持获取账号信息')
  }

  return new Promise<string>((resolve, reject) => {
    try {
      getUserInfo({
        success(result) {
          const loginName = result.loginName?.trim()
          if (!loginName) {
            reject(new Error('PAD 未返回当前用户工号'))
            return
          }
          resolve(loginName)
        },
        fail(result) {
          reject(new Error(result.errMsg?.trim() || '获取 PAD 账号失败'))
        },
      })
    } catch (error) {
      reject(error instanceof Error ? error : new Error('调用 PAD 账号能力失败'))
    }
  })
}
