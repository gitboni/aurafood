import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/legal/terminos" className="text-muted-foreground hover:text-foreground">
              Términos
            </Link>
            <Link href="/legal/privacidad" className="text-muted-foreground hover:text-foreground">
              Privacidad
            </Link>
          </nav>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-6 py-10 prose-legal">
        {children}
      </article>
    </main>
  );
}
