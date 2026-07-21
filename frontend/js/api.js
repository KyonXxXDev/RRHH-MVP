/* =============================================
   HRMS API Client — Fetch wrapper
   ============================================= */

const API_BASE = (() => {
  const { protocol, hostname, port } = window.location;
  if (protocol === 'file:') {
    return 'http://localhost:3001';
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  return ''; // Same origin when served by Express
})();

const api = {
  _getHeaders() {
    const token = localStorage.getItem('hrms_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  async _fetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...this._getHeaders(), ...options.headers }
      });

      if (res.status === 401) {
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_user');
        window.location.href = '/index.html';
        return;
      }

      const contentType = res.headers.get('content-type');
      const data = contentType && contentType.includes('json') ? await res.json() : await res.text();

      if (!res.ok) {
        throw new Error(data.error || data.message || `Error ${res.status}`);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
      }
      throw err;
    }
  },

  get(path, params = {}) {
    const qs = Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this._fetch(`${path}${qs}`);
  },

  post(path, body) {
    return this._fetch(path, { method: 'POST', body: JSON.stringify(body) });
  },

  put(path, body) {
    return this._fetch(path, { method: 'PUT', body: JSON.stringify(body) });
  },

  delete(path) {
    return this._fetch(path, { method: 'DELETE' });
  },

  // Convenience methods
  auth: {
    login: (email, password) => api.post('/api/auth/login', { email, password }),
    me: () => api.get('/api/auth/me'),
  },

  employees: {
    list: (params) => api.get('/api/employees', params),
    get: (id) => api.get(`/api/employees/${id}`),
    create: (data) => api.post('/api/employees', data),
    update: (id, data) => api.put(`/api/employees/${id}`, data),
    delete: (id) => api.delete(`/api/employees/${id}`),
    history: (id) => api.get(`/api/employees/${id}/history`),
    simpleList: () => api.get('/api/employees-list'),
  },

  areas: {
    list: () => api.get('/api/areas'),
  },

  positions: {
    list: (area_id) => api.get('/api/positions', area_id ? { area_id } : {}),
  },

  attendance: {
    list: (params) => api.get('/api/attendance', params),
    today: () => api.get('/api/attendance/today'),
    create: (data) => api.post('/api/attendance', data),
    update: (id, data) => api.put(`/api/attendance/${id}`, data),
    stats: (params) => api.get('/api/attendance/stats/summary', params),
  },

  permissions: {
    list: (params) => api.get('/api/permissions', params),
    create: (data) => api.post('/api/permissions', data),
    updateStatus: (id, action, rejection_reason) => api.put(`/api/permissions/${id}/status`, { action, rejection_reason }),
    delete: (id) => api.delete(`/api/permissions/${id}`),
  },

  vacations: {
    list: (params) => api.get('/api/vacations', params),
    create: (data) => api.post('/api/vacations', data),
    updateStatus: (id, action, rejection_reason) => api.put(`/api/vacations/${id}/status`, { action, rejection_reason }),
  },

  licenses: {
    list: (params) => api.get('/api/licenses', params),
    create: (data) => api.post('/api/licenses', data),
    updateStatus: (id, action) => api.put(`/api/licenses/${id}/status`, { action }),
  },

  reports: {
    dashboard: () => api.get('/api/reports/dashboard'),
    attendance: (params) => api.get('/api/reports/attendance', params),
    tardiness: (params) => api.get('/api/reports/tardiness', params),
    overtime: (params) => api.get('/api/reports/overtime', params),
    absenteeism: (params) => api.get('/api/reports/absenteeism', params),
  },
};
