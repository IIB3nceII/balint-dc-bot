export type RequestBody = { binary: ArrayBuffer } | Record<string, unknown>

export function requestOptions(
  method: string,
  headers: Record<string, string>,
  body?: RequestBody,
): RequestInit {
  const options: RequestInit = { method, headers }
  if (body !== undefined) {
    if ('binary' in body && body.binary instanceof ArrayBuffer) {
      options.body = body.binary
    } else {
      options.body = JSON.stringify(body)
      options.headers = { ...headers, 'content-type': 'application/json' }
    }
  }
  return options
}
