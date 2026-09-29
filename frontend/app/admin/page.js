"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  async function loadRequests() {
    setError("");
    const response = await fetch(`${API_URL}/admin/assistance-requests`, {
      headers: { "X-Admin-Key": key },
    });
    if (!response.ok) {
      setError("Clave administrativa inválida o API no disponible.");
      return;
    }
    setRequests(await response.json());
  }

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("ticolisto-admin-key") || "";
    setKey(savedKey);
  }, []);

  function saveKey(event) {
    event.preventDefault();
    window.sessionStorage.setItem("ticolisto-admin-key", key);
    loadRequests();
  }

  return (
    <main className="page-shell admin-page">
      <p className="eyebrow">Operaciones</p>
      <h1>Panel administrativo</h1>
      <p>Procesa solicitudes, asigna gestores y prepara publicaciones.</p>
      <form onSubmit={saveKey} className="admin-login">
        <label htmlFor="admin-key">Clave de acceso</label>
        <input id="admin-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} />
        <button className="primary-button" type="submit">Entrar</button>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
      <section className="admin-list">
        <h2>Solicitudes recientes</h2>
        {requests.map((item) => (
          <article key={item.id} className="admin-card">
            <strong>#{item.id} · {item.category}</strong>
            <span>{item.name} · {item.email}</span>
            <span>Estado: {item.status}{item.assigned_to ? ` · Gestor: ${item.assigned_to}` : ""}</span>
          </article>
        ))}
        {key && !requests.length && !error && <p>No hay solicitudes para mostrar.</p>}
      </section>
    </main>
  );
}
