"use client";

import { useEffect, useMemo, useState } from "react";
import { createAssistanceRequest, getChatMessages, getServices, sendChatMessage } from "./lib/api";

const fallbackServices = [
  { icon: "🚕", category: "transport", title: "Airport transfer", es: "Transporte desde el aeropuerto", text: "Safe, private transportation from Juan Santamaría airport.", provider: "TicoListo concierge" },
  { icon: "🧾", category: "paperwork", title: "Help with paperwork", es: "Asistencia con trámites", text: "Understand the next steps for local paperwork without the jargon.", provider: "TicoListo concierge" },
  { icon: "🏠", category: "housing", title: "Housing guidance", es: "Orientación para vivienda", text: "Get help reviewing a rental, neighborhood or basic services.", provider: "TicoListo concierge" },
  { icon: "🩺", category: "health", title: "Health navigation", es: "Orientación de salud", text: "Find the right channel for non-emergency health assistance.", provider: "TicoListo concierge" },
];

const serviceIcons = {
  "renew-drivers-license": "🚘", "first-drivers-license": "🚘", "vehicle-inspection": "🔧",
  "buy-used-vehicle": "🚙", "sell-vehicle": "💵", "lost-id": "🪪", "passport-renewal": "✈️",
  "minor-passport": "👨‍👩‍👧", "registry-certificate": "📄", "buy-property": "🏡", "sell-property": "🏠",
  "short-stay-rental": "🛏️", "create-company": "🏢", "tax-obligations": "🧾", "municipal-license": "🏪",
  "health-permit": "🧼", "self-employed": "🧑‍💻", "dismissal-next-steps": "📦", "birth-documents": "👶",
  "civil-marriage": "💍", "death-of-family-member": "🕊️", "minor-international-travel": "🛫",
  "legal-status-certificate": "🏢", marchamo: "🧾", "business-checklist": "🚀", "ccss-sick-leave": "🏥",
};

const categoryLabels = {
  all: ["Todos los trámites", "All services"], transport: ["Transporte", "Transport"],
  vehicles: ["Vehículos", "Vehicles"], paperwork: ["Documentos", "Paperwork"],
  identity: ["Identidad", "Identity"], travel: ["Viajes", "Travel"], property: ["Propiedades", "Property"],
  business: ["Negocios", "Business"], family: ["Familia", "Family"], work: ["Trabajo", "Work"],
  health: ["Salud", "Health"], housing: ["Vivienda", "Housing"],
};

const smartMatches = [
  ["perdí mi cédula", "lost-id"], ["licencia", "renew-drivers-license"], ["pasaporte", "passport-renewal"],
  ["abrir negocio", "business-checklist"], ["despido", "dismissal-next-steps"], ["propiedad", "buy-property"],
  ["marchamo", "marchamo"], ["incapacidad", "ccss-sick-leave"], ["casarme", "civil-marriage"],
];

const officialPortals = {
  vehicles: ["COSEVI / Educación Vial", "https://www.educacionvial.go.cr"],
  identity: ["TSE / Registro Civil", "https://www.tse.go.cr"],
  travel: ["Migración y Extranjería", "https://www.migracion.go.cr"],
  property: ["Registro Nacional", "https://www.rnpdigital.com"],
  business: ["Ministerio de Hacienda / VUI", "https://vui.cr"],
  health: ["CCSS / EDUS", "https://edus.ccss.sa.cr"],
  work: ["Ministerio de Trabajo", "https://www.mtss.go.cr"],
  housing: ["Portal oficial del Gobierno", "https://www.gob.cr"],
};

