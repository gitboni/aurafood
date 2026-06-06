import Link from "next/link";
import {
  ShoppingBag,
  ChefHat,
  LayoutDashboard,
  QrCode,
  BarChart3,
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
  ];

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">
            🍽️ AuraFood
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema de Punto de Venta y Menú Digital
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className={`${link.color} p-3 rounded-xl text-white shrink-0`}>
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
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
