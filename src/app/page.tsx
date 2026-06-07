import Link from "next/link";
import {
  ShoppingBag,
  ChefHat,
  LayoutDashboard,
  QrCode,
  BarChart3,
  Package,
  Clock,
  Users,
  Sliders,
  Store,
  MapPin,
  UserCircle,
  Monitor,
  History,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const links = [
    {
      href: "/pos",
      title: "Punto de Venta",
      description: "Tomar pedidos y cobrar",
      icon: ShoppingBag,
      color: "bg-orange-500",
    },
    {
      href: "/kitchen",
      title: "Cocina",
      description: "Ver pedidos en tiempo real",
      icon: ChefHat,
      color: "bg-green-500",
    },
    {
      href: "/admin/menu",
      title: "Gestión de Menú",
      description: "Productos y categorías",
      icon: LayoutDashboard,
      color: "bg-blue-500",
    },
    {
      href: "/menu",
      title: "Menú Digital",
      description: "Vista del cliente (QR)",
      icon: QrCode,
      color: "bg-purple-500",
    },
    {
      href: "/admin/reports",
      title: "Reportes",
      description: "Ventas e historial",
      icon: BarChart3,
      color: "bg-rose-500",
    },
    {
      href: "/admin/inventory",
      title: "Inventario",
      description: "Compras, stock y costos",
      icon: Package,
      color: "bg-emerald-500",
    },
    {
      href: "/admin/shifts",
      title: "Corte de Caja",
      description: "Turnos y cierres",
      icon: Clock,
      color: "bg-amber-500",
    },
    {
      href: "/admin/users",
      title: "Usuarios",
      description: "Roles y permisos",
      icon: Users,
      color: "bg-indigo-500",
    },
    {
      href: "/admin/modifiers",
      title: "Modificadores",
      description: "Extras y tamaños",
      icon: Sliders,
      color: "bg-teal-500",
    },
    {
      href: "/admin/settings",
      title: "Ajustes",
      description: "Logo, datos y ticket",
      icon: Store,
      color: "bg-slate-500",
    },
    {
      href: "/admin/customers",
      title: "Clientes",
      description: "Historial y frecuentes",
      icon: UserCircle,
      color: "bg-pink-500",
    },
    {
      href: "/admin/locations",
      title: "Sucursales",
      description: "Multi-ubicación",
      icon: MapPin,
      color: "bg-cyan-500",
    },
    {
      href: "/display",
      title: "Pantalla pública",
      description: "Monitor para clientes",
      icon: Monitor,
      color: "bg-violet-500",
    },
    {
      href: "/floor",
      title: "Salón",
      description: "Mapa de mesas en vivo",
      icon: MapPin,
      color: "bg-violet-600",
    },
    {
      href: "/admin/tables",
      title: "Mesas",
      description: "Configurar mapa del salón",
      icon: MapPin,
      color: "bg-indigo-500",
    },
    {
      href: "/admin/audit",
      title: "Auditoría",
      description: "Bitácora de cambios",
      icon: History,
      color: "bg-stone-500",
    },
  ];

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-orange-400/20 dark:bg-orange-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-rose-400/20 dark:bg-rose-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-3xl w-full space-y-12 relative z-10">
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-sm mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="El Buen Comer Logo" className="h-24 w-auto object-contain" />
          </div>
          <div className="space-y-2">
            <p className="text-xs tracking-[0.4em] uppercase text-gold-gradient font-semibold">— Restaurante —</p>
            <h1 className="font-display text-6xl md:text-7xl font-medium tracking-tight leading-[0.95]">
              <span className="bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 bg-clip-text text-transparent">
                El Buen Comer
              </span>
            </h1>
          </div>
          <p className="font-display italic text-muted-foreground text-xl max-w-xl mx-auto font-normal">
            ¡Sabor casero que conquista tu paladar!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className="group animate-premium-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <Card className="h-full glass-card hover:shadow-2xl hover:shadow-orange-500/10 dark:hover:shadow-orange-500/5 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden relative">
                {/* Gold shimmer line on hover (top) */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {/* Subtle hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/30 group-hover:to-transparent dark:group-hover:from-white/[0.03] transition-colors pointer-events-none" />

                <CardHeader className="flex flex-col items-start gap-4 p-6">
                  <div className={`${link.color} p-3.5 rounded-2xl text-white shadow-lg shadow-black/10 group-hover:scale-110 group-hover:rotate-[-3deg] transition-transform duration-300`}>
                    <link.icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="font-display text-xl font-semibold group-hover:text-primary transition-colors">{link.title}</CardTitle>
                    <CardDescription className="text-sm">{link.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
