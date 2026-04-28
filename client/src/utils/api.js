const BASE_URL = '/api/v1';

function getToken() {
  return localStorage.getItem('opera_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({ success: false, data: null, error: 'Réponse invalide' }));

  if (!res.ok || !json.success) {
    throw new Error(json.error || `Erreur ${res.status}`);
  }

  return json.data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),

  uploadImage: async (operationId, file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${BASE_URL}/operations/${operationId}/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }
};
