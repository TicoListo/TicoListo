"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const statuses = [
  ["all", "Todos"], ["new", "Nueva"], ["contacted", "Contactado"],
  ["waiting_documents", "Esperando documentos"], ["documents_received", "Documentos recibidos"],
  ["in_progress", "En trámite"], ["waiting_institution", "Esperando institución"],
  ["correction_required", "Requiere corrección"], ["completed", "Finalizado"],
];
const statusLabels = Object.fromEntries(statuses);

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [requests, setRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [note, setNote] = useState("");
  const [manager, setManager] = useState("");
  const [error, setError] = useState("");
  const selected = requests.find((item) => item.id === selectedId) || null;

  const visibleRequests = useMemo(
    () => filter === "all" ? requests : requests.filter((item) => item.status === filter),
    [filter, requests],
  );

  async function adminFetch(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "X-Admin-Key": key, ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "No se pudo completar la acción.");
    return response.status === 204 ? null : response.json();
  }

  async function loadRequests() {
    setError("");
    try {
      const items = await adminFetch("/admin/assistance-requests");
      setRequests(items);
      if (!selectedId && items[0]) setSelectedId(items[0].id);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function loadMessages(requestId) {
    try {
      setMessages(await adminFetch(`/admin/assistance-requests/${requestId}/messages`));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("ticolisto-admin-key") || "";
    setKey(savedKey);
  }, []);

  useEffect(() => {
    if (key) loadRequests();
  }, [key]);

  useEffect(() => {
    if (selected) {
      setManager(selected.assigned_to || "");
      loadMessages(selected.id);
    }
  }, [selectedId, requests]);

  function saveKey(event) {
    event.preventDefault();
    window.sessionStorage.setItem("ticolisto-admin-key", key);
    loadRequests();
  }

  async function updateCase(changes) {
    if (!selected) return;
    try {
      const updated = await adminFetch(`/admin/assistance-requests/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setRequests((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    try {
      await adminFetch(`/admin/assistance-requests/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ author: "Administrador", message: note.trim() }),
      });
      setNote("");
      loadMessages(selected.id);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="page-shell admin-page">
      <div className="admin-heading">
        <div><p className="eyebrow">Operaciones</p><h1>Panel administrativo</h1><p>Consulta cada caso, revisa los datos del cliente y registra el seguimiento.</p></div>
        <a href="/" className="admin-back">← Ver sitio público</a>
      </div>
      <form onSubmit={saveKey} className="admin-login">
        <label htmlFor="admin-key">Clave de acceso<input id="admin-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="X-Admin-Key" /></label>
        <button className="primary" type="submit">Entrar</button>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
      {key && !error && <div className="admin-workspace">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-head"><h2>Solicitudes</h2><span>{visibleRequests.length}</span></div>
          <div className="admin-filters">{statuses.map(([value, label]) => <button key={value} className={filter === value ? "admin-filter active" : "admin-filter"} onClick={() => setFilter(value)}>{label}<span>{value === "all" ? requests.length : requests.filter((item) => item.status === value).length}</span></button>)}</div>
          <div className="admin-cases">
            {visibleRequests.map((item) => <button key={item.id} className={selected?.id === item.id ? "admin-case selected" : "admin-case"} onClick={() => setSelectedId(item.id)}><strong>#{item.id} · {item.name}</strong><span>{item.category}</span><small>{statusLabels[item.status]}</small></button>)}
            {!visibleRequests.length && <p>No hay solicitudes en este estado.</p>}
          </div>
        </aside>
        <section className="admin-detail">
          {selected ? <><div className="detail-header"><div><p className="eyebrow">Solicitud #{selected.id}</p><h2>{selected.name}</h2><p className="detail-subtitle">{selected.category}</p></div><span className={`status-pill status-${selected.status}`}>{statusLabels[selected.status]}</span></div>
            <div className="client-grid"><div><span>Correo electrónico</span><a href={`mailto:${selected.email}`}>{selected.email}</a></div><div><span>Teléfono</span><a href={`tel:${selected.phone}`}>{selected.phone}</a></div><div><span>Ubicación</span><strong>{selected.location}</strong></div><div><span>Gestor asignado</span><strong>{selected.assigned_to || "Sin asignar"}</strong></div></div>
            <div className="detail-block"><h3>Necesidad del cliente</h3><p className="client-description">{selected.description}</p></div>
            <div className="detail-actions"><label>Estado<select value={selected.status} onChange={(event) => updateCase({ status: event.target.value })}>{statuses.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Asignar gestor<input value={manager} onChange={(event) => setManager(event.target.value)} onBlur={() => updateCase({ assigned_to: manager || null })} placeholder="Nombre del gestor" /></label></div>
            <div className="detail-block"><h3>Seguimiento y comunicación</h3><div className="message-list">{messages.map((item) => <div className="message-item" key={item.id}><strong>{item.author}</strong><p>{item.message}</p></div>)}{!messages.length && <p className="muted">Todavía no hay notas de seguimiento.</p>}</div><form className="message-form" onSubmit={addNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escribe una nota o actualización del caso..." required /><button className="primary" type="submit">Guardar seguimiento</button></form></div>
          </> : <div className="empty-admin"><h2>Selecciona una solicitud</h2><p>Elige un caso de la lista para ver toda la información del cliente.</p></div>}
        </section>
      </div>}
    </main>
  );
}