const serviceOfficialDetails = {
  "renew-drivers-license": ["COSEVI / Educación Vial", "https://www.educacionvial.go.cr"],
  "first-drivers-license": ["COSEVI / Educación Vial", "https://www.educacionvial.go.cr"],
  "vehicle-inspection": ["DEKRA Costa Rica", "https://www.dekra.cr"],
  "buy-used-vehicle": ["Registro Nacional / notario", "https://www.rnpdigital.com"],
  "sell-vehicle": ["Registro Nacional / notario", "https://www.rnpdigital.com"],
  "lost-id": ["Tribunal Supremo de Elecciones", "https://www.tse.go.cr"],
  "passport-renewal": ["Migración y Extranjería", "https://www.migracion.go.cr"],
  "minor-passport": ["Migración y Extranjería", "https://www.migracion.go.cr"],
  "registry-certificate": ["Registro Nacional", "https://www.rnpdigital.com"],
  "buy-property": ["Registro Nacional / municipalidad / notario", "https://www.rnpdigital.com"],
  "sell-property": ["Registro Nacional / notario", "https://www.rnpdigital.com"],
  "short-stay-rental": ["Municipalidad / ICT / Hacienda", "https://www.ict.go.cr"],
  "create-company": ["Notario / Registro Nacional / Hacienda", "https://www.rnpdigital.com"],
  "tax-obligations": ["Ministerio de Hacienda / ATV", "https://www.atv.hacienda.go.cr"],
  "municipal-license": ["Municipalidad correspondiente", "https://www.gob.cr"],
  "health-permit": ["Ministerio de Salud", "https://www.tramitessalud.go.cr"],
  "self-employed": ["Hacienda / CCSS", "https://www.atv.hacienda.go.cr"],
  "dismissal-next-steps": ["Ministerio de Trabajo y Seguridad Social", "https://www.mtss.go.cr"],
  "birth-documents": ["Registro Civil / TSE", "https://www.tse.go.cr"],
  "civil-marriage": ["Registro Civil / notario", "https://www.tse.go.cr"],
  "death-of-family-member": ["Registro Civil / CCSS / notario", "https://www.tse.go.cr"],
  "minor-international-travel": ["Migración y Extranjería", "https://www.migracion.go.cr"],
  "legal-status-certificate": ["Registro Nacional", "https://www.rnpdigital.com"],
  marchamo: ["INS / entidades recaudadoras autorizadas", "https://www.ins-cr.com"],
  "business-checklist": ["Municipalidad / Hacienda / Salud", "https://vui.cr"],
  "ccss-sick-leave": ["Caja Costarricense de Seguro Social", "https://edus.ccss.sa.cr"],
};

function getInstructions(service) {
  const [institution, url] = serviceOfficialDetails[service.slug] || officialPortals[service.category] || ["Institución responsable", "https://www.gob.cr"];
  return {
    institution: service.provider || institution,
    url,
    requirements: "Documento de identificación vigente, comprobantes y requisitos específicos indicados por la institución responsable.",
    steps: [
      "Ingresa al portal oficial y verifica los requisitos actualizados.",
      "Prepara los documentos y solicita una cita o inicia el formulario correspondiente.",
      "Realiza el pago o presenta la documentación cuando el trámite lo solicite.",
      "Guarda el comprobante y da seguimiento hasta recibir la respuesta.",
    ],
  };
}

