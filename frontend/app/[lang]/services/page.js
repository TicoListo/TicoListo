import Link from "next/link";

export const metadata = { title: "Services and procedures in Costa Rica", description: "Explore service guides and official links for procedures in Costa Rica." };

export default async function ServicesIndex({ params }) {
  const { lang } = await params;
  if (lang !== "en") return null;
  const apiUrl = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const response = await fetch(`${apiUrl}/services`, { next: { revalidate: 300 } }).catch(() => null);
  const services = response?.ok ? await response.json() : [];
  return <main className="page-shell guide-page"><p className="eyebrow">SEO · Costa Rica</p><h1>Services and procedures in Costa Rica</h1><p>Clear guides, requirements, steps and official links for your procedures.</p><div className="service-grid">{services.filter((service) => service.published !== false).map((service) => <Link className="service-card" key={service.id} href={`/en/services/${service.slug_en || service.slug}`}><h2>{service.name_en}</h2><p>{service.description_en}</p></Link>)}</div></main>;
}
