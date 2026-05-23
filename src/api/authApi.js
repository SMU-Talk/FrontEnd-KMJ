import { apiRequest, clearAccessToken, isApiConfigured, setAccessToken } from './client.js';

export async function loginWithSmu({ id, password }) {
  if (!isApiConfigured()) {
    await wait(300);
    return { id, nickname: id };
  }

  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { user_id: id, password },
  });
  setAccessToken(data.access_token);
  return data.user;
}

export async function restoreLogin() {
  if (!isApiConfigured()) return null;

  try {
    return await apiRequest('/auth/me');
  } catch {
    clearAccessToken();
    return null;
  }
}

export async function refreshLogin() {
  if (!isApiConfigured()) return null;

  const data = await apiRequest('/auth/refresh', { method: 'POST' });
  setAccessToken(data.access_token);
  return data.user;
}

export async function logoutFromApi() {
  if (isApiConfigured()) {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Client-side logout should still complete even if the network request fails.
    }
  }
  clearAccessToken();
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