export default function Home() {
  const [catalog, setCatalog] = useState(fallbackServices);
  const [language, setLanguage] = useState("es");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantStep, setAssistantStep] = useState(0);
  const [province, setProvince] = useState("");
  const [chatToken, setChatToken] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const es = language === "es";
  const selectedInstructions = selected ? getInstructions(selected) : null;

  useEffect(() => {
    getServices().then((items) => {
      if (items.length) {
        setCatalog(items.map((item) => ({
          ...item,
          title: item.name_en,
          es: item.name_es,
          text: es ? item.description_es : item.description_en,
          provider: item.provider || item.location,
          icon: serviceIcons[item.slug] || "✦",
        })));
      }
    }).catch(() => {});
  }, [es]);

  const filtered = useMemo(() => catalog.filter((service) =>
    (category === "all" || service.category === category) &&
    `${service.title} ${service.es} ${service.text} ${service.provider || ""}`.toLowerCase().includes(query.toLowerCase())
  ), [catalog, category, query]);
  const smartSuggestion = smartMatches.find(([term]) => query.toLowerCase().includes(term));

  function openAssistant() {
    setAssistantOpen(true);
    setAssistantStep(1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const created = await createAssistanceRequest({
        name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
        location: form.get("location"), province: form.get("province"), category: form.get("category"), description: form.get("description"),
        consent: form.get("consent") === "on",
      });
      setSent(true);
      setChatToken(created.chat_token || "");
      setContactNote("");
      event.currentTarget.reset();
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setSubmitting(false);
    }

    useEffect(() => {
      if (!chatToken) return undefined;
      const load = () => getChatMessages(chatToken).then(setChatMessages).catch(() => {});
      load();
      const timer = window.setInterval(load, 10000);
      return () => window.clearInterval(timer);
    }, [chatToken]);

    async function handleChatSubmit(event) {
      event.preventDefault();
      if (!chatDraft.trim() || !chatToken) return;
      setChatSending(true);
      try {
        const message = await sendChatMessage(chatToken, chatDraft.trim());
        setChatMessages((items) => [...items, message]);
        setChatDraft("");
      } catch (chatError) {
        setError(chatError.message);
      } finally {
        setChatSending(false);
      }
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="logo" href="#top" aria-label="TicoListo home"><span className="logo-mark">T</span><span>TicoListo</span></a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#services">{es ? "Explorar trámites" : "Explore services"}</a>
          <a href="#assistance">{es ? "Necesito ayuda" : "I need help"}</a>
        </nav>
        <button className="language" onClick={() => setLanguage(es ? "en" : "es")}>{es ? "EN" : "ES"} <span>⌄</span></button>
      </header>

      <section className="hero-banner" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{es ? "GUÍA DE SERVICIOS EN COSTA RICA" : "COSTA RICA SERVICE GUIDE"}</p>
          <h1>{es ? "Encuentra cómo resolverlo." : "Find your next step."}</h1>
          <p>{es ? "Trámites y servicios explicados de forma clara, en un solo lugar." : "Public services explained clearly, all in one place."}</p>
        </div>
        <div className="hero-art" aria-hidden="true"><span>🇨🇷</span><i>✓</i><b>✦</b></div>
        <div className="search-panel">
          <label htmlFor="service-search">{es ? "¿Qué necesitas resolver?" : "What do you need to solve?"}</label>
          <div className="search-row">
            <span className="search-icon">⌕</span>
            <input id="service-search" className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={es ? "Busca un trámite, servicio o institución" : "Search a service or institution"} />
            <button className="search-button" onClick={() => document.getElementById("services").scrollIntoView({ behavior: "smooth" })}>{es ? "Buscar" : "Search"}</button>
          </div>
          <p className="search-hint">{es ? "Ej.: licencia, pasaporte, propiedad, Hacienda..." : "Example: license, passport, property, taxes..."}</p>
          <button className="assistant-trigger" onClick={openAssistant}>✨ {es ? "¿No sabes cómo buscar? Te guiamos" : "Need help choosing? Ask the assistant"}</button>
          {smartSuggestion && <button className="smart-suggestion" onClick={() => { const match = catalog.find((item) => item.slug === smartSuggestion[1]); if (match) setSelected(match); }}>Asistente sugiere: <strong>{catalog.find((item) => item.slug === smartSuggestion[1])?.es}</strong> →</button>}
        </div>
      </section>

      <section className="catalog-layout" id="services">
        <aside className="filters">
          <div className="filter-heading"><strong>{es ? "Categorías" : "Categories"}</strong><span>{filtered.length}</span></div>
          {Object.entries(categoryLabels).map(([key, labels]) => (
            <button className={category === key ? "filter active" : "filter"} key={key} onClick={() => setCategory(key)}>
              <span>{labels[es ? 0 : 1]}</span><span className="filter-arrow">›</span>
            </button>
          ))}
        </aside>

        <div className="results">
          <div className="results-header">
            <div><p className="eyebrow">{es ? "SERVICIOS DESTACADOS" : "FEATURED SERVICES"}</p><h2>{es ? "¿Qué necesitas hacer?" : "What do you need to do?"}</h2></div>
            <span className="results-count">{filtered.length} {es ? "resultados" : "results"}</span>
          </div>
          <div className="service-list">
            {filtered.map((service) => (
              <button className="service-row" key={service.slug || service.category} onClick={() => setSelected(service)}>
                <span className="row-icon">{service.icon}</span>
                <span className="row-copy"><strong>{es ? service.es : service.title}</strong><small>{service.provider || service.location}</small></span>
                <span className="row-arrow">›</span>
              </button>
            ))}
          </div>
          {!filtered.length && <div className="empty-state">{es ? "No encontramos ese trámite. Prueba otra búsqueda." : "No services found. Try another search."}</div>}
        </div>
      </section>

      <section className="assistance" id="assistance">
        <div><p className="eyebrow">TICOLISTO CONCIERGE</p><h2>{es ? "¿No encuentras lo que buscas?" : "Can't find what you need?"}</h2><p>{es ? "Cuéntanos qué necesitas y te ayudamos a ordenar los siguientes pasos." : "Tell us what you need and we'll help you find the next step."}</p></div>
        {sent ? <div className="success" role="status">✓ {es ? "Solicitud recibida. Te contactaremos pronto." : "Request received. We will contact you soon."}{chatToken && <div className="client-chat"><h3>💬 Chat con tu gestor</h3><p>Escribe aquí para dar seguimiento a tu solicitud. La conversación se actualiza automáticamente.</p><div className="chat-messages">{chatMessages.map((item) => <div className={item.author === "Cliente" ? "chat-message mine" : "chat-message"} key={item.id}><strong>{item.author}</strong><span>{item.message}</span></div>)}</div><form onSubmit={handleChatSubmit} className="chat-form"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Escribe un mensaje..." /><button className="primary" disabled={chatSending}>{chatSending ? "..." : "Enviar"}</button></form></div>}</div> : <form onSubmit={handleSubmit}><input name="name" required minLength="2" placeholder={es ? "Tu nombre" : "Your name"} /><input name="email" required type="email" placeholder={es ? "Tu correo" : "Your email"} /><input name="phone" required minLength="7" placeholder={es ? "Tu teléfono" : "Your phone"} /><input name="location" required placeholder={es ? "Tu ubicación" : "Your location"} /><select name="province" value={province} onChange={(event) => setProvince(event.target.value)} required><option value="">Provincia</option>{["San José","Alajuela","Cartago","Heredia","Guanacaste","Puntarenas","Limón"].map((item) => <option key={item}>{item}</option>)}</select><select name="category" defaultValue="general"><option value="general">{es ? "Consulta general" : "General inquiry"}</option><option value="paperwork">{es ? "Trámites" : "Paperwork"}</option><option value="vehicles">{es ? "Vehículos" : "Vehicles"}</option></select><textarea name="description" required minLength="10" value={contactNote} onChange={(event) => setContactNote(event.target.value)} placeholder={es ? "¿En qué podemos ayudarte?" : "How can we help?"} /><label className="consent-check"><input name="consent" type="checkbox" required />Acepto que TicoListo use estos datos para gestionar mi solicitud.</label><button className="primary" type="submit" disabled={submitting}>{submitting ? (es ? "Enviando..." : "Sending...") : (es ? "Enviar solicitud" : "Send request")} →</button>{error && <p className="form-error" role="alert">{error}</p>}</form>}
      </section>

      <footer><span className="logo"><span className="logo-mark">T</span>TicoListo</span><span>{es ? "Una guía más clara para Costa Rica." : "A clearer guide to Costa Rica."}</span></footer>
      {assistantOpen && <div className="assistant-card"><button className="assistant-close" onClick={() => setAssistantOpen(false)}>×</button><strong>✨ Asistente de trámites</strong>{assistantStep === 1 && <><p>¿Qué necesitas resolver?</p><div className="assistant-options">{["Licencia o vehículo","Pasaporte o cédula","Propiedad o vivienda","Negocio o Hacienda"].map((option) => <button key={option} onClick={() => { setQuery(option.split(" ")[0]); setAssistantStep(2); }}>{option}</button>)}</div></>}{assistantStep === 2 && <><p>Perfecto. Busca el resultado sugerido o selecciona un trámite del catálogo. También puedes delegarlo desde su ficha.</p><button className="primary" onClick={() => { setAssistantOpen(false); document.getElementById("services").scrollIntoView({ behavior: "smooth" }); }}>Ver trámites recomendados</button></>}</div>}
      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal service-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><span className="service-icon">{selected.icon}</span><h2>{es ? selected.es : selected.title}</h2><p>{selected.text}</p><p className="service-location">Institución responsable: {selectedInstructions.institution}</p><section className="modal-guide self-service"><h3>🌐 {es ? "OPCIÓN 1: HACERLO TÚ MISMO" : "OPTION 1: DO IT YOURSELF"}</h3><p><strong>{es ? "Requisitos y documentos:" : "Requirements and documents:"}</strong> {selectedInstructions.requirements}</p><ol>{selectedInstructions.steps.map((step) => <li key={step}>{step}</li>)}</ol><a className="official-link" href={selectedInstructions.url} target="_blank" rel="noopener noreferrer"><span>🔗</span><strong>{es ? "Ir al sitio oficial" : "Open official website"}</strong><small>Portal de {selectedInstructions.institution} ↗</small></a><small className="direct-url">URL directa: {selectedInstructions.url}</small></section><section className="modal-guide delegate-service"><h3>🤝 {es ? "OPCIÓN 2: ¿PREFIERES QUE LO HAGAMOS POR TI?" : "OPTION 2: LET US HANDLE IT"}</h3><p>{es ? "Si no tienes tiempo o prefieres acompañamiento, nuestro equipo puede encargarse del proceso y darle seguimiento." : "Our team can handle the process and follow up for you."}</p><button className="delegate-button" onClick={() => { setContactNote(`Necesito delegar el trámite: ${selected.es || selected.title}. Quiero conocer los requisitos y el costo de la asistencia.`); setSelected(null); document.getElementById("assistance").scrollIntoView({ behavior: "smooth" }); }}><span>💬</span><strong>{es ? "Contactar a un gestor" : "Contact a specialist"}</strong><small>Recibe acompañamiento personalizado →</small></button></section></div></div>}
    </main>
  );
}
