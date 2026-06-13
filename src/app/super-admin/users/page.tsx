import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users } from "lucide-react";
import { listAllUsers } from "./actions";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export default async function GlobalUsersPage() {
  const res = await listAllUsers();
  const users = res.ok ? res.users : [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div>
        <Link href="/super-admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="font-display text-3xl font-medium text-primary flex items-center gap-2">
          <Users className="h-6 w-6" /> Usuarios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vista global de todos los usuarios del SaaS.
        </p>
      </div>

      {!res.ok && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/30">
          {res.error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <UsersTable initial={users} />
        </CardContent>
      </Card>
    </div>
  );
}
