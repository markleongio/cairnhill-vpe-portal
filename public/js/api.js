// public/js/api.js
// Thin fetch wrapper. All requests include credentials so the session
// cookie travels; all bodies/responses are JSON.

const API = (() => {
  async function req(method, path, body) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: {},
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch('/api' + path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `请求失败 (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => req('GET', path),
    post: (path, body) => req('POST', path, body || {}),
    put: (path, body) => req('PUT', path, body || {}),
    del: (path) => req('DELETE', path),
  };
})();
