/**
 * 待办变更失败时，全局请求拦截器已经负责用户提示。
 * 页面只关心操作是否成功，并在成功后按各自原有顺序更新本地 UI 状态。
 */
export async function runDashboardTodoAction(action: () => Promise<unknown>) {
  try {
    await action()
    return true
  } catch {
    return false
  }
}
