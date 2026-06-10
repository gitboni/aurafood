"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPlus, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { extendTrial, saveTenantNotes } from "../actions";

export function ExtendTrial({ id }: { id: string }) {
  const [busy, setBusy] = useState<number | null>(null);
  const router = useRouter();

  async function add(days: number) {
    setBusy(days);
    const res = await extendTrial(id, days);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Trial extendido hasta ${new Date(res.until).toLocaleDateString("es-MX")}`
    );
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        <CalendarPlus className="h-4 w-4" /> Extender trial:
      </span>
      {[7, 14, 30].map((d) => (
        <Button
          key={d}
          variant="outline"
          size="sm"
          onClick={() => add(d)}
          disabled={busy !== null}
        >
          {busy === d ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `+${d}d`}
        </Button>
      ))}
    </div>
  );
}

export function TenantNotes({
  id,
  initial,
}: {
  id: string;
  initial: string;
}) {
  const [notes, setNotes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const res = await saveTenantNotes(id, notes);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success("Notas guardadas");
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas internas (solo super_admin las ve): habló por WhatsApp, pidió factura, etc."
        rows={3}
      />
      <Button onClick={save} size="sm" disabled={saving} className="gap-1.5">
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {saved ? "Guardado" : "Guardar notas"}
      </Button>
    </div>
  );
}
