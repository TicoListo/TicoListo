const API_URL = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap() {
  const response = await fetch(`${API_URL}/services`, { cache: "no-store" }).catch(() => null);
  const services = response?.ok ? await response.json() : [];
  return [
    { url: `${SITE_URL}/`, lastModified: new Date() },
    ...services.flatMap((service) => [
      {
        url: `${SITE_URL}/es/servicios/${service.slug_es || service.slug}`,
        lastModified: new Date(),
      },
      {
        url: `${SITE_URL}/en/services/${service.slug_en || service.slug}`,
        lastModified: new Date(),
      },
    ]),
  ];
}
