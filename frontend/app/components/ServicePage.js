import Link from "next/link";

function parseList(value) {
  return (value || "").split(/\s(?=\d+\.)/).map((item) => item.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
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
  const isSpanish = language === "es";
  const name = isSpanish ? service.name_es : service.name_en;
  const description = isSpanish ? service.description_es : service.description_en;
  const content = isSpanish ? service.content_es : service.content_en;
  const requirements = isSpanish ? service.requirements_es : service.requirements_en;
  const steps = parseList(isSpanish ? service.steps_es : service.steps_en);
  const faq = parseFaq(isSpanish ? service.faq_es : service.faq_en);
  const slug = isSpanish ? service.slug_es || service.slug : service.slug_en || service.slug;
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

  return (
    <main className="page-shell guide-page service-seo-page">
      <nav className="guide-breadcrumb">
        <Link href={isSpanish ? "/es/servicios" : "/en/services"}>{isSpanish ? "Servicios" : "Services"}</Link> / {name}
      </nav>
      <article>
        <p className="eyebrow">{service.category} · {service.provider}</p>
        <h1>{name}</h1>
        <p className="guide-institution">{description}</p>
        <p className="service-language-link"><Link href={alternatePath}>{isSpanish ? "Read this service in English" : "Leer este servicio en español"}</Link></p>
        {content && <section className="guide-section"><h2>{isSpanish ? "Información del servicio" : "Service information"}</h2><p>{content}</p></section>}
        {requirements && <section className="guide-section"><h2>{isSpanish ? "Requisitos y documentos necesarios" : "Requirements and documents"}</h2><p>{requirements}</p></section>}
        <section className="guide-section">
          <h2>{isSpanish ? "Cómo hacerlo por tu cuenta" : "How to do it yourself"}</h2>
          <ol>{stepsForSchema.map((step) => <li key={step}>{step}</li>)}</ol>
          {service.official_url && <a className="primary-button" href={service.official_url} target="_blank" rel="noreferrer">{isSpanish ? "Ir al portal oficial" : "Open official website"}</a>}
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
