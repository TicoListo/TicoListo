"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import CalendarWorkspace from "./CalendarWorkspace";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const statuses = [
  ["all", "Todos"], ["new", "Nueva"], ["contacted", "Contactado"],
  ["waiting_documents", "Esperando documentos"], ["documents_received", "Documentos recibidos"],
  ["in_progress", "En trámite"], ["waiting_institution", "Esperando institución"],
  ["correction_required", "Requiere corrección"], ["completed", "Finalizado"],
];
const statusLabels = Object.fromEntries(statuses);
const emptyService = {
  slug_en: "", slug_es: "", category: "paperwork", name_en: "", name_es: "",
  description_en: "", description_es: "", location: "Costa Rica", provider: "",
  whatsapp: "", meta_title_en: "", meta_title_es: "", meta_description_en: "",
  meta_description_es: "", keywords_en: "", keywords_es: "", content_en: "",
  content_es: "", requirements_en: "", requirements_es: "", steps_en: "",
  steps_es: "", faq_en: "[]", faq_es: "[]", official_url: "", image_url: "", published: true,
};

export default function AdminPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [key, setKey] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [requests, setRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [manager, setManager] = useState("");
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [serviceEditingId, setServiceEditingId] = useState(null);
  const [serviceNotice, setServiceNotice] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminDarkMode, setAdminDarkMode] = useState(false);
  const selected = requests.find((item) => item.id === selectedId) || null;
  const section = pathname === "/admin/seo" ? "seo" : pathname === "/admin/calendario" ? "calendario" : pathname === "/admin/clientes" ? "clientes" : "login";

  const dashboardMetrics = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((item) => !["completed", "cancelled"].includes(item.status)).length,
    inProgress: requests.filter((item) => ["in_progress", "waiting_institution", "correction_required"].includes(item.status)).length,
    completed: requests.filter((item) => item.status === "completed").length,
  }), [requests]);

  const visibleRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return requests.filter((item) => {
      const matchesFilter = filter === "all" || item.status === filter;
      const searchable = [item.name, item.email, item.phone, item.category, item.province, item.location, item.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [filter, requests, search]);

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
      if (requestError.message === "Invalid admin credentials") {
        window.sessionStorage.removeItem("ticolisto-admin-key");
        setKey("");
        router.replace("/admin");
      }
      setError(requestError.message);
    }
  }

  async function loadServices() {
    try {
      setServices(await adminFetch("/admin/services"));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function loadMessages(requestId) {
    setMessagesLoading(true);
    try {
      setMessages(await adminFetch(`/admin/assistance-requests/${requestId}/messages`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMessagesLoading(false);
    }
  }

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("ticolisto-admin-key") || "";
    setAdminDarkMode(window.localStorage.getItem("ticolisto-admin-dark-mode") === "true");
    setKey(savedKey);
    setSessionReady(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ticolisto-admin-dark-mode", String(adminDarkMode));
  }, [adminDarkMode]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!key && section !== "login") {
      router.replace("/admin");
      return;
    }
    if (key && section === "login") {
      router.replace("/admin/clientes");
      return;
    }
    if (key && (section === "clientes" || section === "calendario")) {
      loadRequests();
    }
  }, [key, section, sessionReady, router]);

  useEffect(() => {
    if (key && sessionReady && section === "seo") loadServices();
  }, [key, section, sessionReady]);

  useEffect(() => {
    if (selected) {
      setManager(selected.assigned_to || "");
      loadMessages(selected.id);
    }
  }, [selectedId, requests]);

  useEffect(() => {
    if (section !== "clientes") return;
    const calendarNote = window.sessionStorage.getItem("ticolisto-calendar-note");
    if (calendarNote) {
      setNote(calendarNote);
      window.sessionStorage.removeItem("ticolisto-calendar-note");
    }
  }, [section]);

  async function saveKey(event) {
    event.preventDefault();
    const submittedKey = new FormData(event.currentTarget).get("admin-key")?.toString().trim() || "";
    if (!submittedKey) return;
    setLoginLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/admin/assistance-requests`, {
        headers: { "X-Admin-Key": submittedKey },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "No se pudo validar la clave.");
      }
      window.sessionStorage.setItem("ticolisto-admin-key", submittedKey);
      setKey(submittedKey);
      router.push("/admin/clientes");
    } catch (loginError) {
      window.sessionStorage.removeItem("ticolisto-admin-key");
      setKey("");
      setError(loginError.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    window.sessionStorage.removeItem("ticolisto-admin-key");
    setKey("");
    router.replace("/admin");
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
    if (!selected || !note.trim() || messageSending) return;
    setMessageSending(true);
    try {
      const message = await adminFetch(`/admin/assistance-requests/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ author: "Administrador", message: note.trim() }),
      });
      setMessages((items) => [...items, message]);
      setNote("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMessageSending(false);
    }
  }

  function editService(service) {
    setServiceEditingId(service.id);
    setServiceNotice("");
    setServiceForm({
      ...service,
      keywords_en: service.keywords_en.join(", "),
      keywords_es: service.keywords_es.join(", "),
      faq_en: JSON.stringify(service.faq_en, null, 2),
      faq_es: JSON.stringify(service.faq_es, null, 2),
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function resetServiceForm() {
    setServiceEditingId(null);
    setServiceForm(emptyService);
    setServiceNotice("");
  }

  function servicePayload() {
    return {
      ...serviceForm,
      keywords_en: serviceForm.keywords_en.split(",").map((item) => item.trim()).filter(Boolean),
      keywords_es: serviceForm.keywords_es.split(",").map((item) => item.trim()).filter(Boolean),
      faq_en: JSON.parse(serviceForm.faq_en || "[]"),
      faq_es: JSON.parse(serviceForm.faq_es || "[]"),
    };
  }

  async function saveService(event) {
    event.preventDefault();
    setServiceNotice("");
    try {
      const payload = servicePayload();
      const saved = await adminFetch(serviceEditingId ? `/admin/services/${serviceEditingId}` : "/admin/services", {
        method: serviceEditingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setServices((items) => serviceEditingId ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      setServiceNotice("Servicio guardado correctamente.");
      resetServiceForm();
    } catch (requestError) {
      setError(requestError.message === "Unexpected token" ? "El FAQ debe ser un JSON válido." : requestError.message);
    }
  }

  async function deleteService(service) {
    if (!window.confirm(`¿Eliminar "${service.name_es}"? Esta acción no se puede deshacer.`)) return;
    try {
      await adminFetch(`/admin/services/${service.id}`, { method: "DELETE" });
      setServices((items) => items.filter((item) => item.id !== service.id));
      if (serviceEditingId === service.id) resetServiceForm();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className={`page-shell admin-page${adminDarkMode ? " admin-dark" : ""}`}>
      <div className="admin-heading">
        <div><p className="eyebrow">Operaciones</p><h1>Panel administrativo</h1><p>Consulta cada caso, revisa los datos del cliente y registra el seguimiento.</p></div>
        <div className="admin-heading-actions">
          <button type="button" className="admin-theme-toggle" onClick={() => setAdminDarkMode((enabled) => !enabled)} aria-pressed={adminDarkMode}>
            <span aria-hidden="true">{adminDarkMode ? "☀" : "☾"}</span>
            {adminDarkMode ? "Modo claro" : "Modo oscuro"}
          </button>
          <a href="/" className="admin-back">← Ver sitio público</a>
        </div>
      </div>
      {key && section !== "login" && <nav className="admin-section-nav" aria-label="Secciones administrativas">
        <a className={section === "clientes" ? "active" : ""} href="/admin/clientes">👥 Clientes</a>
        <a className={section === "calendario" ? "active" : ""} href="/admin/calendario">📅 Calendario</a>
        <a className={section === "seo" ? "active" : ""} href="/admin/seo">📈 Posicionamiento SEO</a>
        <button type="button" onClick={logout}>🔒 Cerrar sesión</button>
      </nav>}
      {!sessionReady && <section className="admin-login-card admin-login-loading" aria-live="polite"><div className="admin-login-brand" aria-hidden="true"><img className="admin-logo-image" src={adminDarkMode ? "/ticolisto-logo-light.png" : "/ticolisto-logo-clean.png"} alt="" /></div><p>Preparando acceso seguro...</p></section>}
      {sessionReady && section === "login" && <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-visual" aria-hidden="true">
          <div className="admin-login-orbit admin-login-orbit-one" />
          <div className="admin-login-orbit admin-login-orbit-two" />
          <div className="admin-login-brand"><img className="admin-logo-image" src={adminDarkMode ? "/ticolisto-logo-light.png" : "/ticolisto-logo-clean.png"} alt="" /></div>
          <span className="admin-login-spark admin-login-spark-one">✦</span>
          <span className="admin-login-spark admin-login-spark-two">·</span>
        </div>
        <div className="admin-login-copy">
          <p className="eyebrow">Centro de operaciones · TicoListo</p>
          <h2 id="admin-login-title">Todo bajo control.</h2>
          <p>Ingresa para organizar solicitudes, acompañar clientes y mantener tus trámites avanzando.</p>
        </div>
        <form onSubmit={saveKey} className="admin-login">
          <label htmlFor="admin-key">Clave de administrador
            <div className="admin-key-field">
              <span aria-hidden="true">⌕</span>
              <input id="admin-key" name="admin-key" type={showKey ? "text" : "password"} defaultValue="" onInput={() => setError("")} placeholder="Escribe tu clave de acceso" autoComplete="current-password" required />
              <button type="button" className="admin-key-toggle" onClick={() => setShowKey((visible) => !visible)} aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}>{showKey ? "Ocultar" : "Mostrar"}</button>
            </div>
          </label>
          <button className="primary admin-login-submit" type="submit" disabled={loginLoading}><span>{loginLoading ? "Validando..." : "Entrar al panel"}</span><span className="admin-login-arrow" aria-hidden="true">→</span></button>
        </form>
        <div className="admin-login-features" aria-label="Funciones del panel"><span>✓ Clientes</span><span>✓ Seguimiento</span><span>✓ Calendario</span></div>
        <p className="admin-login-security"><span aria-hidden="true">✦</span> Espacio privado · Solo personal autorizado</p>
      </section>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {key && section === "clientes" && !error && <div className="admin-workspace">
        <section className="admin-overview" aria-label="Resumen operativo">
          <div className="admin-overview-card"><span>Solicitudes totales</span><strong>{dashboardMetrics.total}</strong><small>Todos los casos registrados</small></div>
          <div className="admin-overview-card admin-overview-warning"><span>Casos pendientes</span><strong>{dashboardMetrics.pending}</strong><small>Requieren seguimiento</small></div>
          <div className="admin-overview-card admin-overview-progress"><span>En proceso</span><strong>{dashboardMetrics.inProgress}</strong><small>En atención activa</small></div>
          <div className="admin-overview-card admin-overview-success"><span>Finalizados</span><strong>{dashboardMetrics.completed}</strong><small>Casos completados</small></div>
        </section>
        <aside className="admin-sidebar">
          <div className="admin-sidebar-head"><h2>Solicitudes</h2><span>{visibleRequests.length}</span></div>
          <label className="admin-search-label" htmlFor="admin-request-search">Buscar solicitud</label>
          <div className="admin-request-search"><span aria-hidden="true">⌕</span><input id="admin-request-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, teléfono..." /><button type="button" onClick={() => setSearch("")} disabled={!search} aria-label="Limpiar búsqueda">×</button></div>
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
            <div className="detail-block admin-chat-panel">
              <div className="admin-chat-header"><div><p className="eyebrow">Canal privado del caso</p><h3>💬 Conversación con el cliente</h3><p>Las respuestas quedan guardadas en el historial de esta solicitud.</p></div><button type="button" className="chat-refresh" onClick={() => loadMessages(selected.id)} disabled={messagesLoading}>{messagesLoading ? "Actualizando..." : "↻ Actualizar"}</button></div>
              <div className="message-list" aria-live="polite">
                {messagesLoading && !messages.length ? <p className="chat-empty">Cargando conversación...</p> : messages.map((item) => <div className={`message-item ${item.author === "Administrador" ? "message-item-admin" : "message-item-client"}`} key={item.id}><div className="message-meta"><strong>{item.author === "Administrador" ? "Tú · Gestor" : `Cliente · ${item.author}`}</strong><time>{item.created_at ? new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at)) : ""}</time></div><p>{item.message}</p></div>)}
                {!messagesLoading && !messages.length && <p className="chat-empty">Aún no hay mensajes. Envía la primera actualización al cliente.</p>}
              </div>
              <form className="message-form" onSubmit={addNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escribe una respuesta, solicita documentos o deja una actualización..." required /><button className="primary" type="submit" disabled={messageSending}>{messageSending ? "Enviando..." : "Enviar mensaje →"}</button></form>
            </div>
          </> : <div className="empty-admin"><h2>Selecciona una solicitud</h2><p>Elige un caso de la lista para ver toda la información del cliente.</p></div>}
        </section>
      </div>}
      {key && section === "calendario" && !error && <CalendarWorkspace adminFetch={adminFetch} requests={requests} onGoToClients={() => router.push("/admin/clientes")} />}
      {key && section === "seo" && !error && <section className="admin-seo-editor">
        <div className="admin-heading">
          <div><p className="eyebrow">Posicionamiento SEO</p><h2>Servicios y páginas indexables</h2><p>Edita slugs, textos, palabras clave, preguntas frecuentes y publicación sin tocar código.</p></div>
          <button className="primary" type="button" onClick={resetServiceForm}>+ Nuevo servicio</button>
        </div>
        <div className="seo-service-list">
          {services.map((service) => <div className="seo-service-row" key={service.id}><div><strong>{service.name_es}</strong><span>/es/servicios/{service.slug_es || service.slug}</span><small>{service.published ? "Publicado" : "Borrador"} · {service.category}</small></div><div className="seo-service-actions"><button type="button" onClick={() => editService(service)}>Editar SEO</button><button type="button" onClick={() => deleteService(service)}>Eliminar</button></div></div>)}
        </div>
        <form className="seo-editor-form" onSubmit={saveService}>
          <h3>{serviceEditingId ? "Editar servicio" : "Agregar servicio"}</h3>
          <div className="seo-form-grid">
            {[
              ["name_es", "Nombre en español"], ["name_en", "Name in English"],
              ["slug_es", "URL slug español"], ["slug_en", "URL slug English"],
              ["meta_title_es", "Meta title español"], ["meta_title_en", "Meta title English"],
              ["meta_description_es", "Meta description español"], ["meta_description_en", "Meta description English"],
              ["keywords_es", "Palabras clave (separadas por coma)"], ["keywords_en", "Keywords (comma separated)"],
              ["category", "Categoría"], ["provider", "Institución / proveedor"],
              ["location", "Ubicación"], ["official_url", "URL oficial"], ["image_url", "URL de imagen"],
            ].map(([field, label]) => <label key={field}>{label}<input value={serviceForm[field] || ""} onChange={(event) => setServiceForm({ ...serviceForm, [field]: event.target.value })} required={["name_es", "name_en", "slug_es", "slug_en", "category", "location"].includes(field)} /></label>)}
            {[
              ["description_es", "Descripción SEO español"], ["description_en", "Descripción SEO English"],
              ["content_es", "Contenido español"], ["content_en", "Content English"],
              ["requirements_es", "Requisitos español"], ["requirements_en", "Requirements English"],
              ["steps_es", "Pasos español (1. ... 2. ...)"], ["steps_en", "Steps English (1. ... 2. ...)"],
              ["faq_es", "FAQ español (JSON)"], ["faq_en", "FAQ English (JSON)"],
            ].map(([field, label]) => <label className="seo-wide-field" key={field}>{label}<textarea rows={field.startsWith("faq") ? 5 : 4} value={serviceForm[field] || ""} onChange={(event) => setServiceForm({ ...serviceForm, [field]: event.target.value })} /></label>)}
          </div>
          <label className="seo-publish"><input type="checkbox" checked={serviceForm.published} onChange={(event) => setServiceForm({ ...serviceForm, published: event.target.checked })} /> Publicar y permitir indexación</label>
          {serviceNotice && <p className="form-success">{serviceNotice}</p>}
          <div className="seo-form-actions"><button className="primary" type="submit">Guardar servicio y SEO</button><button type="button" onClick={resetServiceForm}>Limpiar</button></div>
        </form>
      </section>}
    </main>
  );
}
