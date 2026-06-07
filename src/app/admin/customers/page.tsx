"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer } from "@/lib/types";
import { Home, LogOut, Loader2, Users, Search, Crown, TrendingUp, DollarSign, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  async function load() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("total_spent", { ascending: false })
      .limit(500);
    if (error?.code === "42P01") { setNeedsSetup(true); setLoading(false); return; }
    setCustomers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = search.trim()
    ? customers.filter((c) => {
        const q = search.toLowerCase();
        return (c.phone ?? "").includes(q) || (c.name ?? "").toLowerCase().includes(q);
      })
    : customers;

  const totalSpend = customers.reduce((s, c) => s + Number(c.total_spent), 0);
  const avgTicketPerCustomer = customers.length > 0
    ? totalSpend / customers.reduce((s, c) => s + c.total_orders, 0 || 1)
    : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (needsSetup) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
      <Users className="h-12 w-12 text-indigo-500" />
      <h2 className="text-xl font-bold">Configura la tabla de clientes</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Ejecuta <code className="bg-muted px-1 rounded">supabase-crm-locations.sql</code> en Supabase, luego reintenta.
      </p>
      <Button onClick={() => { setNeedsSetup(false); setLoading(true); load(); }}>Reintentar</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button></Link>
        <Users className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold">Clientes</h1>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={async () => {
          await supabase.auth.signOut(); window.location.href = "/login";
        }}><LogOut className="h-5 w-5" /></Button>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Clientes registrados</CardTitle>
              <Users className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{customers.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Gastado total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">${totalSpend.toFixed(0)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Ticket promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${isFinite(avgTicketPerCustomer) ? avgTicketPerCustomer.toFixed(0) : 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
          <CardContent>
            <div className="relative mb-4 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nombre o teléfono..." className="pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                  <TableHead className="text-right">Gastado</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead>Última visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="w-8">
                      {i < 3 && search === "" ? (
                        <Crown className={`h-4 w-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.name ?? <span className="text-muted-foreground italic">Sin nombre</span>}
                    </TableCell>
                    <TableCell>
                      {c.phone ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {c.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{c.total_orders}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">${Number(c.total_spent).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {Number(c.loyalty_points) > 0 ? (
                        <Badge className="bg-amber-100 text-amber-800 border-0">{Number(c.loyalty_points)} pts</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.last_visit ? new Date(c.last_visit).toLocaleDateString("es-MX") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {search ? "Sin resultados" : "Aún no hay clientes registrados"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
