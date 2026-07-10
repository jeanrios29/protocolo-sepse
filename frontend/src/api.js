const TOKEN_KEY = "sepse-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = new Error(data?.error || "Erro inesperado. Tente novamente.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  authStatus: () => request("/auth/status", { auth: false }),
  bootstrap: (password) => request("/auth/bootstrap", { method: "POST", body: { password }, auth: false }),
  login: (crm, senha) => request("/auth/login", { method: "POST", body: { crm, senha }, auth: false }),
  me: () => request("/auth/me"),

  criterios: () => request("/fichas/criterios"),
  focos: () => request("/fichas/focos"),
  antibioticos: () => request("/fichas/antibioticos"),
  createFicha: (payload) => request("/fichas", { method: "POST", body: payload }),
  listFichas: (params) => request(`/fichas?${new URLSearchParams(params)}`),
  fichaDetail: (id) => request(`/fichas/${id}`),
  exportFichas: (params) => request(`/fichas/export/data?${new URLSearchParams(params)}`),

  users: () => request("/users"),
  createUser: (payload) => request("/users", { method: "POST", body: payload }),
  toggleUserActive: (crm) => request(`/users/${encodeURIComponent(crm)}/active`, { method: "PATCH" }),
  resetUserPassword: (crm, novaSenha) =>
    request(`/users/${encodeURIComponent(crm)}/password`, { method: "PATCH", body: { novaSenha } }),

  painel: (de, ate) => request(`/analytics/painel?${new URLSearchParams({ de, ate })}`),
  statsSummary: () => request("/stats/summary"),
};
