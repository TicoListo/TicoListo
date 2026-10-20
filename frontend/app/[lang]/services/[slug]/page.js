import { notFound } from "next/navigation";
import ServicePage from "../../../components/ServicePage";

export default async function EnglishServicePage({ params }) {
  const { lang, slug } = await params;
  if (lang !== "en") notFound();
  const service = await getService("en", slug);
  if (!service) notFound();
  return <ServicePage service={service} language="en" />;
}

async function getService(language, slug) {
  const apiUrl = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const response = await fetch(`${apiUrl}/services/${language}/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } }).catch(() => null);
  return response?.ok ? response.json() : null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const service = await getService("en", slug);
  if (!service) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    title: service.meta_title_en || service.name_en,
    description: service.meta_description_en || service.description_en,
    keywords: service.keywords_en,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/en/services/${service.slug_en || service.slug}`,
      languages: {
        es: `${siteUrl}/es/servicios/${service.slug_es || service.slug}`,
        en: `${siteUrl}/en/services/${service.slug_en || service.slug}`,
      },
    },
    openGraph: {
      title: service.meta_title_en || service.name_en,
      description: service.meta_description_en || service.description_en,
      url: `${siteUrl}/en/services/${service.slug_en || service.slug}`,
      type: "article",
      images: service.image_url ? [service.image_url] : undefined,
    },
  };
}
