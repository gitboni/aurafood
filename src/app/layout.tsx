import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuraFood - Sistema POS",
  description: "Sistema de punto de venta y menú digital para AuraFood",
  manifest: "/manifest.json",
};

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
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
        <RegisterSW />
      </body>
    </html>
  );
}
