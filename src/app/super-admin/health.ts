// Health Score + clasificación de tenants para el super-admin.
// No se guarda en la BD; se calcula en runtime a partir de datos
// que ya tenemos (creado en, última orden, # órdenes 30d, plan,
// status, trial restante).

export type HealthInput = {
  status: string;
  plan: string;
  created_at: string;
  trial_ends_at: string | null;
  last_order_at: string | null;
  orders_7d: number;
  orders_30d: number;
};

export type HealthLevel = "healthy" | "trialing" | "at_risk" | "churning";
export type HealthMeta = {
  score: number;              // 0-100
  level: HealthLevel;
  reasons: string[];          // hints para super_admin
};

export function computeHealth(t: HealthInput): HealthMeta {
  const now = Date.now();
  const ageDays = Math.max(1, (now - new Date(t.created_at).getTime()) / 86400000);
  const lastOrderAgeDays = t.last_order_at
    ? (now - new Date(t.last_order_at).getTime()) / 86400000
    : null;
  const trialDaysLeft = t.trial_ends_at
    ? Math.ceil((new Date(t.trial_ends_at).getTime() - now) / 86400000)
    : null;

  // Suspendido / cancelado → churning directo
  if (t.status === "suspended" || t.status === "cancelled") {
    return { score: 0, level: "churning", reasons: ["Tenant " + t.status] };
  }

  let score = 50; // base
  const reasons: string[] = [];

  // 1) Actividad reciente
  if (t.orders_7d >= 10) { score += 25; reasons.push(`${t.orders_7d} órdenes esta semana`); }
  else if (t.orders_7d >= 1) { score += 10; reasons.push(`${t.orders_7d} órdenes esta semana`); }
  else if (lastOrderAgeDays === null) { score -= 20; reasons.push("Nunca ha tomado una orden"); }
  else if (lastOrderAgeDays > 14) { score -= 25; reasons.push(`Sin órdenes hace ${Math.floor(lastOrderAgeDays)} días`); }
  else if (lastOrderAgeDays > 7) { score -= 10; reasons.push(`Sin órdenes hace ${Math.floor(lastOrderAgeDays)} días`); }

  // 2) Tendencia mes vs semana — si la última semana proyectada al mes es menor, alerta suave
  const projected30 = t.orders_7d * 4.3;
  if (t.orders_30d > 10 && projected30 < t.orders_30d * 0.5) {
    score -= 10; reasons.push("Tendencia bajando vs mes anterior");
  }

  // 3) Onboarding inicial
  if (ageDays < 3 && t.orders_30d === 0) {
    reasons.push("Recién dado de alta, aún sin órdenes");
  }

  // 4) Trial por vencer
  if (t.plan === "trial" && trialDaysLeft !== null) {
    if (trialDaysLeft <= 0) { score -= 15; reasons.push("Trial vencido"); }
    else if (trialDaysLeft <= 3) { score -= 5; reasons.push(`Trial vence en ${trialDaysLeft}d`); }
  }

  // 5) Plan pagado activo bonus
  if (t.plan === "pro" || t.plan === "enterprise") score += 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Nivel
  let level: HealthLevel;
  if (t.plan === "trial" && t.status === "active") {
    level = score >= 70 ? "trialing" : "at_risk";
  } else if (score >= 70) level = "healthy";
  else if (score >= 40) level = "at_risk";
  else level = "churning";

  return { score, level, reasons };
}

export const HEALTH_STYLES: Record<HealthLevel, { color: string; label: string }> = {
  healthy:  { color: "bg-emerald-500 text-white",                                     label: "Saludable" },
  trialing: { color: "bg-amber-500 text-white",                                       label: "En trial" },
  at_risk:  { color: "bg-orange-500 text-white",                                      label: "En riesgo" },
  churning: { color: "bg-red-500 text-white",                                         label: "Crítico" },
};

// ── Series mensuales (últimos 6 meses) ──────────────────────────

export type MonthBucket = { key: string; label: string; start: Date; end: Date };

export function lastNMonths(n: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-MX", { month: "short" }).replace(".", ""),
      start, end,
    });
  }
  return out;
}

export function bucketByMonth<T extends { created_at: string }>(
  rows: T[],
  buckets: MonthBucket[],
  pick: (r: T) => number = () => 1
): number[] {
  const totals = buckets.map(() => 0);
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) {
        totals[i] += pick(r);
        break;
      }
    }
  }
  return totals;
}
