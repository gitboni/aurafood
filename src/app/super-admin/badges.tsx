// Badges presentacionales reutilizables — sin lógica server, sin "use client"
// (RSC los puede renderizar y un client component también los puede importar).

export function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    trial:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    free: "bg-muted text-muted-foreground",
    pro: "bg-primary/10 text-primary",
    enterprise:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
        styles[plan] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {plan}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    past_due:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    suspended:
      "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
        styles[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
