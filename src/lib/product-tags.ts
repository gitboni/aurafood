// Catálogo de tags dietéticos / de producto. Compartido por el
// admin (editor) y el menú (badges). El valor se guarda en
// products.tags (text[]); el label/emoji se renderiza desde aquí.

export type ProductTag = {
  value: string;
  emoji: string;
  label: string;   // ES
  label_en: string;
  className: string;
};

export const PRODUCT_TAGS: ProductTag[] = [
  { value: "veg",          emoji: "🌱", label: "Vegetariano",  label_en: "Vegetarian",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { value: "vegan",        emoji: "🌿", label: "Vegano",       label_en: "Vegan",        className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  { value: "spicy",        emoji: "🌶️", label: "Picante",      label_en: "Spicy",        className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  { value: "gluten_free",  emoji: "🚫🌾", label: "Sin gluten",  label_en: "Gluten-free",  className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { value: "lactose_free", emoji: "🥛", label: "Sin lactosa",  label_en: "Lactose-free", className: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  { value: "new",          emoji: "✨", label: "Nuevo",        label_en: "New",          className: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  { value: "popular",      emoji: "🔥", label: "Popular",      label_en: "Popular",      className: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
];

export const TAG_BY_VALUE = new Map(PRODUCT_TAGS.map((t) => [t.value, t]));
