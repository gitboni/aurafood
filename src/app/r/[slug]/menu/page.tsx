// Mientras hacemos la migración progresiva F3, este shim re-exporta
// la página del menú existente. Cuando estemos listos:
//   1. SQL F1 aplicado
//   2. Cliente Supabase tenant-aware (siguiente commit)
// moveremos el archivo real aquí y eliminaremos el shim.
//
// Esto deja al usuario navegar /r/el-buen-comer/menu HOY sin
// duplicar 800 líneas de JSX.
export { default } from "@/app/menu/page";
