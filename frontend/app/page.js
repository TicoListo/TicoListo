"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createAssistanceRequest, getCategoryTheme, getChatMessages, getCurrentUser, getMyAssistanceRequests, getServices, loginAccount, logoutAccount, registerAccount, sendChatMessage } from "./lib/api";

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

const categoryIcons = {
  transport: "✈", vehicles: "◈", paperwork: "▤", identity: "◎",
  travel: "⌁", property: "⌂", business: "▦", family: "♧",
};

const categoryBackgrounds = {
  transport: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80",
  vehicles: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
  paperwork: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
  identity: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=900&q=80",
  travel: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80",
  property: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80",
  business: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
  family: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=80",
};

const categoryLabels = {
  all: ["Todos los trámites", "All services"], transport: ["Transporte", "Transport"],
  vehicles: ["Vehículos", "Vehicles"], paperwork: ["Documentos", "Paperwork"],
  identity: ["Identidad", "Identity"], travel: ["Viajes", "Travel"], property: ["Propiedades", "Property"],
  business: ["Negocios", "Business"], family: ["Familia", "Family"], work: ["Trabajo", "Work"],
  health: ["Salud", "Health"], housing: ["Vivienda", "Housing"],
};

const defaultCategoryTheme = {
  variant: "glass", accent: "#8b5cf6", accent_soft: "#ede9fe",
  surface: "#ffffff", radius: 22, show_arrow: true,
};

const smartMatches = [
  ["perdí mi cédula", "lost-id"], ["licencia", "renew-drivers-license"], ["pasaporte", "passport-renewal"],
  ["abrir negocio", "business-checklist"], ["despido", "dismissal-next-steps"], ["propiedad", "buy-property"],
  ["marchamo", "marchamo"], ["incapacidad", "ccss-sick-leave"], ["casarme", "civil-marriage"],
];

const searchAliases = {
  licencia: ["licencias", "conducir", "manejar", "carne", "carnet", "license", "driver", "driving", "drivers"],
  pasaporte: ["viajar", "migracion", "migración", "extranjero", "salir del pais", "salir del país", "passport", "travel", "abroad", "immigration"],
  cedula: ["cédula", "cedula", "identificacion", "identificación", "documento", "id", "identity", "identification", "national id"],
  vehiculo: ["vehículo", "vehiculo", "carro", "auto", "moto", "placa", "vehicle", "car", "motorcycle", "plate"],
  propiedad: ["casa", "terreno", "lote", "finca", "inmueble", "vivienda", "property", "house", "land", "home"],
  negocio: ["empresa", "emprender", "comercio", "patente", "pyme", "abrir negocio", "business", "company", "entrepreneur", "permit"],
  impuestos: ["hacienda", "tributos", "declaracion", "declaración", "iva", "renta", "tax", "taxes", "income", "vat"],
  salud: ["medico", "médico", "hospital", "ccss", "incapacidad", "permiso sanitario", "health", "medical", "hospital", "sick leave"],
  familia: ["casamiento", "matrimonio", "nacimiento", "defuncion", "defunción", "hijo", "family", "marriage", "birth", "child"],
};

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getSearchTerms(value) {
  const normalized = normalizeSearchText(value);
  const stopWords = new Set(["a", "al", "con", "de", "el", "en", "la", "lo", "me", "mi", "necesito", "para", "por", "que", "quiero", "un", "una", "i", "a", "an", "and", "can", "do", "find", "help", "i", "is", "me", "my", "need", "please", "the", "to", "want", "with"]);
  const terms = normalized.split(/\s+/).filter((term) => term.length > 1 && !stopWords.has(term));
  const expanded = new Set(terms);
  Object.entries(searchAliases).forEach(([key, aliases]) => {
    if (terms.includes(key) || aliases.some((alias) => terms.includes(normalizeSearchText(alias)))) {
      expanded.add(key);
      aliases.forEach((alias) => expanded.add(normalizeSearchText(alias)));
    }
  });
  return { phrase: normalized, terms: [...expanded] };
}

