const API_URL = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getGuide(slug) {
  const response = await fetch(`${API_URL}/guides/${slug}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

export async function generateMetadata({ params }) {
  const guide = await getGuide(params.slug);
  if (!guide) return { title: "Guía no encontrada" };
  return {
    title: guide.title,
    description: `${guide.title}. Requisitos, pasos y portal oficial de ${guide.institution}.`,
    alternates: { canonical: `/guias/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: `Guía oficial para ${guide.title} en Costa Rica.`,
      type: "article",
    },
  };
}

export default async function GuidePage({ params }) {
  const guide = await getGuide(params.slug);
  if (!guide) return <main className="page-shell"><h1>Guía no encontrada</h1></main>;

  const steps = guide.steps.split(/\s(?=\d+\.)/).filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.title,
    provider: { "@type": "GovernmentOrganization", name: guide.institution },
    step: steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
  };

  return (
    <main className="page-shell guide-page">
      <nav className="guide-breadcrumb"><a href="/">Inicio</a> / Guías / {guide.title}</nav>
      <article>
        <p className="eyebrow">{guide.module}</p>
        <h1>{guide.title}</h1>
        <p className="guide-institution">Institución responsable: {guide.institution}</p>
        <section className="guide-section">
          <h2>Portal / Enlace Oficial</h2>
          <a href={guide.official_url} target="_blank" rel="noreferrer">{guide.official_url}</a>
        </section>
        <section className="guide-section">
          <h2>Requisitos y Documentos Necesarios</h2>
          <p>{guide.requirements}</p>
        </section>
        <section className="guide-section">
          <h2>Paso a Paso para Realizarlo por Cuenta Propia</h2>
          <ol>{steps.map((step) => <li key={step}>{step.replace(/^\d+\.\s*/, "")}</li>)}</ol>
        </section>
        <section className="guide-cta">
          <h2>¿Prefieres acompañamiento?</h2>
          <p>Nuestro equipo puede ayudarte a ordenar documentos y dar seguimiento al trámite.</p>
          <a href="/#contacto" className="primary-button">Contactar a un gestor especializado</a>
        </section>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
