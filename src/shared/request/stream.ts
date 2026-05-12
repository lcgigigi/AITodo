export async function createFetchStream(url: string, init?: RequestInit) {
  const response = await fetch(url, init)

  if (!response.ok || !response.body) {
    throw new Error('流式请求创建失败')
  }

  return response.body.getReader()
}
