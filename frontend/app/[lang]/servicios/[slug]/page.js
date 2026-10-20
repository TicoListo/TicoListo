import { notFound } from "next/navigation";
import ServicePage from "../../../components/ServicePage";

export default async function SpanishServicePage({ params }) {
  const { lang, slug } = await params;
  if (lang !== "es") notFound();
  const service = await getService("es", slug);
  if (!service) notFound();
  return <ServicePage service={service} language="es" />;
}

async function getService(language, slug) {
  const apiUrl = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const response = await fetch(`${apiUrl}/services/${language}/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } }).catch(() => null);
  return response?.ok ? response.json() : null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const service = await getService("es", slug);
  if (!service) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    title: service.meta_title_es || service.name_es,
    description: service.meta_description_es || service.description_es,
    keywords: service.keywords_es,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/es/servicios/${service.slug_es || service.slug}`,
      languages: {
        es: `${siteUrl}/es/servicios/${service.slug_es || service.slug}`,
        en: `${siteUrl}/en/services/${service.slug_en || service.slug}`,
      },
    },
    openGraph: {
      title: service.meta_title_es || service.name_es,
      description: service.meta_description_es || service.description_es,
      url: `${siteUrl}/es/servicios/${service.slug_es || service.slug}`,
      type: "article",
      images: service.image_url ? [service.image_url] : undefined,
    },
  };
}
