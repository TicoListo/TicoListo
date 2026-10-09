"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createAssistanceRequest, getChatMessages, getServices, sendChatMessage } from "./lib/api";

const fallbackServices = [
  { icon: "🚕", category: "transport", title: "Airport transfer", es: "Transporte desde el aeropuerto", text: "Safe, private transportation from Juan Santamaría airport.", provider: "TicoListo concierge" },
  { icon: "🧾", category: "paperwork", title: "Help with paperwork", es: "Asistencia con trámites", text: "Understand the next steps for local paperwork without the jargon.", provider: "TicoListo concierge" },
  { icon: "🏠", category: "housing", title: "Housing guidance", es: "Orientación para vivienda", text: "Get help reviewing a rental, neighborhood or basic services.", provider: "TicoListo concierge" },
  { icon: "🩺", category: "health", title: "Health navigation", es: "Orientación de salud", text: "Find the right channel for non-emergency health assistance.", provider: "TicoListo concierge" },
];

const serviceIcons = {
  "renew-drivers-license": "🚘", "first-drivers-license": "🚘", "vehicle-inspection": "🔧",
  "buy-used-vehicle": "🚙", "sell-vehicle": "🚗", "lost-id": "🪪", "passport-renewal": "🛂",
  "minor-passport": "🧳", "registry-certificate": "📜", "buy-property": "🏠", "sell-property": "🏡",
  "short-stay-rental": "🛏️", "create-company": "🏢", "tax-obligations": "💰", "municipal-license": "🏛️",
  "health-permit": "🩺", "self-employed": "💼", "dismissal-next-steps": "📋", "birth-documents": "👶",
  "civil-marriage": "💍", "death-of-family-member": "🕊️", "minor-international-travel": "✈️",
  "legal-status-certificate": "📄", marchamo: "🚘", "business-checklist": "✅", "ccss-sick-leave": "🏥",
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

const popularServiceSlugs = ["renew-drivers-license", "passport-renewal", "lost-id", "marchamo"];

function updatePhysics(stickman, deltaTime) {
  const step = Math.min(deltaTime / 16.67, 2);
  const walking = ["SUN_TO_HOLE", "WALK_TO_MOON", "WALK_TO_IDLE"].includes(stickman.state);
  if (walking) {
    stickman.x += stickman.direction * stickman.speed * step;
    stickman.walkPhase += 0.24 * step;
    if ((stickman.direction > 0 && stickman.x >= stickman.targetX) || (stickman.direction < 0 && stickman.x <= stickman.targetX)) {
      stickman.x = stickman.targetX;
    }
  }
  if (stickman.state === "ENTER_HOLE") {
    stickman.x += (stickman.holeX - stickman.x) * 0.1 * step;
    stickman.y = stickman.floor + Math.sin(stickman.progress * Math.PI / 2) * 25;
    stickman.progress = Math.min(1, stickman.progress + 0.055 * step);
  }
  if (stickman.state === "EXIT_HOLE") {
    stickman.x = stickman.holeX;
    stickman.y = stickman.floor + 25 - Math.sin(stickman.progress * Math.PI / 2) * 25;
    stickman.progress = Math.min(1, stickman.progress + 0.055 * step);
  }
  if (["SLIDE_TO_DARK", "SLIDE_TO_LIGHT"].includes(stickman.state)) {
    stickman.orbProgress = Math.min(1, stickman.orbProgress + 0.045 * step);
  }
}

function drawHole(context, stickman) {
  context.save();
  context.fillStyle = "rgba(15, 23, 42, 0.35)";
  context.beginPath();
  context.ellipse(stickman.holeX, stickman.floor + 3, 10, 3.5, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawOrb(context, stickman) {
  const start = stickman.state === "SLIDE_TO_DARK" ? stickman.sunX : stickman.moonX;
  const end = stickman.state === "SLIDE_TO_LIGHT" ? stickman.sunX : stickman.moonX;
  const orbX = ["SLIDE_TO_DARK", "SLIDE_TO_LIGHT"].includes(stickman.state)
    ? start + (end - start) * stickman.orbProgress
    : (stickman.theme ? stickman.moonX : stickman.sunX);
  context.save();
  context.fillStyle = stickman.theme ? "#cbd5e1" : "#fbbf24";
  context.shadowColor = stickman.theme ? "rgba(226,232,240,.35)" : "rgba(251,191,36,.45)";
  context.shadowBlur = 7;
  context.beginPath();
  context.arc(orbX, 15, 7, 0, Math.PI * 2);
  context.fill();
  if (stickman.theme) {
    context.fillStyle = "#172337";
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(orbX + 3, 12, 6, 0, Math.PI * 2);
    context.fill();
  } else {
    context.strokeStyle = "#f59e0b";
    context.lineWidth = 1;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      context.beginPath();
      context.moveTo(orbX + Math.cos(angle) * 9, 15 + Math.sin(angle) * 9);
      context.lineTo(orbX + Math.cos(angle) * 11, 15 + Math.sin(angle) * 11);
      context.stroke();
    }
  }
  context.restore();
}

function drawStickman(context, stickman) {
  const transitioning = ["SLIDE_TO_DARK", "SLIDE_TO_LIGHT"].includes(stickman.state);
  const night = stickman.theme || stickman.state === "SLIDE_TO_DARK";
  const progress = transitioning ? stickman.orbProgress : night ? 1 : 0;
  const skyTop = night ? "#0f172a" : "#38bdf8";
  const skyBottom = night ? "#1e293b" : "#bae6fd";
  const orbStart = stickman.state === "SLIDE_TO_DARK" ? stickman.sunX : stickman.moonX;
  const orbEnd = stickman.state === "SLIDE_TO_LIGHT" ? stickman.sunX : stickman.moonX;
  const orbX = transitioning ? orbStart + (orbEnd - orbStart) * stickman.orbProgress : night ? stickman.moonX : stickman.sunX;
  context.save();
  const sky = context.createLinearGradient(0, 0, 0, 48);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(1, skyBottom);
  context.fillStyle = sky;
  context.fillRect(0, 0, 56, 48);
  context.globalAlpha = 1 - progress;
  context.fillStyle = "#fde68a";
  context.beginPath();
  context.arc(7, 13, 4, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = progress;
  context.fillStyle = "#f8fafc";
  for (const star of [[7, 9], [36, 8], [49, 16], [29, 13]]) {
    context.beginPath();
    context.arc(star[0], star[1], star[2] || 1, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  context.fillStyle = night ? "#172337" : "#075985";
  context.beginPath();
  context.moveTo(0, 48);
  context.lineTo(0, 39);
  context.lineTo(10, 32);
  context.lineTo(19, 39);
  context.lineTo(31, 26);
  context.lineTo(43, 39);
  context.lineTo(56, 29);
  context.lineTo(56, 48);
  context.closePath();
  context.fill();
  context.fillStyle = night ? "#0f172a" : "#064e3b";
  context.beginPath();
  context.moveTo(0, 48);
  context.lineTo(0, 42);
  context.lineTo(18, 35);
  context.lineTo(32, 42);
  context.lineTo(47, 35);
  context.lineTo(56, 41);
  context.lineTo(56, 48);
  context.closePath();
  context.fill();
  context.strokeStyle = night ? "#64748b" : "#166534";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(47, 42);
  context.lineTo(47, 27);
  context.moveTo(47, 29);
  context.quadraticCurveTo(42, 25, 40, 28);
  context.moveTo(47, 30);
  context.quadraticCurveTo(52, 25, 55, 28);
  context.moveTo(47, 33);
  context.quadraticCurveTo(43, 30, 41, 32);
  context.stroke();
  context.fillStyle = night ? "rgba(226,232,240,.7)" : "rgba(255,255,255,.85)";
  context.beginPath();
  context.arc(16, 20, 5, 0, Math.PI * 2);
  context.arc(21, 18, 6, 0, Math.PI * 2);
  context.arc(27, 21, 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = night ? "#e2e8f0" : "#fbbf24";
  context.shadowColor = night ? "rgba(226,232,240,.5)" : "rgba(251,191,36,.55)";
  context.shadowBlur = 8;
  context.beginPath();
  context.arc(orbX, 15, 7, 0, Math.PI * 2);
  context.fill();
  if (night) {
    context.fillStyle = "#172337";
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(orbX + 3, 12, 6, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

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
  const [assistanceStep, setAssistanceStep] = useState(1);
  const [province, setProvince] = useState("");
  const [chatToken, setChatToken] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const stageRef = useRef(null);
  const animationRef = useRef({ state: "IDLE", theme: false });
  const es = language === "es";
  const selectedInstructions = selected ? getInstructions(selected) : null;

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const canvas = stageRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    const stickman = {
      x: 28, y: 34, floor: 34, homeX: 28, holeX: 44, sunX: 12, moonX: 44,
      targetX: 28, direction: 1, speed: 1.3, walkPhase: 0, progress: 0,
      orbProgress: 0, color: "#123b56", state: "IDLE", hidden: false, theme: false,
    };
    let animationFrame;
    let lastTime = performance.now();
    let stateStartedAt = lastTime;
    let currentState = "IDLE";
    function setAnimationState(nextState) {
      currentState = nextState;
      stickman.state = nextState;
      animationRef.current.state = nextState;
      stateStartedAt = performance.now();
      stickman.progress = 0;
      stickman.orbProgress = 0;
      if (nextState === "ENTER_HOLE") stickman.hidden = false;
      if (nextState === "SLIDE_TO_DARK") stickman.hidden = true;
      if (nextState === "EXIT_HOLE") stickman.hidden = false;
    }
    function renderLoop(timestamp) {
      const deltaTime = Math.min(timestamp - lastTime, 48);
      lastTime = timestamp;
      if (currentState !== animationRef.current.state) {
        if (animationRef.current.state === "SUN_TO_HOLE") {
          stickman.x = stickman.homeX;
          stickman.targetX = stickman.holeX;
          stickman.direction = 1;
        }
        setAnimationState(animationRef.current.state);
      }
      const elapsed = timestamp - stateStartedAt;
      stickman.theme = animationRef.current.theme;
      stickman.color = stickman.theme ? "#e2e8f0" : "#123b56";
      if (currentState === "SUN_TO_HOLE" && stickman.x >= stickman.holeX) setAnimationState("ENTER_HOLE");
      if (currentState === "ENTER_HOLE" && stickman.progress >= 1) {
        animationRef.current.theme = true;
        setDarkMode(true);
        setAnimationState("SLIDE_TO_DARK");
      }
      if (currentState === "SLIDE_TO_DARK" && stickman.orbProgress >= 1) {
        stickman.x = stickman.holeX;
        setAnimationState("IDLE");
      }
      if (currentState === "EXIT_HOLE" && stickman.progress >= 1) {
        stickman.targetX = stickman.moonX;
        stickman.direction = 1;
        setAnimationState("WALK_TO_MOON");
      }
      if (currentState === "WALK_TO_MOON" && stickman.x >= stickman.moonX) {
        animationRef.current.theme = false;
        setDarkMode(false);
        setAnimationState("SLIDE_TO_LIGHT");
      }
      if (currentState === "SLIDE_TO_LIGHT" && stickman.orbProgress >= 1) {
        stickman.targetX = stickman.homeX;
        stickman.direction = -1;
        setAnimationState("WALK_TO_IDLE");
      }
      if (currentState === "WALK_TO_IDLE" && stickman.x <= stickman.homeX) setAnimationState("IDLE");
      updatePhysics(stickman, deltaTime);
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawHole(context, stickman);
      drawStickman(context, stickman);
      animationFrame = window.requestAnimationFrame(renderLoop);
    }
    animationFrame = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  function startThemeAnimation() {
    if (animationRef.current.state !== "IDLE") return;
    if (!animationRef.current.theme) {
      animationRef.current.startX = animationRef.current.startX || 28;
      animationRef.current.targetX = 44;
      animationRef.current.direction = 1;
      animationRef.current.x = 28;
      animationRef.current.state = "SUN_TO_HOLE";
      return;
    }
    animationRef.current.state = "EXIT_HOLE";
  }

  useEffect(() => {
    getServices().then((items) => {
      if (items.length) {
        setCatalogError("");
        setCatalog(items.map((item) => ({
          ...item,
          title: item.name_en,
          es: item.name_es,
          text: es ? item.description_es : item.description_en,
          provider: item.provider || item.location,
          icon: serviceIcons[item.slug] || "•",
        })));
      } else {
        setCatalogError(es ? "El catálogo completo no está disponible en este momento." : "The full catalog is temporarily unavailable.");
      }
    }).catch(() => {
      setCatalogError(es ? "Mostrando una selección limitada. Intenta actualizar en unos segundos." : "Showing a limited selection. Please refresh in a few seconds.");
    });
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
  }

  return (
    <main>
      <header className="topbar">
        <a className="logo" href="#top" aria-label="TicoListo home"><img className="logo-image" src={darkMode ? "/ticolisto-logo-light.png" : "/ticolisto-logo-clean.png"} alt="TicoListo" /></a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#services">{es ? "Explorar trámites" : "Explore services"}</a>
          <a href="#assistance">{es ? "Necesito ayuda" : "I need help"}</a>
        </nav>
        <div className="topbar-actions">
          <button className="dark-mode-switch" type="button" onClick={startThemeAnimation} aria-label={darkMode ? "Cambiar a paisaje de día" : "Cambiar a paisaje nocturno"} aria-pressed={darkMode}>
            <canvas id="stage" ref={stageRef} width="56" height="48" aria-hidden="true" />
            <span className="dark-mode-icon" aria-hidden="true">{darkMode ? "☀" : "☾"}</span>
          </button>
          <button className="language" onClick={() => setLanguage(es ? "en" : "es")}>{es ? "EN" : "ES"} <span>⌄</span></button>
        </div>
      </header>

      <section className="hero-banner" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{es ? "GUÍA DE SERVICIOS EN COSTA RICA" : "COSTA RICA SERVICE GUIDE"}</p>
          <h1><span>{es ? "Encuentra" : "Find"}</span> {es ? "cómo resolverlo." : "your next step."}</h1>
          <p>{es ? "Trámites y servicios explicados de forma clara, en un solo lugar." : "Public services explained clearly, all in one place."}</p>
        </div>
        <div className="hero-art" aria-hidden="true"><span>CR</span><i>✓</i><b>✦</b></div>
        <div className="search-panel">
          <label htmlFor="service-search">{es ? "¿Qué necesitas resolver?" : "What do you need to solve?"}</label>
          <div className="search-row">
            <span className="search-icon">⌕</span>
            <input id="service-search" className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={es ? "Busca un trámite, servicio o institución" : "Search a service or institution"} />
            <button className="search-button" onClick={() => document.getElementById("services").scrollIntoView({ behavior: "smooth" })}>{es ? "Buscar" : "Search"}</button>
          </div>
          <p className="search-hint">{es ? "Ej.: licencia, pasaporte, propiedad, Hacienda..." : "Example: license, passport, property, taxes..."}</p>
          <button className="assistant-trigger" onClick={openAssistant}>✦ {es ? "¿No sabes cómo buscar? Te guiamos" : "Need help choosing? Ask the assistant"}</button>
          {smartSuggestion && <button className="smart-suggestion" onClick={() => { const match = catalog.find((item) => item.slug === smartSuggestion[1]); if (match) setSelected(match); }}>Asistente sugiere: <strong>{catalog.find((item) => item.slug === smartSuggestion[1])?.es}</strong> →</button>}
        </div>
      </section>

      <section className="category-showcase" aria-labelledby="category-title">
        <div className="section-heading"><div><p className="eyebrow">{es ? "EXPLORA POR CATEGORÍA" : "BROWSE BY CATEGORY"}</p><h2 id="category-title">{es ? "Encuentra tu punto de partida" : "Find your starting point"}</h2></div><span>{es ? "Guías claras, paso a paso" : "Clear, step-by-step guides"}</span></div>
        <div className="category-grid">
          {Object.entries(categoryLabels).filter(([key]) => key !== "all").slice(0, 8).map(([key, labels]) => (
            <button className={`category-card category-${key}`} key={key} onClick={() => { setCategory(key); document.getElementById("services").scrollIntoView({ behavior: "smooth" }); }}>
              <span className="category-card-icon">{({ transport: "TR", vehicles: "VH", paperwork: "DOC", identity: "ID", travel: "TRIP", property: "HOME", business: "BIZ", family: "FAM" })[key]}</span>
              <strong>{labels[es ? 0 : 1]}</strong><small>{catalog.filter((item) => item.category === key).length} {es ? "servicios" : "services"}</small><span className="category-card-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="popular-section" aria-labelledby="popular-title">
        <div className="section-heading"><div><p className="eyebrow">{es ? "LO MÁS BUSCADO" : "POPULAR SERVICES"}</p><h2 id="popular-title">{es ? "Trámites que más consultan" : "Most requested services"}</h2></div><span>{es ? "Accesos rápidos para empezar" : "Quick ways to get started"}</span></div>
        <div className="popular-grid">
          {catalog.filter((service, index) => popularServiceSlugs.includes(service.slug) || (!service.slug && index < 4)).slice(0, 4).map((service) => (
            <button className="popular-card" key={service.slug} onClick={() => setSelected(service)}><span className="row-icon">{service.icon}</span><span><strong>{es ? service.es : service.title}</strong><small>{service.provider || service.location}</small></span><span className="row-arrow">›</span></button>
          ))}
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
          {catalogError && <div className="catalog-status" role="status"><span aria-hidden="true">!</span><p>{catalogError}</p><button type="button" onClick={() => window.location.reload()}>{es ? "Actualizar" : "Refresh"}</button></div>}
          <div className="service-list">
            {filtered.map((service) => (
              <button className="service-row" key={service.slug || service.category} onClick={() => setSelected(service)}>
                <span className="row-icon">{service.icon}</span>
                <span className="row-copy"><strong>{es ? service.es : service.title}</strong><small>{service.provider || service.location}</small></span>
                <span className="row-arrow">›</span>
              </button>
            ))}
          </div>
          {!filtered.length && <div className="empty-state"><span className="empty-icon">⌕</span><h3>{es ? "No encontramos resultados" : "No results found"}</h3><p>{es ? "Prueba con otra palabra o explora una categoría para encontrar una guía útil." : "Try another keyword or browse a category to find a useful guide."}</p><button className="secondary" onClick={() => { setQuery(""); setCategory("all"); }}>{es ? "Ver todos los servicios" : "View all services"}</button></div>}
        </div>
      </section>

      <section className="assistance" id="assistance">
        <div><p className="eyebrow">TICOLISTO CONCIERGE</p><h2>{es ? "¿No encuentras lo que buscas?" : "Can't find what you need?"}</h2><p>{es ? "Cuéntanos qué necesitas y te ayudamos a ordenar los siguientes pasos." : "Tell us what you need and we'll help you find the next step."}</p></div>
        {sent ? (
          <div className="success" role="status">
            ✓ {es ? "Solicitud recibida. Te contactaremos pronto." : "Request received. We will contact you soon."}
            {chatToken && (
              <div className="client-chat">
                <div className="client-chat-header"><div><p className="eyebrow">Seguimiento privado</p><h3>💬 Conversación con tu gestor</h3><span className="chat-online"><i /> Canal activo · respuesta durante horario de atención</span></div><span className="chat-lock">🔒</span></div>
                <p className="client-chat-help">Consulta el avance, envía documentos o responde a las solicitudes de tu gestor.</p>
                <div className="chat-messages" aria-live="polite">
                  {chatMessages.length ? chatMessages.map((item) => <div className={item.author === "Cliente" ? "chat-message mine" : "chat-message"} key={item.id}><div className="chat-message-meta"><strong>{item.author === "Cliente" ? "Tú" : item.author}</strong><time>{item.created_at ? new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at)) : ""}</time></div><span>{item.message}</span></div>) : <div className="chat-empty">Todavía no hay mensajes. Escribe para iniciar la conversación.</div>}
                </div>
                <form onSubmit={handleChatSubmit} className="chat-form"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Escribe tu mensaje..." aria-label="Mensaje para el gestor" /><button className="primary" disabled={chatSending || !chatDraft.trim()}>{chatSending ? "Enviando..." : "Enviar →"}</button></form>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="assistance-form">
            <div className="form-progress"><span className={assistanceStep >= 1 ? "active" : ""}>1. Contact</span><span className={assistanceStep >= 2 ? "active" : ""}>2. Need</span><span className={assistanceStep >= 3 ? "active" : ""}>3. Confirm</span></div>
            <div className={assistanceStep === 1 ? "form-step" : "form-step is-hidden"}><p className="step-label">How can we contact you?</p><input name="name" required minLength="2" placeholder={es ? "Tu nombre" : "Your name"} /><input name="email" required type="email" placeholder={es ? "Tu correo" : "Your email"} /><input name="phone" required minLength="7" placeholder={es ? "Tu telefono" : "Your phone"} /><button className="primary" type="button" onClick={() => setAssistanceStep(2)}>Continue →</button></div>
            <div className={assistanceStep === 2 ? "form-step" : "form-step is-hidden"}><p className="step-label">Tell us what you need</p><input name="location" required placeholder={es ? "Tu ubicacion" : "Your location"} /><select name="province" value={province} onChange={(event) => setProvince(event.target.value)} required><option value="">Province</option>{["San Jose","Alajuela","Cartago","Heredia","Guanacaste","Puntarenas","Limon"].map((item) => <option key={item}>{item}</option>)}</select><select name="category" defaultValue="general"><option value="general">General inquiry</option><option value="paperwork">Paperwork</option><option value="vehicles">Vehicles</option></select><textarea name="description" required minLength="10" value={contactNote} onChange={(event) => setContactNote(event.target.value)} placeholder={es ? "Como podemos ayudarte?" : "How can we help?"} /><div className="form-actions"><button className="secondary" type="button" onClick={() => setAssistanceStep(1)}>Back</button><button className="primary" type="button" onClick={() => setAssistanceStep(3)}>Review request →</button></div></div>
            <div className={assistanceStep === 3 ? "form-step" : "form-step is-hidden"}><p className="step-label">Ready to send?</p><p className="review-copy">We will review your request and contact you soon.</p><label className="consent-check"><input name="consent" type="checkbox" required />I agree that TicoListo may use this information to manage my request.</label><div className="form-actions"><button className="secondary" type="button" onClick={() => setAssistanceStep(2)}>Edit</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send request"} →</button></div>{error && <p className="form-error" role="alert">{error}</p>}</div>
          </form>
        )}
      </section>

      <footer><span className="logo"><img className="logo-image" src={darkMode ? "/ticolisto-logo-light.png" : "/ticolisto-logo-clean.png"} alt="TicoListo" /></span><span>{es ? "Una guía más clara para Costa Rica." : "A clearer guide to Costa Rica."}</span></footer>
      {assistantOpen && <div className="assistant-card"><button className="assistant-close" onClick={() => setAssistantOpen(false)}>×</button><strong>✦ Asistente de trámites</strong>{assistantStep === 1 && <><p>¿Qué necesitas resolver?</p><div className="assistant-options">{["Licencia o vehículo", "Pasaporte o cédula", "Propiedad o vivienda", "Negocio o Hacienda"].map((option) => <button key={option} onClick={() => { setQuery(option.split(" ")[0]); setAssistantStep(2); }}>{option}</button>)}</div></>}{assistantStep === 2 && <><p>Perfecto. Busca el resultado sugerido o selecciona un trámite del catálogo. También puedes delegarlo desde su ficha.</p><button className="primary" onClick={() => { setAssistantOpen(false); document.getElementById("services").scrollIntoView({ behavior: "smooth" }); }}>Ver trámites recomendados</button></>}</div>}
      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal service-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><span className="service-icon">{selected.icon}</span><h2>{es ? selected.es : selected.title}</h2><p>{selected.text}</p><p className="service-location">Institución responsable: {selectedInstructions.institution}</p><p><a className="service-language-link" href={`${es ? "/es/servicios/" + (selected.slug_es || selected.slug) : "/en/services/" + (selected.slug_en || selected.slug)}`}>{es ? "Abrir página completa de este servicio →" : "Open full service page →"}</a></p><section className="modal-guide self-service"><h3>✓ {es ? "OPCIÓN 1: HACERLO TÚ MISMO" : "OPTION 1: DO IT YOURSELF"}</h3><p><strong>{es ? "Requisitos y documentos:" : "Requirements and documents:"}</strong> {selectedInstructions.requirements}</p><ol>{selectedInstructions.steps.map((step) => <li key={step}>{step}</li>)}</ol><a className="official-link" href={selectedInstructions.url} target="_blank" rel="noopener noreferrer"><span>↗</span><strong>{es ? "Ir al sitio oficial" : "Open official website"}</strong><small>Portal de {selectedInstructions.institution} ↗</small></a><small className="direct-url">URL directa: {selectedInstructions.url}</small></section><section className="modal-guide delegate-service"><h3>★ {es ? "OPCIÓN 2: ¿PREFIERES QUE LO HAGAMOS POR TI?" : "OPTION 2: LET US HANDLE IT"}</h3><p>{es ? "Si no tienes tiempo o prefieres acompañamiento, nuestro equipo puede encargarse del proceso y darle seguimiento." : "Our team can handle the process and follow up for you."}</p><button className="delegate-button" onClick={() => { setContactNote(`Necesito delegar el trámite: ${selected.es || selected.title}. Quiero conocer los requisitos y el costo de la asistencia.`); setSelected(null); document.getElementById("assistance").scrollIntoView({ behavior: "smooth" }); }}><span>→</span><strong>{es ? "Contactar a un gestor" : "Contact a specialist"}</strong><small>Recibe acompañamiento personalizado →</small></button></section></div></div>}
    </main>
  );
}
