import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import { createClient } from "@supabase/supabase-js";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Display font for premium titles and price numbers
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  let name = "El Buen Comer";
  let favicon: string | null = null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("settings")
      .select("restaurant_name, favicon_url")
      .eq("id", 1)
      .maybeSingle();
    if (data?.restaurant_name) name = data.restaurant_name;
    if (data?.favicon_url) favicon = data.favicon_url;
  } catch {
    // fall back to defaults
  }

  return {
    title: `${name} | Sistema POS`,
    description: `${name} — Sistema de punto de venta y menú digital.`,
    keywords: ["POS", "restaurante", "menú digital", name, "punto de venta"],
    openGraph: {
      title: name,
      description: `${name} — Menú digital`,
      type: "website",
      locale: "es_ES",
      siteName: name,
    },
    manifest: "/manifest.json",
    icons: favicon ? { icon: favicon, shortcut: favicon, apple: favicon } : undefined,
  };
}

function RegisterSW() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
        <RegisterSW />
      </body>
    </html>
  );
}
