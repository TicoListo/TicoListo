"use client";

import { useState } from "react";
import Link from "next/link";

const propertyListingUrl = "https://encuentra24.com/costa-rica-es/bienes-raices";
const propertyServiceSlugs = new Set(["buy-property", "sell-property", "short-stay-rental"]);

function parseList(value) {
  return (value || "")
    .split(/\s*(?:\d+\.\s+|[\r\n]+|[•*-]\s+)/)
    .map((item) => item.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function parseFaq(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ServicePage({ service, language }) {
  const [checkedSteps, setCheckedSteps] = useState([]);
  const [shareMessage, setShareMessage] = useState("");
  const isSpanish = language === "es";
  const name = isSpanish ? service.name_es : service.name_en;
  const description = isSpanish ? service.description_es : service.description_en;
  const content = isSpanish ? service.content_es : service.content_en;
  const requirements = isSpanish ? service.requirements_es : service.requirements_en;
  const steps = parseList(isSpanish ? service.steps_es : service.steps_en);
  const faq = parseFaq(isSpanish ? service.faq_es : service.faq_en);
  const requirementItems = parseList(requirements);
  const localizedValue = (key, fallbackKeys = []) => {
    const localized = service[`${key}_${isSpanish ? "es" : "en"}`];
    return localized || service[key] || fallbackKeys.map((fallbackKey) => service[fallbackKey]).find(Boolean);
  };
  const summary = [
    {
      label: isSpanish ? "Tiempo estimado" : "Estimated time",
      value: localizedValue("estimated_time", ["processing_time", "duration"]),
      fallback: isSpanish ? "Consulta el portal" : "Check official portal",
    },
    {
      label: isSpanish ? "Costo" : "Cost",
      value: localizedValue("cost", ["price", "fee"]),
      fallback: isSpanish ? "Puede variar" : "May vary",
    },
    {
      label: isSpanish ? "Modalidad" : "Mode",
      value: localizedValue("mode", ["service_mode", "modality"]),
      fallback: isSpanish ? "En línea o presencial" : "Online or in person",
    },
  ];
  const slug = isSpanish ? service.slug_es || service.slug : service.slug_en || service.slug;
  const officialUrl = propertyServiceSlugs.has(service.slug) ? propertyListingUrl : service.official_url;
  const basePath = isSpanish ? `/es/servicios/${slug}` : `/en/services/${slug}`;
  const alternatePath = isSpanish
    ? `/en/services/${service.slug_en || service.slug}`
    : `/es/servicios/${service.slug_es || service.slug}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const stepsForSchema = steps.length ? steps : [description];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name,
      description,
      url: `${siteUrl}${basePath}`,
      provider: { "@type": "Organization", name: "TicoListo" },
      areaServed: { "@type": "Country", name: "Costa Rica" },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name,
      step: stepsForSchema.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
    },
    ...(faq.length ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    }] : []),
  ];
  const toggleStep = (index) => {
    setCheckedSteps((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index]);
  };
  const sharePage = async () => {
    const shareData = { title: name, text: description, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMessage(isSpanish ? "Enlace compartido" : "Link shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        setShareMessage(isSpanish ? "Enlace copiado" : "Link copied");
      } else {
        setShareMessage(isSpanish ? "Copia el enlace de esta página" : "Copy this page URL");
      }
    } catch {
      // Sharing can be cancelled by the visitor; no error UI is needed.
    }
  };

  return (
    <main className="page-shell guide-page service-seo-page">
      <nav className="guide-breadcrumb">
        <Link href={isSpanish ? "/es/servicios" : "/en/services"}>{isSpanish ? "Servicios" : "Services"}</Link> / {name}
      </nav>
      <article>
        <p className="eyebrow">{service.category} · {service.provider}</p>
        <h1>{name}</h1>
        <p className="guide-institution">{description}</p>
        <div className="service-page-actions">
          <p className="service-language-link"><Link href={alternatePath}>{isSpanish ? "Read this service in English" : "Leer este servicio en español"}</Link></p>
          <button type="button" className="share-button" onClick={sharePage}>↗ {isSpanish ? "Compartir" : "Share"}</button>
          {shareMessage && <span className="share-status" role="status">{shareMessage}</span>}
        </div>
        <section className="service-summary" aria-label={isSpanish ? "Resumen rápido" : "Quick summary"}>
          <h2>{isSpanish ? "Resumen rápido" : "Quick summary"}</h2>
          <div className="service-summary-grid">
            {summary.map((item) => <div className="service-summary-item" key={item.label}><span>{item.label}</span><strong>{item.value || item.fallback}</strong></div>)}
          </div>
        </section>
        {content && <section className="guide-section"><h2>{isSpanish ? "Información del servicio" : "Service information"}</h2><p>{content}</p></section>}
        {requirements && <section className="guide-section"><h2>{isSpanish ? "Requisitos y documentos necesarios" : "Requirements and documents"}</h2><ul className="service-requirements">{requirementItems.map((item) => <li key={item}>{item}</li>)}</ul></section>}
        <section className="guide-section">
          <h2>{isSpanish ? "Cómo hacerlo por tu cuenta" : "How to do it yourself"}</h2>
          <ol className="service-steps">{stepsForSchema.map((step, index) => <li key={step}><label><input type="checkbox" checked={checkedSteps.includes(index)} onChange={() => toggleStep(index)} /> <span className={checkedSteps.includes(index) ? "is-complete" : ""}>{step}</span></label></li>)}</ol>
          {officialUrl ? <a className="primary-button" href={officialUrl} target="_blank" rel="noreferrer">{isSpanish ? "Ir al sitio oficial ↗" : "Open official website ↗"}</a> : <p className="service-note">{isSpanish ? "Revisa la información oficial de la institución responsable." : "Check the responsible institution’s official information."}</p>}
        </section>
        {faq.length > 0 && <section className="guide-section"><h2>{isSpanish ? "Preguntas frecuentes" : "Frequently asked questions"}</h2>{faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
        <section className="guide-cta">
          <h2>{isSpanish ? "¿Prefieres que lo hagamos por ti?" : "Would you rather have our help?"}</h2>
          <p>{isSpanish ? "Nuestro equipo puede acompañarte y dar seguimiento al proceso." : "Our team can guide you and follow up on the process."}</p>
          <Link href="/#contacto" className="primary-button">{isSpanish ? "Contactar a un gestor" : "Contact a specialist"}</Link>
        </section>
      </article>
      {jsonLd.map((item) => <script key={item["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />)}
    </main>
  );
}
