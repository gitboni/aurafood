import Link from "next/link";
import {
  ShoppingBag,
  ChefHat,
  LayoutGrid,
  QrCode,
  BarChart3,
  Package,
  Clock,
  Users,
  Sliders,
  Settings,
  UserCircle,
  MapPin,
  Monitor,
  History,
  LayoutDashboard,
  Table2,
  Calculator,
  type LucideIcon,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NavLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

// Operación — lo que se usa a diario (destacado)
const operacion: NavLink[] = [
  { href: "/pos", title: "Punto de Venta", description: "Tomar pedidos y cobrar", icon: ShoppingBag },
  { href: "/kitchen", title: "Cocina", description: "Pedidos en tiempo real", icon: ChefHat },
  { href: "/floor", title: "Salón", description: "Mapa de mesas en vivo", icon: LayoutGrid },
  { href: "/menu", title: "Menú Digital", description: "Vista del cliente (QR)", icon: QrCode },
];

// Administración — gestión y configuración (secundario, sobrio)
const administracion: NavLink[] = [
  { href: "/admin/menu", title: "Gestión de Menú", description: "Productos y categorías", icon: LayoutDashboard },
  { href: "/admin/profitability", title: "Rentabilidad", description: "Costos, margen y simulador", icon: Calculator },
  { href: "/admin/reports", title: "Reportes", description: "Ventas e historial", icon: BarChart3 },
  { href: "/admin/inventory", title: "Inventario", description: "Compras, stock y costos", icon: Package },
  { href: "/admin/shifts", title: "Corte de Caja", description: "Turnos y cierres", icon: Clock },
  { href: "/admin/users", title: "Usuarios", description: "Roles y permisos", icon: Users },
  { href: "/admin/modifiers", title: "Modificadores", description: "Extras y tamaños", icon: Sliders },
  { href: "/admin/customers", title: "Clientes", description: "Historial y frecuentes", icon: UserCircle },
  { href: "/admin/locations", title: "Sucursales", description: "Multi-ubicación", icon: MapPin },
  { href: "/admin/tables", title: "Mesas", description: "Configurar mapa del salón", icon: Table2 },
  { href: "/display", title: "Pantalla pública", description: "Monitor para clientes", icon: Monitor },
  { href: "/admin/audit", title: "Auditoría", description: "Bitácora de cambios", icon: History },
  { href: "/admin/settings", title: "Ajustes", description: "Logo, datos y ticket", icon: Settings },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 px-1">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden bg-background">
      {/* Decorative background — brand tints only */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-gold/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16">
        {/* Header */}
        <header className="mb-14 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="h-14 w-auto object-contain" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4em] text-gold-gradient">
            — Restaurante —
          </p>
          <h1 className="font-display text-5xl font-medium leading-[0.95] tracking-tight text-primary md:text-6xl">
            El Buen Comer
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-display text-lg italic text-muted-foreground md:text-xl">
            ¡Sabor casero que conquista tu paladar!
          </p>
        </header>

        {/* Operación — destacada */}
        <section className="mb-12">
          <SectionLabel>Operación</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {operacion.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className="group animate-premium-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Card className="glass-card relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
                  {/* Gold shimmer on hover */}
                  <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <CardHeader className="flex flex-col items-start gap-4 p-6">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${
                        i === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      }`}
                    >
                      <link.icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="font-display text-lg font-semibold transition-colors group-hover:text-primary">
                        {link.title}
                      </CardTitle>
                      <CardDescription className="text-sm">{link.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Administración — sobria, monocroma */}
        <section>
          <SectionLabel>Administración</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {administracion.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 transition-colors duration-200 hover:border-primary/40 hover:bg-muted/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <link.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{link.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {link.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
