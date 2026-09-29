import Link from "next/link";

export const metadata = { title: "Servicios y trámites en Costa Rica", description: "Explora servicios y guías para trámites en Costa Rica." };

export default async function ServicesIndex({ params }) {
  const { lang } = await params;
  if (lang !== "es") return null;
  const apiUrl = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const response = await fetch(`${apiUrl}/services`, { next: { revalidate: 300 } }).catch(() => null);
  const services = response?.ok ? await response.json() : [];
  return <main className="page-shell guide-page"><p className="eyebrow">SEO · Costa Rica</p><h1>Servicios y trámites en Costa Rica</h1><p>Guías claras, requisitos, pasos y enlaces oficiales para resolver tus gestiones.</p><div className="service-grid">{services.filter((service) => service.published !== false).map((service) => <Link className="service-card" key={service.id} href={`/es/servicios/${service.slug_es || service.slug}`}><h2>{service.name_es}</h2><p>{service.description_es}</p></Link>)}</div></main>;
}