function getServiceSearchText(service, categoryLabels) {
  const category = categoryLabels[service.category] || [];
  return normalizeSearchText([
    service.title, service.es, service.text, service.description,
    service.provider, service.location, service.slug, service.category,
    category[0], category[1],
  ].filter(Boolean).join(" "));
}

function scoreServiceSearch(service, search, categoryLabels) {
  const searchText = getServiceSearchText(service, categoryLabels);
  if (!search.phrase) return 0;
  const searchWords = new Set(searchText.split(/\s+/));
  let score = searchText.includes(search.phrase) ? 100 : 0;
  search.terms.forEach((term) => {
    const matchesWord = [...searchWords].some((word) =>
      word === term || (term.length >= 4 && word.startsWith(term)) || (word.length >= 4 && term.startsWith(word))
    );
    if (matchesWord) score += searchText.startsWith(term) ? 12 : 8;
  });
  return score;
}

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
  "airport-transfer": ["Aeropuertos SJO y LIR", "https://sjoairport.com"],
  "paperwork-help": ["Ventanilla Única de Inversión (VUI)", "https://www.vui.cr"],
  "housing-guidance": ["Registro Nacional / municipalidad correspondiente", "https://www.rnpdigital.com"],
  "health-navigation": ["Caja Costarricense de Seguro Social (CCSS)", "https://www.ccss.sa.cr"],
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
  const knownDetails = serviceOfficialDetails[service.slug] || [];
  const institution = knownDetails[0] || "Institución responsable";
  const url = service.official_url || knownDetails[1] || null;
  const sources = url ? [[institution, url]] : [];
  return {
    institution: service.provider || institution,
    url,
    sources,
    hasWebsite: sources.length > 0 && sources.some(([, sourceUrl]) => /^https?:\/\/\S+$/i.test(sourceUrl)),
    requirements: {
      es: "Documento de identificación vigente, comprobantes y requisitos específicos indicados por la institución responsable.",
      en: "Valid identification, supporting documents, and any specific requirements listed by the responsible institution.",
    },
    steps: [
      { es: "Ingresa al portal oficial y verifica los requisitos actualizados.", en: "Open the official portal and verify the current requirements." },
      { es: "Prepara los documentos y solicita una cita o inicia el formulario correspondiente.", en: "Prepare the documents and book an appointment or start the relevant form." },
      { es: "Realiza el pago o presenta la documentación cuando el trámite lo solicite.", en: "Pay or submit the documents when the service requires it." },
      { es: "Guarda el comprobante y da seguimiento hasta recibir la respuesta.", en: "Save the receipt and follow up until you receive a response." },
    ],
  };
}

