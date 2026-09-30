"use client";

import { useEffect, useMemo, useState } from "react";
import { calendarDate, calendarPriorities, calendarStatuses, dateLabel, dueItems } from "../lib/calendar";

const emptyForm = { title: "", due_date: "", priority: "medium", status: "pending", request_id: "", notes: "" };
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function toDate(value) {
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

export default function CalendarWorkspace({ adminFetch, requests, onGoToClients }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState("month");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [events, setEvents] = useState([]);
  const [portals, setPortals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadWorkspace() {
    try {
      const portalData = await adminFetch("/admin/portals");
      setPortals(portalData || []);
    } catch { setPortals([]); }
    try {
      const taskData = await adminFetch("/admin/calendar/events");
      setEvents((taskData || []).map((task) => ({ ...task, due_date: task.due_at, requestName: requests.find((request) => request.id === task.request_id)?.name })));
    } catch { setEvents([]); }
  }

  useEffect(() => { loadWorkspace(); }, [requests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEvents = useMemo(() => events.filter((event) => {
    const text = `${event.title || ""} ${event.notes || ""} ${event.requestName || ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (priority === "all" || (event.priority || "medium") === priority)
      && (status === "all" || (event.status || "pending") === status);
  }), [events, priority, query, status]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > total ? null : calendarDate(cursor.getFullYear(), cursor.getMonth() + 1, day);
    });
  }, [cursor]);

  const metrics = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return {
      total: filteredEvents.length,
      overdue: filteredEvents.filter((item) => toDate(item.due_date) < now && item.status !== "completed").length,
      urgent: filteredEvents.filter((item) => item.priority === "high" && item.status !== "completed").length,
      portals: portals.filter((item) => item.status === "online" || item.status === "ok").length,
    };
  }, [filteredEvents, portals]);

  function eventsFor(day) { return filteredEvents.filter((event) => event.due_date?.slice(0, 10) === day); }
  function changeMonth(delta) { setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)); }
  function setField(name, value) { setForm((current) => ({ ...current, [name]: value })); }

  async function createEvent(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      if (!form.request_id) throw new Error("Selecciona un cliente para crear la actividad.");
      const payload = { title: form.title, due_at: `${form.due_date}T12:00:00`, status: form.status, priority: form.priority, variables: form.notes ? { notes: form.notes } : {} };
      const saved = await adminFetch(`/admin/assistance-requests/${Number(form.request_id)}/tasks`, { method: "POST", body: JSON.stringify(payload) });
      setEvents((current) => [...current, { ...saved, due_date: saved.due_at, requestName: requests.find((request) => request.id === Number(form.request_id))?.name }]); setForm(emptyForm); setNotice("Actividad creada en el calendario.");
    } catch (error) { setNotice(error.message || "No se pudo crear la actividad."); }
    finally { setBusy(false); }
  }

  async function loadDocuments(requestId) {
    setSelectedRequest(requestId);
    if (!requestId) return setDocuments([]);
    try {
      const [documentData, historyData] = await Promise.all([
        adminFetch(`/admin/assistance-requests/${requestId}/documents`),
        adminFetch(`/admin/assistance-requests/${requestId}/history`),
      ]);
      setDocuments(documentData || []); setHistory(historyData || []);
    } catch { setDocuments([]); setHistory([]); }
  }

  function exportCsv() {
    const rows = [["Actividad", "Fecha", "Prioridad", "Estado", "Cliente"], ...filteredEvents.map((item) => [item.title, item.due_date, item.priority, item.status, item.requestName || ""])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); link.download = "ticolisto-calendario.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  function printReport() { window.print(); }

  const list = view === "month" ? monthDays.flatMap((day) => day ? eventsFor(day) : []) : filteredEvents;
  return <section className="calendar-workspace">
    <div className="admin-heading calendar-workspace-heading"><div><p className="eyebrow">Operaciones y seguimiento</p><h2>📅 Centro de calendario administrativo</h2><p>Organiza vencimientos, citas y tareas por cliente desde una sola vista.</p></div><div className="calendar-header-actions"><button type="button" onClick={exportCsv}>↓ Exportar CSV</button><button type="button" onClick={printReport}>▣ Reporte</button><button type="button" onClick={onGoToClients}>Ir a clientes →</button></div></div>
    <div className="calendar-metrics"><div><strong>{metrics.total}</strong><span>Actividades filtradas</span></div><div><strong>{metrics.overdue}</strong><span>Vencidas</span></div><div><strong>{metrics.urgent}</strong><span>Prioridad alta</span></div><div><strong>{metrics.portals}</strong><span>Portales verificados</span></div></div>
    <div className="calendar-toolbar"><input aria-label="Buscar actividad o cliente" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar actividad o cliente..." /><select value={priority} onChange={(e) => setPriority(e.target.value)}>{calendarPriorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)}>{calendarStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="calendar-view-tabs">{["month", "week", "day"].map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)} type="button">{item === "month" ? "Mes" : item === "week" ? "Semana" : "Día"}</button>)}</div></div>
    <div className="calendar-main-grid"><div className="calendar-panel"><div className="calendar-nav"><button type="button" onClick={() => changeMonth(-1)}>←</button><h3>{monthNames[cursor.getMonth()]} {cursor.getFullYear()}</h3><button type="button" onClick={() => changeMonth(1)}>→</button></div>{view === "month" ? <div className="calendar-grid"><div className="calendar-weekdays">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div>{monthDays.map((day, index) => <div className={`calendar-cell ${day === calendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate()) ? "today" : ""}`} key={`${day}-${index}`}>{day && <><b>{Number(day.slice(-2))}</b>{eventsFor(day).slice(0, 3).map((item) => <button type="button" className={`calendar-event priority-${item.priority || "medium"}`} key={item.id}>{item.title}</button>)}</>}</div>)}</div> : <div className="calendar-list-view">{list.map((item) => <article key={item.id}><strong>{item.title}</strong><span>{dateLabel(item.due_date)} · {item.requestName || "Sin cliente"}</span><em>{item.status || "pending"}</em></article>)}{!list.length && <p className="muted">No hay actividades con estos filtros.</p>}</div>}</div>
      <aside className="calendar-side-panel"><h3>Crear actividad</h3><form onSubmit={createEvent}><input required value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Título de la actividad" /><input required type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} /><select value={form.request_id} onChange={(e) => setField("request_id", e.target.value)}><option value="">Cliente relacionado</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.name} · #{request.id}</option>)}</select><div className="calendar-form-row"><select value={form.priority} onChange={(e) => setField("priority", e.target.value)}>{calendarPriorities.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={form.status} onChange={(e) => setField("status", e.target.value)}>{calendarStatuses.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Notas y campos variables (placa, número de expediente, monto...)" /><button className="primary" disabled={busy} type="submit">{busy ? "Guardando..." : "Crear actividad"}</button></form>{notice && <p className="calendar-notice">{notice}</p>}</aside></div>
    <div className="calendar-lower-grid"><section className="calendar-card"><h3>Documentos relacionados</h3><select value={selectedRequest} onChange={(e) => loadDocuments(e.target.value)}><option value="">Selecciona un cliente</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.name}</option>)}</select>{documents.map((document) => <div className="calendar-document" key={document.id}><span>📄 {document.filename || document.name}</span><a href={document.url || "#"} target="_blank" rel="noreferrer">Abrir</a></div>)}{selectedRequest && !documents.length && <p className="muted">No hay documentos relacionados.</p>}</section><section className="calendar-card"><h3>Historial de acciones</h3>{history.slice(0, 5).map((item) => <div className="history-row" key={item.id}><strong>{item.action}</strong><small>{item.created_at ? dateLabel(item.created_at.slice(0, 10)) : "Reciente"}</small></div>)}{selectedRequest && !history.length &&     <p className="muted">No hay acciones registradas.</p>}<button type="button" onClick={onGoToClients}>💬 Abrir comunicación del cliente</button></section><section className="calendar-card"><h3>Verificación de portales oficiales</h3>{portals.slice(0, 5).map((portal) => <div className="portal-row" key={portal.id}><span>{portal.name}</span><strong className={portal.status}>{portal.status || "unknown"}</strong><small>{portal.checked_at ? dateLabel(portal.checked_at.slice(0, 10)) : "Sin comprobar"}</small></div>)}<button type="button" onClick={async () => { setPortals(await adminFetch("/admin/portals/check")); setNotice("Portales verificados."); }}>↻ Verificar ahora</button></section></div>
    <div className="calendar-reference"><h3>Vencimientos frecuentes</h3>{dueItems.map((item) => <span key={item.id}>{item.icon} {item.title}: <b>{item.date}</b></span>)}</div>
  </section>;
}
