// Shim: la página de POS real vive en /app/pos/page.tsx y ya es
// tenant-aware (lee el slug del path o la cookie tenant_id).
// Cuando F3.2 esté completo, el archivo real se moverá aquí y se
// eliminará el shim.
export { default } from "@/app/pos/page";
