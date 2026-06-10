import { createClient } from "@/lib/supabase/server";
import { RestaurantsTable } from "./restaurants-table";

export const dynamic = "force-dynamic";

export default async function RestaurantsListPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, plan, status, trial_ends_at, created_at, owner_id"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="font-display text-3xl font-medium text-primary">
          Restaurantes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona todos los tenants del SaaS.
        </p>
      </div>

      {error && error.code !== "42P01" && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/30">
          {error.message}
        </div>
      )}

      <RestaurantsTable initial={data ?? []} />
    </div>
  );
}
