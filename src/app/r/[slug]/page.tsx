import { redirect } from "next/navigation";

// Landing del tenant: /r/[slug] → redirige a su menú público.
// Cuando movamos las páginas en los próximos commits, esto
// pasará a ser un home real del restaurante o cambiará destino.
export default async function TenantHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/r/${slug}/menu`);
}
