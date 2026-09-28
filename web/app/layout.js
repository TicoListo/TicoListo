import "./globals.css";

export const metadata = {
  title: "TicoListo",
  description: "Simple help for visitors and newcomers in Costa Rica.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
