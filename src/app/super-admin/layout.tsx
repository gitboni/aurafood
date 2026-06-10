import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Store, Home, LogOut, ShieldCheck, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSuperAdmin } from "@/lib/tenant-server";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireSuperAdmin();
  if (!auth) redirect("/");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold">Super Admin</span>
        </div>
        <nav className="ml-6 hidden md:flex items-center gap-1">
          <Link href="/super-admin">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <Link href="/super-admin/restaurants">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Store className="h-4 w-4" /> Restaurantes
            </Button>
          </Link>
          <Link href="/super-admin/audit">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" /> Auditoría
            </Button>
          </Link>
        </nav>
        <div className="flex-1" />
        <span className="hidden sm:block text-xs text-muted-foreground">
          {auth.profile.display_name || "Super Admin"}
        </span>
        <ThemeToggle />
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
