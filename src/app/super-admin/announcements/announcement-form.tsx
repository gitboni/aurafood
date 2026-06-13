"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Megaphone, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createAnnouncement, toggleAnnouncement, deleteAnnouncement } from "./actions";

const TYPE_STYLES: Record<string, string> = {
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  maintenance: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const TYPE_LABEL: Record<string, string> = {
  info: "Info", warning: "Aviso", maintenance: "Mantenimiento", success: "Buena noticia",
};

export function AnnouncementForm() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [expires, setExpires] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function submit() {
    setSending(true);
    const res = await createAnnouncement(message, type, expires || null);
    setSending(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Anuncio publicado");
    setMessage(""); setType("info"); setExpires("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Mensaje</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Mantenimiento programado el domingo 22:00–23:00 hrs..."
          rows={2} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => v && setType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">💬 Info</SelectItem>
              <SelectItem value="warning">⚠️ Aviso</SelectItem>
              <SelectItem value="maintenance">🛠️ Mantenimiento</SelectItem>
              <SelectItem value="success">✨ Buena noticia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Expira (opcional)</Label>
          <Input type="datetime-local" value={expires}
            onChange={(e) => setExpires(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit} disabled={sending || !message.trim()} className="gap-1.5">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        Publicar
      </Button>
    </div>
  );
}

export function AnnouncementRow({
  row,
}: {
  row: {
    id: string; message: string; type: string; active: boolean;
    expires_at: string | null; created_at: string;
  };
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onToggle() {
    setBusy(true);
    const res = await toggleAnnouncement(row.id, !row.active);
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("¿Eliminar este anuncio?")) return;
    setBusy(true);
    const res = await deleteAnnouncement(row.id);
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    router.refresh();
  }

  const expired = row.expires_at && new Date(row.expires_at).getTime() < Date.now();

  return (
    <div className={`p-3 rounded-lg border ${TYPE_STYLES[row.type] ?? "border-border"} ${!row.active || expired ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 mt-0.5">
          {TYPE_LABEL[row.type] ?? row.type}
        </span>
        <p className="flex-1 text-sm">{row.message}</p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle} disabled={busy}
          title={row.active ? "Ocultar" : "Mostrar"}>
          {row.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} disabled={busy}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
        {new Date(row.created_at).toLocaleString("es-MX")}
        {row.expires_at && ` · expira ${new Date(row.expires_at).toLocaleString("es-MX")}`}
        {expired && " · vencido"}
      </p>
    </div>
  );
}
