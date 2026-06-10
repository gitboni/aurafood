import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  restaurant_id: string | null;
};

const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  refund: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancel: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  login: "bg-muted text-muted-foreground",
};

export default async function GlobalAuditPage() {
  const supabase = await createClient();

  // super_admin bypasa RLS → ve audit_log de TODOS los tenants
  const { data: rows, error } = await supabase
    .from("audit_log")
    .select("id, user_name, action, entity, entity_id, created_at, restaurant_id")
    .order("created_at", { ascending: false })
    .limit(300);

  // Mapa restaurant_id → nombre, para etiquetar cada entrada
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, slug");
  const nameById = new Map(
    (restaurants ?? []).map((r) => [r.id, { name: r.name, slug: r.slug }])
  );

  const entries = (rows ?? []) as AuditRow[];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="font-display text-3xl font-medium text-primary flex items-center gap-2">
          <History className="h-6 w-6" /> Auditoría global
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Últimas {entries.length} acciones en todos los restaurantes.
        </p>
      </div>

      {error && error.code !== "42P01" && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/30">
          {error.message}
        </div>
      )}

      <Card>
        <CardContent className="p-0 divide-y">
          {entries.map((e) => {
            const tenant = e.restaurant_id ? nameById.get(e.restaurant_id) : null;
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge
                  className={`shrink-0 ${ACTION_STYLES[e.action] ?? "bg-muted text-muted-foreground"} border-0 text-[10px]`}
                >
                  {e.action}
                </Badge>
                <span className="text-muted-foreground shrink-0">{e.entity}</span>
                <span className="flex-1 min-w-0 truncate">
                  {e.user_name || "Sistema"}
                </span>
                {tenant ? (
                  <Link
                    href={`/super-admin/restaurants/${e.restaurant_id}`}
                    className="shrink-0 text-xs text-primary hover:underline truncate max-w-[140px]"
                  >
                    {tenant.name}
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">global</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums w-28 text-right">
                  {new Date(e.created_at).toLocaleString("es-MX", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="px-4 py-12 text-center text-muted-foreground">
              Sin acciones registradas todavía.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
