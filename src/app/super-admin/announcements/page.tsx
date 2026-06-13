import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Megaphone } from "lucide-react";
import { AnnouncementForm, AnnouncementRow } from "./announcement-form";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  message: string;
  type: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, message, type, active, expires_at, created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];
  const tableMissing = error?.code === "42P01";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/super-admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="font-display text-3xl font-medium text-primary flex items-center gap-2">
          <Megaphone className="h-6 w-6" /> Anuncios globales
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aparecen como banner en todas las pantallas <code>/r/[slug]/*</code> de todos los tenants.
        </p>
      </div>

      {tableMissing && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-sm">
          ⚠️ La tabla <code>announcements</code> no existe. Ejecuta <code>supabase-saas-patch7.sql</code>.
        </div>
      )}
      {error && !tableMissing && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/30">
          {error.message}
        </div>
      )}

      {!tableMissing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo anuncio</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementForm />
          </CardContent>
        </Card>
      )}

      {!tableMissing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anuncios ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rows.map((a) => <AnnouncementRow key={a.id} row={a} />)}
              {rows.length === 0 && (
                <p className="text-center text-muted-foreground py-6 text-sm">
                  Aún no hay anuncios.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
