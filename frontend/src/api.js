const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('di_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),
  register: (token, name, password) => request('POST', '/auth/register', { token, name, password }),
  forgotPassword: (email) => request('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, password) => request('POST', '/auth/reset-password', { token, password }),

  // Invites
  sendInvite: (email, role) => request('POST', '/invites', { email, role }),
  getInvites: () => request('GET', '/invites'),
  revokeInvite: (id) => request('DELETE', `/invites/${id}`),
  validateInvite: (token) => request('GET', `/invites/validate/${token}`),

  // Users (admin)
  getUsers: () => request('GET', '/users'),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
};
