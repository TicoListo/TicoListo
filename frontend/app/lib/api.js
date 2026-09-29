const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Unable to complete the request.");
  }

  return response.json();
}

export function getServices() {
  return request("/services");
}

export function createAssistanceRequest(payload) {
  return request("/assistance-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getChatMessages(token) {
  return request(`/chat/${encodeURIComponent(token)}`);
}

export function sendChatMessage(token, message) {
  return request(`/chat/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
