import Link from "next/link";
import {
  ShoppingBag,
  ChefHat,
  LayoutDashboard,
  QrCode,
  BarChart3,
  Package,
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
      description: "Ingredientes, recetas y stock",
      icon: Package,
      color: "bg-emerald-500",
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
            <span className="text-5xl">🍽️</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
              AuraFood
            </span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-xl mx-auto font-medium">
            Sistema avanzado de Punto de Venta y Menú Digital
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {links.map((link, i) => (
            <Link 
              key={link.href} 
              href={link.href}
              className="group"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Card className="h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-white/20 dark:border-white/10 hover:shadow-2xl hover:shadow-orange-500/10 dark:hover:shadow-orange-500/5 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden relative">
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/40 group-hover:to-transparent dark:group-hover:from-white/5 transition-colors pointer-events-none" />
                
                <CardHeader className="flex flex-col items-start gap-4 p-6">
                  <div className={`${link.color} p-3.5 rounded-2xl text-white shadow-md shadow-black/5 group-hover:scale-110 transition-transform duration-300`}>
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">{link.title}</CardTitle>
                    <CardDescription className="text-base">{link.description}</CardDescription>
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
