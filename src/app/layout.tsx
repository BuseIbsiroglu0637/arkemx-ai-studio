import type { Metadata } from "next";
import "./globals.css";
import "./purple-theme.css";

export const metadata: Metadata = {
  title: "Ekibim · ARKEMX Studio",
  description: "AI yazılım ekibinin profilleri, yetkinlik alanları ve doğrulanabilir iş geçmişi.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
