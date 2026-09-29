const provinces = {
  "san-jose": "San José", alajuela: "Alajuela", cartago: "Cartago", heredia: "Heredia",
  guanacaste: "Guanacaste", puntarenas: "Puntarenas", limon: "Limón",
};

export function generateStaticParams() {
  return Object.keys(provinces).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const name = provinces[params.slug] || "Costa Rica";
  return { title: `Trámites en ${name}`, description: `Guía de trámites y asistencia administrativa en ${name}, Costa Rica.` };
}

export default function ProvincePage({ params }) {
  const name = provinces[params.slug] || "Costa Rica";
  const faqs = [
    [`¿Qué trámites puedo gestionar en ${name}?`, "Puedes consultar trámites de identidad, vehículos, propiedades, salud, empleo y negocios."],
    ["¿Puedo delegar un trámite?", "Sí. Selecciona un servicio y utiliza la opción de contactar a un gestor."],
  ];
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) };
  return <main className="page-shell guide-page"><article><p className="eyebrow">ASISTENCIA LOCAL</p><h1>Trámites en {name}</h1><p>Encuentra guías oficiales, requisitos y acompañamiento para resolver tus gestiones en {name}.</p><section className="guide-section"><h2>Preguntas frecuentes</h2>{faqs.map(([question, answer]) => <div className="faq-item" key={question}><h3>{question}</h3><p>{answer}</p></div>)}</section><a className="primary" href="/#services">Explorar trámites</a></article><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></main>;
}
