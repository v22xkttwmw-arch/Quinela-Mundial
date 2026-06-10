import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mundial 2026 — Quiniela Oficial",
  description: "Pronostica los marcadores del Mundial 2026, suma puntos en la Liga Global y compite en los modos Clásico y Supervivencia. ¡Demuestra tus conocimientos!",
  openGraph: {
    title: "Mundial 2026 — Quiniela Oficial",
    description: "Pronostica los marcadores del Mundial 2026, suma puntos en la Liga Global y compite en los modos Clásico y Supervivencia. ¡Demuestra tus conocimientos!",
    url: "https://mundial2026quinela.com",
    siteName: "Mundial 2026",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mundial 2026 — Quiniela Oficial",
    description: "Pronostica los marcadores del Mundial 2026, suma puntos en la Liga Global y compite en los modos Clásico y Supervivencia.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
