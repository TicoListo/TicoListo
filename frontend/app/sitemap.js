const API_URL = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function sitemap() {
  const response = await fetch(`${API_URL}/guides`, { cache: "no-store" }).catch(() => null);
  const guides = response?.ok ? await response.json() : [];
  return [
    { url: "http://localhost:3000/", lastModified: new Date() },
    ...guides.map((guide) => ({
      url: `http://localhost:3000/guias/${guide.slug}`,
      lastModified: new Date(),
    })),
  ];
}
