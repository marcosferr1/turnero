const TOKEN_KEY = 'turnero_token'

/** Vacío en local: Vite proxyea /api → backend. En Vercel/Railway: URL pública del backend. */
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(apiUrl(path), { ...options, headers })
  if (res.status === 401 && !path.includes('/auth/login')) {
    setToken(null)
    window.location.href = '/login'
    throw new ApiError(401, 'Sesión expirada')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error || 'Error en la solicitud')
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Peticiones públicas (sin token, sin redirección a login). */
export const publicApi = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(apiUrl(path), { headers: { 'Content-Type': 'application/json' } })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(res.status, body.error || 'Error en la solicitud')
    return body as T
  },
}