export default function Home() {
  const [catalog, setCatalog] = useState(fallbackServices);
  const [language, setLanguage] = useState("es");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistanceStep, setAssistanceStep] = useState(1);
  const [province, setProvince] = useState("");
  const [assistanceCategory, setAssistanceCategory] = useState("general");
  const [chatToken, setChatToken] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState("login");
  const [accountForm, setAccountForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [accountRequests, setAccountRequests] = useState([]);
  const [accountError, setAccountError] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [categoryTheme, setCategoryTheme] = useState(defaultCategoryTheme);
  const [categoryFilterKey, setCategoryFilterKey] = useState("all");
  const stageRef = useRef(null);
  const animationRef = useRef({ state: "IDLE", theme: false });
  const es = language === "es";
  const selectedInstructions = selected ? getInstructions(selected) : null;

  function selectCategory(nextCategory) {
    setCategoryFilterKey(nextCategory);
    setCategory(nextCategory);
  }

  useEffect(() => {
    getCategoryTheme().then(setCategoryTheme).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    getCurrentUser().then((user) => {
      setCurrentUser(user);
      return getMyAssistanceRequests();
    }).then(setAccountRequests).catch(() => {
      setCurrentUser(null);
      setAccountRequests([]);
    });
  }, []);

  function openAccount(mode = currentUser ? "dashboard" : "login") {
    setAccountMode(mode);
    setAccountError("");
    setAccountOpen(true);
  }

  function startDekraAssistance() {
    setAssistanceCategory("dekra");
    setContactNote(es ? "Necesito que un asistente de TicoListo lleve mi carro a DEKRA. Quiero coordinar la recogida, inspección y devolución del vehículo." : "I need a TicoListo assistant to take my car to DEKRA. I would like to coordinate pickup, inspection, and vehicle return.");
    document.getElementById("assistance").scrollIntoView({ behavior: "smooth" });
    if (!currentUser) openAccount("register");
  }

  async function submitAccount(event) {
    event.preventDefault();
    setAccountError("");
    setAccountLoading(true);
    try {
      const user = accountMode === "login"
        ? await loginAccount({ email: accountForm.email, password: accountForm.password })
        : await registerAccount(accountForm);
      setCurrentUser(user);
      setAccountRequests(await getMyAssistanceRequests());
      setAccountMode("dashboard");
    } catch (accountRequestError) {
      setAccountError(accountRequestError.message);
    } finally {
      setAccountLoading(false);
    }
  }

  async function signOut() {
    await logoutAccount();
    setCurrentUser(null);
    setAccountRequests([]);
    setAccountOpen(false);
  }

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

  const search = useMemo(() => getSearchTerms(query), [query]);
  const filtered = useMemo(() => catalog
    .filter((service) => category === "all" || service.category === category)
    .map((service, index) => ({ service, index, score: scoreServiceSearch(service, search, categoryLabels) }))
    .filter(({ score }) => !search.phrase || score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ service }) => service), [catalog, category, language, search]);
  const smartSuggestion = smartMatches.find(([term]) => search.phrase.includes(normalizeSearchText(term)));

  function openAssistant() {
    setAssistantOpen(true);
    setAssistantMessages((messages) => messages.length ? messages : [{
      role: "bot",
      text: es
        ? "¡Hola! Soy el asistente de TicoListo. Cuéntame qué necesitas hacer y te recomendaré los trámites más útiles."
        : "Hi! I am the TicoListo assistant. Tell me what you need to do and I will recommend the most useful services.",
    }]);
  }

  function selectLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    setLanguageMenuOpen(false);
    setAssistantMessages([]);
    setAssistantDraft("");
  }

  function askAssistant(message) {
    const trimmed = message.trim();
    if (!trimmed) return;
    const assistantSearch = getSearchTerms(trimmed);
    const recommendations = catalog
      .map((service, index) => ({ service, index, score: scoreServiceSearch(service, assistantSearch, categoryLabels) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 3)
      .map(({ service }) => service);
    const top = recommendations[0];
    const response = top
      ? (es
        ? `Por lo que describes, empezaría con "${top.es || top.title}". ${top.provider ? `La institución relacionada es ${top.provider}.` : ""} También encontré otras opciones que pueden servirte.`
        : `Based on what you described, I would start with "${top.title || top.es}". ${top.provider ? `The related institution is ${top.provider}.` : ""} I also found other options that may help.`)
      : (es
        ? "No encontré una coincidencia exacta todavía. Prueba con palabras como licencia, pasaporte, cédula, carro, propiedad, negocio o Hacienda."
        : "I could not find an exact match yet. Try words like license, passport, ID, car, property, business or taxes.");
    setAssistantMessages((messages) => [
      ...messages,
      { role: "user", text: trimmed },
      { role: "bot", text: response, recommendations },
    ]);
    setAssistantDraft("");
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
    <main className={`category-theme-${categoryTheme.variant}`} style={{
      "--category-accent": categoryTheme.accent,
      "--category-accent-soft": categoryTheme.accent_soft,
      "--category-surface": categoryTheme.surface,
      "--category-radius": `${categoryTheme.radius}px`,
    }}>
      <header className="topbar">
        <a className="logo" href="#top" aria-label="TicoListo home"><img className="logo-image" src={darkMode ? "/ticolisto-logo-light.png" : "/ticolisto-logo-clean.png"} alt="TicoListo" /></a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#services">{es ? "Explorar trámites" : "Explore services"}</a>
          <a href="#assistance">{es ? "Necesito ayuda" : "I need help"}</a>
          <button className="nav-account-link" type="button" onClick={() => openAccount()}>{currentUser ? (es ? "Mi panel" : "My workspace") : (es ? "Mi cuenta" : "My account")}</button>
        </nav>
        <div className="topbar-actions">
          <button className="dark-mode-switch" type="button" onClick={startThemeAnimation} aria-label={darkMode ? "Cambiar a paisaje de día" : "Cambiar a paisaje nocturno"} aria-pressed={darkMode}>
            <canvas id="stage" ref={stageRef} width="56" height="48" aria-hidden="true" />
            <span className="dark-mode-icon" aria-hidden="true">{darkMode ? "☀" : "☾"}</span>
          </button>
          <div className={`language-picker ${languageMenuOpen ? "is-open" : ""}`}>
            <button
              className="language-picker-toggle"
              type="button"
              onClick={() => setLanguageMenuOpen((open) => !open)}
              aria-expanded={languageMenuOpen}
              aria-haspopup="listbox"
              aria-label={es ? "Seleccionar idioma" : "Select language"}
            >
              <span className={`flag flag-${language}`} aria-hidden="true" />
              <span className="language-current">{es ? "ES" : "EN"}</span>
              <span className="language-chevron" aria-hidden="true">⌄</span>
            </button>
            {languageMenuOpen && <div className="language-menu" role="listbox" aria-label={es ? "Idiomas disponibles" : "Available languages"}>
              <p>{es ? "IDIOMA" : "LANGUAGE"}</p>
              <button className={es ? "language-option selected" : "language-option"} type="button" role="option" aria-selected={es} onClick={() => selectLanguage("es")}>
                <span className="language-label">ESPAÑOL</span><span className="flag flag-es" aria-hidden="true" /><strong>ES</strong>
              </button>
              <button className={!es ? "language-option selected" : "language-option"} type="button" role="option" aria-selected={!es} onClick={() => selectLanguage("en")}>
                <span className="language-label">ENGLISH</span><span className="flag flag-en" aria-hidden="true" /><strong>EN</strong>
              </button>
            </div>}
          </div>
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
          <button
            className={`assistant-trigger ${assistantOpen ? "is-open" : ""}`}
            type="button"
            onClick={() => {
              if (assistantOpen) {
                setAssistantOpen(false);
              } else {
                openAssistant();
              }
            }}
            aria-expanded={assistantOpen}
            aria-controls="services-assistant"
          >
            {assistantOpen ? "×" : "✦"} {assistantOpen
              ? (es ? "Cerrar chatbot" : "Close chatbot")
              : (es ? "¿No sabes cómo buscar? Te guiamos" : "Need help choosing? Ask the assistant")}
          </button>
          {smartSuggestion && <button className="smart-suggestion" onClick={() => { const match = catalog.find((item) => item.slug === smartSuggestion[1]); if (match) setSelected(match); }}>Asistente sugiere: <strong>{catalog.find((item) => item.slug === smartSuggestion[1])?.es}</strong> →</button>}
        </div>
      </section>

      <section className="category-showcase" aria-labelledby="category-title">
        <div className="section-heading"><div><p className="eyebrow">{es ? "EXPLORA POR CATEGORÍA" : "BROWSE BY CATEGORY"}</p><h2 id="category-title">{es ? "Encuentra tu punto de partida" : "Find your starting point"}</h2></div><span>{es ? "Guías claras, paso a paso" : "Clear, step-by-step guides"}</span></div>
        <button className="dekra-start-card" type="button" onClick={startDekraAssistance}>
          <span className="dekra-start-icon" aria-hidden="true">🚗</span>
          <span><strong>{es ? "¿Necesitas llevar tu carro a DEKRA?" : "Need to take your car to DEKRA?"}</strong><small>{es ? "Un asistente de TicoListo lo lleva por ti y coordina la devolución." : "A TicoListo assistant takes it for you and coordinates its return."}</small></span>
          <span className="dekra-start-action">{es ? "Solicitar asistencia" : "Request assistance"} →</span>
        </button>
        <div className="category-grid">
          {Object.entries(categoryLabels).filter(([key]) => key !== "all").slice(0, 8).map(([key, labels]) => (
            <button className={`category-card category-${key}`} key={key} style={{ "--category-image": `url("${categoryBackgrounds[key]}")` }} onClick={() => { selectCategory(key); document.getElementById("services").scrollIntoView({ behavior: "smooth" }); }}>
              <span className="category-card-topline">
                <span className="category-card-icon" aria-hidden="true">{categoryIcons[key]}</span>
                <span className="category-card-count">{catalog.filter((item) => item.category === key).length}</span>
              </span>
              <span className="category-card-copy"><strong>{labels[es ? 0 : 1]}</strong><small>{es ? "Explorar servicios" : "Explore services"}</small></span>
              {categoryTheme.show_arrow && <span className="category-card-action">{es ? "Ver categoría" : "View category"} <span aria-hidden="true">↗</span></span>}
            </button>
          ))}
          <button className="category-card category-dekra" type="button" onClick={startDekraAssistance}>
            <span className="category-card-topline">
              <span className="category-card-icon" aria-hidden="true">🚗</span>
              <span className="category-card-count">★</span>
            </span>
            <span className="category-card-copy"><strong>{es ? "Asistencia DEKRA" : "DEKRA assistance"}</strong><small>{es ? "Llevamos tu carro por ti" : "We take your car for you"}</small></span>
            {categoryTheme.show_arrow && <span className="category-card-action">{es ? "Solicitar asistencia" : "Request assistance"} <span aria-hidden="true">↗</span></span>}
          </button>
        </div>
        <div className="category-chip-nav" role="tablist" aria-label={es ? "Filtrar por categoría" : "Filter by category"}>
          {Object.entries(categoryLabels).map(([key, labels]) => (
            <button
              className={category === key ? "category-chip active" : "category-chip"}
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              onClick={() => selectCategory(key)}
            >
              <span>{key === "all" ? "✦" : categoryIcons[key]}</span>{labels[es ? 0 : 1]}
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
            <button className={category === key ? "filter active" : "filter"} key={key} onClick={() => selectCategory(key)}>
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
          <div className={`service-list ${categoryFilterKey === category ? "is-filtered" : ""}`} key={categoryFilterKey}>
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
                <div className="client-chat-header"><div><p className="eyebrow">{es ? "Seguimiento privado" : "Private follow-up"}</p><h3>💬 {es ? "Conversación con tu gestor" : "Chat with your case manager"}</h3><span className="chat-online"><i /> {es ? "Canal activo · respuesta durante horario de atención" : "Active channel · replies during business hours"}</span></div><span className="chat-lock">🔒</span></div>
                <p className="client-chat-help">{es ? "Consulta el avance, envía documentos o responde a las solicitudes de tu gestor." : "Check your progress, send documents, or reply to your case manager."}</p>
                <div className="chat-messages" aria-live="polite">
                  {chatMessages.length ? chatMessages.map((item) => <div className={item.author === "Cliente" ? "chat-message mine" : "chat-message"} key={item.id}><div className="chat-message-meta"><strong>{item.author === "Cliente" ? (es ? "Tú" : "You") : item.author}</strong><time>{item.created_at ? new Intl.DateTimeFormat(es ? "es-CR" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at)) : ""}</time></div><span>{item.message}</span></div>) : <div className="chat-empty">{es ? "Todavía no hay mensajes. Escribe para iniciar la conversación." : "There are no messages yet. Write to start the conversation."}</div>}
                </div>
                <form onSubmit={handleChatSubmit} className="chat-form"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder={es ? "Escribe tu mensaje..." : "Write your message..."} aria-label={es ? "Mensaje para el gestor" : "Message for your case manager"} /><button className="primary" disabled={chatSending || !chatDraft.trim()}>{chatSending ? (es ? "Enviando..." : "Sending...") : (es ? "Enviar →" : "Send →")}</button></form>
              </div>
            )}
          </div>
        ) : !currentUser ? (
          <div className="account-required">
            <p className="step-label">{es ? "Crea una cuenta para continuar" : "Create an account to continue"}</p>
            <p>{es ? "Necesitas una cuenta para enviar solicitudes y consultar su avance de forma segura." : "You need an account to submit requests and securely track your progress."}</p>
            <button className="primary account-required-link" type="button" onClick={() => openAccount("register")}>{es ? "Crear cuenta o iniciar sesión" : "Create an account or sign in"} →</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="assistance-form">
            <div className="form-progress"><span className={assistanceStep >= 1 ? "active" : ""}>1. Contact</span><span className={assistanceStep >= 2 ? "active" : ""}>2. Need</span><span className={assistanceStep >= 3 ? "active" : ""}>3. Confirm</span></div>
            <div className={assistanceStep === 1 ? "form-step" : "form-step is-hidden"}><p className="step-label">{es ? "¿Cómo podemos contactarte?" : "How can we contact you?"}</p><input name="name" required minLength="2" placeholder={es ? "Tu nombre" : "Your name"} /><input name="email" required type="email" placeholder={es ? "Tu correo" : "Your email"} /><input name="phone" required minLength="7" placeholder={es ? "Tu teléfono" : "Your phone"} /><button className="primary" type="button" onClick={() => setAssistanceStep(2)}>{es ? "Continuar" : "Continue"} →</button></div>
            <div className={assistanceStep === 2 ? "form-step" : "form-step is-hidden"}><p className="step-label">{es ? "Cuéntanos qué necesitas" : "Tell us what you need"}</p><input name="location" required placeholder={es ? "Tu ubicación" : "Your location"} /><select name="province" value={province} onChange={(event) => setProvince(event.target.value)} required><option value="">{es ? "Provincia" : "Province"}</option>{["San Jose","Alajuela","Cartago","Heredia","Guanacaste","Puntarenas","Limon"].map((item) => <option key={item}>{item}</option>)}</select><select name="category" value={assistanceCategory} onChange={(event) => { const value = event.target.value; setAssistanceCategory(value); if (value === "dekra") setContactNote(es ? "Necesito que un asistente de TicoListo lleve mi carro a DEKRA. Quiero coordinar la recogida, inspección y devolución del vehículo." : "I need a TicoListo assistant to take my car to DEKRA. I would like to coordinate pickup, inspection, and vehicle return."); }}><option value="general">{es ? "Consulta general" : "General inquiry"}</option><option value="paperwork">{es ? "Trámites" : "Paperwork"}</option><option value="vehicles">{es ? "Vehículos" : "Vehicles"}</option><option value="dekra">{es ? "Llevar mi carro a DEKRA" : "Take my car to DEKRA"}</option></select><textarea name="description" required minLength="10" value={contactNote} onChange={(event) => setContactNote(event.target.value)} placeholder={es ? "¿Cómo podemos ayudarte?" : "How can we help?"} /><div className="form-actions"><button className="secondary" type="button" onClick={() => setAssistanceStep(1)}>{es ? "Atrás" : "Back"}</button><button className="primary" type="button" onClick={() => setAssistanceStep(3)}>{es ? "Revisar solicitud" : "Review request"} →</button></div></div>
            <div className={assistanceStep === 3 ? "form-step" : "form-step is-hidden"}><p className="step-label">{es ? "¿Lista para enviar?" : "Ready to send?"}</p><p className="review-copy">{es ? "Revisaremos tu solicitud y te contactaremos pronto." : "We will review your request and contact you soon."}</p><label className="consent-check"><input name="consent" type="checkbox" required />{es ? "Acepto que TicoListo use esta información para gestionar mi solicitud." : "I agree that TicoListo may use this information to manage my request."}</label><div className="form-actions"><button className="secondary" type="button" onClick={() => setAssistanceStep(2)}>{es ? "Editar" : "Edit"}</button><button className="primary" type="submit" disabled={submitting}>{submitting ? (es ? "Enviando..." : "Sending...") : (es ? "Enviar solicitud" : "Send request")} →</button></div>{error && <p className="form-error" role="alert">{error}</p>}</div>
          </form>
        )}
      </section>

      <footer><span className="logo"><img className="logo-image" src={darkMode ? "/ticolisto-logo-light.png" : "/ticolisto-logo-clean.png"} alt="TicoListo" /></span><span>{es ? "Una guía más clara para Costa Rica." : "A clearer guide to Costa Rica."}</span></footer>
      {assistantOpen && <section className="assistant-card" id="services-assistant" aria-label={es ? "Chatbot de trámites" : "Services chatbot"}>
        <button className="assistant-close" onClick={() => setAssistantOpen(false)} aria-label={es ? "Cerrar asistente" : "Close assistant"}>×</button>
        <div className="assistant-header"><span className="assistant-avatar">✦</span><div><strong>{es ? "Asistente de trámites" : "Services assistant"}</strong><small>{es ? "Orientación inteligente" : "Smart guidance"}</small></div></div>
        <div className="assistant-messages" aria-live="polite">
          {assistantMessages.map((message, index) => <div className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}><p>{message.text}</p>{message.recommendations?.length > 0 && <div className="assistant-recommendations">{message.recommendations.map((service) => <button type="button" key={service.slug} onClick={() => setSelected(service)}><span>{service.icon}</span><strong>{es ? service.es : service.title}</strong><span>›</span></button>)}</div>}</div>)}
        </div>
        <div className="assistant-quick-actions">{(es ? ["Licencia", "Pasaporte", "Cédula", "Propiedad"] : ["Driver's license", "Passport", "ID", "Property"]).map((suggestion) => <button type="button" key={suggestion} onClick={() => askAssistant(suggestion)}>{suggestion}</button>)}</div>
        <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); askAssistant(assistantDraft); }}>
          <input value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} placeholder={es ? "Escribe qué necesitas..." : "Tell me what you need..."} aria-label={es ? "Mensaje para el asistente" : "Message for assistant"} />
          <button type="submit" aria-label={es ? "Enviar mensaje" : "Send message"}>→</button>
        </form>
      </section>}
      {accountOpen && <div className="modal-backdrop" onClick={() => setAccountOpen(false)}>
        <section className="modal account-modal" onClick={(event) => event.stopPropagation()} aria-labelledby="account-title">
          <button className="close" type="button" onClick={() => setAccountOpen(false)} aria-label={es ? "Cerrar cuenta" : "Close account"}>×</button>
          <p className="eyebrow">TICOLISTO</p>
          {accountMode === "dashboard" ? (
            <>
              <h2 id="account-title">{es ? "Tu espacio de trámites" : "Your service workspace"}</h2>
              <p>{es ? `Hola, ${currentUser?.full_name}. Aquí puedes revisar tus solicitudes y su seguimiento.` : `Hi, ${currentUser?.full_name}. Review your requests and follow-up here.`}</p>
              <div className="account-request-list">
                {accountRequests.length ? accountRequests.map((item) => <article key={item.id}><strong>#{item.id} · {item.category}</strong><span>{item.status}</span><p>{item.description}</p></article>) : <p>{es ? "Aún no tienes solicitudes. Cierra este panel y completa el formulario." : "You have no requests yet. Close this panel and complete the form."}</p>}
              </div>
              <div className="account-modal-actions"><button className="primary" type="button" onClick={() => { setAccountOpen(false); document.getElementById("assistance").scrollIntoView({ behavior: "smooth" }); }}>{es ? "Crear solicitud" : "Create request"} →</button><button className="secondary" type="button" onClick={signOut}>{es ? "Cerrar sesión" : "Sign out"}</button></div>
            </>
          ) : (
            <>
              <h2 id="account-title">{accountMode === "login" ? (es ? "Bienvenido de nuevo" : "Welcome back") : (es ? "Crea tu cuenta" : "Create your account")}</h2>
              <p>{es ? "Una cuenta te permite enviar solicitudes y seguir cada avance." : "An account lets you submit requests and track every update."}</p>
              <div className="account-tabs"><button className={accountMode === "login" ? "active" : ""} type="button" onClick={() => setAccountMode("login")}>{es ? "Iniciar sesión" : "Sign in"}</button><button className={accountMode === "register" ? "active" : ""} type="button" onClick={() => setAccountMode("register")}>{es ? "Crear cuenta" : "Create account"}</button></div>
              <form onSubmit={submitAccount} className="account-form">
                {accountMode === "register" && <><label>{es ? "Nombre completo" : "Full name"}<input required minLength="2" value={accountForm.full_name} onChange={(event) => setAccountForm({ ...accountForm, full_name: event.target.value })} /></label><label>{es ? "Teléfono (opcional)" : "Phone (optional)"}<input value={accountForm.phone} onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value })} /></label></>}
                <label>{es ? "Correo electrónico" : "Email"}<input required type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} /></label>
                <label>{es ? "Contraseña" : "Password"}<input required minLength={accountMode === "register" ? 10 : 1} type="password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} /></label>
                <button className="primary" disabled={accountLoading} type="submit">{accountLoading ? (es ? "Procesando..." : "Processing...") : accountMode === "login" ? (es ? "Entrar" : "Sign in") : (es ? "Crear cuenta" : "Create account")} →</button>
              </form>
              {accountError && <p role="alert" className="form-error">{accountError}</p>}
            </>
          )}
        </section>
      </div>}
      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal service-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><span className="service-icon">{selected.icon}</span><h2>{es ? selected.es : selected.title}</h2><p>{selected.text}</p><p className="service-location">{es ? "Institución responsable:" : "Responsible institution:"} {selectedInstructions.institution}</p><p><a className="service-language-link" href={`${es ? "/es/servicios/" + (selected.slug_es || selected.slug) : "/en/services/" + (selected.slug_en || selected.slug)}`}>{es ? "Abrir página completa de este servicio →" : "Open full service page →"}</a></p>{selectedInstructions.hasWebsite && <section className="modal-guide self-service"><h3>✓ {es ? "OPCIÓN 1: HACERLO TÚ MISMO" : "OPTION 1: DO IT YOURSELF"}</h3><p><strong>{es ? "Requisitos y documentos:" : "Requirements and documents:"}</strong> {selectedInstructions.requirements[es ? "es" : "en"]}</p><ol>{selectedInstructions.steps.map((step) => <li key={step.es}>{step[es ? "es" : "en"]}</li>)}</ol><div className="official-links">{selectedInstructions.sources.map(([sourceName, sourceUrl]) => <a className="official-link" href={sourceUrl} target="_blank" rel="noopener noreferrer" key={sourceUrl}><span>↗</span><strong>{es ? "Ir al sitio oficial" : "Open official website"}</strong><small>{sourceName} ↗</small></a>)}</div></section>}<section className="modal-guide delegate-service"><h3>★ {es ? "OPCIÓN 2: CONTACTA CON TICOListo" : "OPTION 2: CONTACT TicoListo"}</h3><p>{es ? "Si prefieres acompañamiento, nuestro equipo puede orientarte, encargarse del proceso y darle seguimiento." : "Our team can guide you, handle the process, and follow up for you."}</p><button className="delegate-button" onClick={() => { setContactNote(es ? `Necesito ayuda con el trámite: ${selected.es || selected.title}. Quiero conocer los requisitos y el costo de la asistencia.` : `I need help with this service: ${selected.title || selected.es}. I would like to know the requirements and assistance cost.`); setSelected(null); document.getElementById("assistance").scrollIntoView({ behavior: "smooth" }); }}><span>→</span><strong>{es ? "Contactarnos" : "Contact us"}</strong><small>{es ? "Recibe acompañamiento personalizado →" : "Get personalized assistance →"}</small></button></section></div></div>}
    </main>
  );
}
