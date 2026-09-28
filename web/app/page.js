"use client";

import { useMemo, useState } from "react";

const services = [
  { icon: "🚕", category: "transport", title: "Airport transfer", es: "Transporte desde el aeropuerto", text: "Safe, private transportation from Juan Santamaría airport.", location: "San José · Airport" },
  { icon: "🧾", category: "paperwork", title: "Help with paperwork", es: "Asistencia con trámites", text: "Understand the next steps for local paperwork without the jargon.", location: "All Costa Rica" },
  { icon: "🏠", category: "housing", title: "Housing guidance", es: "Orientación para vivienda", text: "Get help reviewing a rental, neighborhood or basic services.", location: "San José · Guanacaste" },
  { icon: "🩺", category: "health", title: "Health navigation", es: "Orientación de salud", text: "Find the right channel for non-emergency health assistance.", location: "All Costa Rica" },
];

export default function Home() {
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const es = language === "es";
  const filtered = useMemo(() => services.filter((service) =>
    (category === "all" || service.category === category) &&
    `${service.title} ${service.es} ${service.text}`.toLowerCase().includes(query.toLowerCase())
  ), [category, query]);

  return <main>
    <header className="topbar"><div className="logo">🇨🇷 <span>TicoListo</span></div><button className="language" onClick={() => setLanguage(es ? "en" : "es")}>{es ? "EN" : "ES"} ↗</button></header>
    <section className="hero"><p className="eyebrow">{es ? "TU GUÍA LOCAL EN COSTA RICA" : "YOUR LOCAL GUIDE IN COSTA RICA"}</p><h1>Feel at home, wherever you are.</h1><p>{es ? "Encuentra servicios confiables y pide ayuda en tu idioma." : "Find trusted local services and ask for help in your language."}</p><button className="primary" onClick={() => document.getElementById("assistance").scrollIntoView({ behavior: "smooth" })}>{es ? "Necesito asistencia" : "I need assistance"} <span>→</span></button></section>
    <section className="content"><div className="section-heading"><div><p className="eyebrow">{es ? "EXPLORA" : "EXPLORE"}</p><h2>What do you need?</h2></div><span className="count">{filtered.length} {es ? "servicios" : "services"}</span></div><input className="search" aria-label="Search services" placeholder={es ? "Buscar servicios..." : "Search services..."} value={query} onChange={(event) => setQuery(event.target.value)} /><div className="chips">{[["all","All"],["transport","Transport"],["paperwork","Paperwork"],["housing","Housing"],["health","Health"]].map(([key, label]) => <button className={category === key ? "chip active" : "chip"} key={key} onClick={() => setCategory(key)}>{label}</button>)}</div><div className="service-grid">{filtered.map((service) => <button className="service-card" key={service.category} onClick={() => setSelected(service)}><span className="service-icon">{service.icon}</span><span className="service-title">{es ? service.es : service.title}</span><span className="service-text">{service.text}</span><span className="service-location">⌖ {service.location}</span></button>)}</div></section>
    <section className="assistance" id="assistance"><div><p className="eyebrow">TICOLISTO CONCIERGE</p><h2>{es ? "¿No encuentras lo que buscas?" : "Can't find what you need?"}</h2><p>{es ? "Cuéntanos qué necesitas. Nuestro equipo revisará tu solicitud y te enviará una cotización." : "Tell us what you need. Our team will review your request and send you a quote."}</p></div>{sent ? <div className="success">✓ {es ? "Solicitud recibida. Te contactaremos pronto." : "Request received. We will contact you soon."}</div> : <form onSubmit={(event) => { event.preventDefault(); setSent(true); }}><input required placeholder={es ? "Tu nombre" : "Your name"} /><input required type="email" placeholder={es ? "Tu correo" : "Your email"} /><input required placeholder={es ? "¿En qué podemos ayudarte?" : "How can we help?"} /><button className="primary" type="submit">{es ? "Enviar solicitud" : "Send request"} →</button></form>}</section>
    <footer>TicoListo · Costa Rica <span>English first · Español disponible</span></footer>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><span className="service-icon">{selected.icon}</span><h2>{es ? selected.es : selected.title}</h2><p>{selected.text}</p><p className="service-location">⌖ {selected.location}</p><button className="primary" onClick={() => { setSelected(null); document.getElementById("assistance").scrollIntoView({ behavior: "smooth" }); }}>{es ? "Solicitar este servicio" : "Request this service"} →</button></div></div>}
  </main>;
}
