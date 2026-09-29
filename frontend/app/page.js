"use client";

import { useEffect, useMemo, useState } from "react";
import { createAssistanceRequest, getServices } from "./lib/api";

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

function getInstructions(service) {
  const [institution, url] = officialPortals[service.category] || ["Institución responsable", "https://www.gob.cr"];
  return {
    institution: service.provider || institution,
    url,
    requirements: "Documento de identificación vigente, comprobantes y requisitos específicos indicados por la institución.",
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

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await createAssistanceRequest({
        name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
        location: form.get("location"), category: form.get("category"), description: form.get("description"),
      });
      setSent(true);
      setContactNote("");
      event.currentTarget.reset();
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setSubmitting(false);
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
        {sent ? <div className="success" role="status">✓ {es ? "Solicitud recibida. Te contactaremos pronto." : "Request received. We will contact you soon."}</div> : <form onSubmit={handleSubmit}><input name="name" required minLength="2" placeholder={es ? "Tu nombre" : "Your name"} /><input name="email" required type="email" placeholder={es ? "Tu correo" : "Your email"} /><input name="phone" required minLength="7" placeholder={es ? "Tu teléfono" : "Your phone"} /><input name="location" required placeholder={es ? "Tu ubicación" : "Your location"} /><select name="category" defaultValue="general"><option value="general">{es ? "Consulta general" : "General inquiry"}</option><option value="paperwork">{es ? "Trámites" : "Paperwork"}</option><option value="vehicles">{es ? "Vehículos" : "Vehicles"}</option></select><textarea name="description" required minLength="10" value={contactNote} onChange={(event) => setContactNote(event.target.value)} placeholder={es ? "¿En qué podemos ayudarte?" : "How can we help?"} /><button className="primary" type="submit" disabled={submitting}>{submitting ? (es ? "Enviando..." : "Sending...") : (es ? "Enviar solicitud" : "Send request")} →</button>{error && <p className="form-error" role="alert">{error}</p>}</form>}
      </section>

      <footer><span className="logo"><span className="logo-mark">T</span>TicoListo</span><span>{es ? "Una guía más clara para Costa Rica." : "A clearer guide to Costa Rica."}</span></footer>
      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal service-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><span className="service-icon">{selected.icon}</span><h2>{es ? selected.es : selected.title}</h2><p>{selected.text}</p><p className="service-location">{selectedInstructions.institution}</p><div className="modal-guide"><h3>{es ? "Cómo realizar este trámite" : "How to complete this process"}</h3><p><strong>{es ? "Requisitos:" : "Requirements:"}</strong> {selectedInstructions.requirements}</p><ol>{selectedInstructions.steps.map((step) => <li key={step}>{step}</li>)}</ol><a href={selectedInstructions.url} target="_blank" rel="noreferrer">{es ? "Ver portal oficial" : "Open official portal"} ↗</a></div><button className="primary" onClick={() => { setContactNote(`Necesito ayuda con: ${selected.es || selected.title}. Quiero conocer el proceso y delegarlo a su equipo.`); setSelected(null); document.getElementById("assistance").scrollIntoView({ behavior: "smooth" }); }}>{es ? "Contactarme para que me ayude" : "Contact me for help"} →</button></div></div>}
    </main>
  );
}
