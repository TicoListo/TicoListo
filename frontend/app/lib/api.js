const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:8000"
    : process.env.NODE_ENV === "production" ? "/api" : "http://localhost:8000");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Unable to complete the request.");
  }

  return response.status === 204 ? null : response.json();
}

export function registerAccount(payload) {
  return request("/auth-register", { method: "POST", body: JSON.stringify(payload) });
}

export function loginAccount(payload) {
  return request("/auth-login", { method: "POST", body: JSON.stringify(payload) });
}

export function getCurrentUser() {
  return request("/auth-me");
}

export function logoutAccount() {
  return request("/auth-logout", { method: "POST" });
}

export function getMyAssistanceRequests() {
  return request("/my-requests");
}

export function getServices() {
  return request("/services");
}

export function getCategoryTheme() {
  return request("/site-config/category-theme");
}

export function createAssistanceRequest(payload) {
  return request("/assistance-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getChatMessages(token, sinceId = 0) {
  return request(`/chat-token/${encodeURIComponent(token)}?since_id=${sinceId}`);
}

export function sendChatMessage(token, message) {
  return request(`/chat-token/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// Administrative requests keep the key in the caller (sessionStorage); this
// helper centralizes the same JSON/error behavior as the public API helpers.
export function adminRequest(path, adminKey, options = {}) {
  return request(path, {
    ...options,
    headers: { "X-Admin-Key": adminKey, ...(options.headers || {}) },
  });
}
