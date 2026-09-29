import "./globals.css";

export const metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Asistente Virtual de Trámites CR | TicoListo",
    template: "%s | TicoListo",
  },
  description: "Guías claras para trámites, relocalización y servicios administrativos en Costa Rica.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Asistente Virtual de Trámites CR",
    description: "Resuelve tus trámites en Costa Rica con pasos claros y fuentes oficiales.",
    type: "website",
    locale: "es_CR",
  },
};

export default function RootLayout({ children }) {
  return <html lang="es"><body>{children}</body></html>;
}
