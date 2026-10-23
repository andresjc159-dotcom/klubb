export function getToken(): string | null {
  return localStorage.getItem('klubb_token');
}

export function setToken(token: string) {
  localStorage.setItem('klubb_token', token);
}

export function clearToken() {
  localStorage.removeItem('klubb_token');
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/staff/login';
    throw new Error('No autorizado');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Error de servidor');
  }

  return res.json();
}
