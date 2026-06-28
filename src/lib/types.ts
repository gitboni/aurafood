export type Category = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  image_url: string | null;
  available: boolean;
  featured: boolean;
  sort_order: number;
  stock: number | null;
  track_stock: boolean;
  created_at: string;
  // patch5 — atributos enriquecidos (opcionales)
  tags?: string[] | null;
  allergens?: string | null;
  calories?: number | null;
  portion_size?: string | null;
  name_en?: string | null;
  description_en?: string | null;
};

export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";
export type OrderSource = "pos" | "qr";

export type PaymentMethod = "cash" | "card" | "transfer" | "mixed";

export type Order = {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_table: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  total: number;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tip: number;
  payment_method: PaymentMethod;
  order_type: OrderType;
  notes: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  source: OrderSource;
  location_id: string | null;
  shift_id: string | null;
  ncf: string | null;
  ncf_type: NCFType | null;
  ncf_issued_at: string | null;
  customer_rnc: string | null;
  customer_razon_social: string | null;
  customer_doc_type: DocType | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export type Location = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
};

export type CartItem = {
  product: Product;
  quantity: number;
  notes: string;
  modifiers?: SelectedModifier[];
};

// ── Refunds ─────────────────────────────────────────────────

export type RefundMethod = "cash" | "card" | "transfer" | "store_credit";

export type Refund = {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  refund_method: RefundMethod;
  refunded_by: string | null;
  refunded_by_name: string | null;
  notes: string | null;
  created_at: string;
};

// ── Audit log ───────────────────────────────────────────────

export type AuditEntry = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

// ── Customers (CRM) ─────────────────────────────────────────

export type Customer = {
  id: string;
  phone: string | null;
  name: string | null;
  total_orders: number;
  total_spent: number;
  loyalty_points: number;
  last_visit: string | null;
  created_at: string;
};

// ── Settings (branding) ─────────────────────────────────────

export type Settings = {
  id: number;
  restaurant_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  address: string | null;
  phone: string | null;
  rfc: string | null;
  tax_enabled: boolean;
  tax_rate: number;
  tax_label: string;
  tax_inclusive: boolean;
  auto_print_kitchen: boolean;
  enable_online_payment: boolean;
  enable_qr_tip: boolean;
  enable_qr_ordering: boolean;
  loyalty_enabled: boolean;
  loyalty_points_per_currency: number;
  manager_pin: string | null;
  rnc: string | null;
  razon_social: string | null;
  ncf_default_type: NCFType;
  updated_at: string;
};

// ── NCF Dominican Republic ──────────────────────────────────

export type NCFType = "B01" | "B02" | "B03" | "B04" | "B11" | "B12" | "B13" | "B14" | "B15" | "B16" | "B17";

export const NCF_LABELS: Record<NCFType, string> = {
  B01: "Crédito Fiscal",
  B02: "Consumidor Final",
  B03: "Nota de Débito",
  B04: "Nota de Crédito",
  B11: "Proveedores Informales",
  B12: "Registro Único de Ingresos",
  B13: "Gastos Menores",
  B14: "Régimen Especial",
  B15: "Gubernamental",
  B16: "Exportaciones",
  B17: "Pagos al Exterior",
};

export type NCFSequence = {
  id: string;
  restaurant_id: string;
  tipo: NCFType;
  prefix: string;
  range_start: number;
  range_end: number;
  current: number;
  expires_at: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

export type DocType = "rnc" | "cedula" | "passport" | "other";

export type FloorTable = {
  id: string;
  name: string;
  zone: string;
  seats: number;
  x: number;
  y: number;
  shape: "square" | "round" | "rect";
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type OrderType = "dine_in" | "takeout" | "delivery";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: "Comer aquí",
  takeout: "Para llevar",
  delivery: "Delivery",
};

export type CashMovement = {
  id: string;
  shift_id: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type Combo = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  combo_items?: ComboItem[];
};

export type ComboItem = {
  id: string;
  combo_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
};

// ── Roles ───────────────────────────────────────────────────

export type UserRole = "admin" | "cashier" | "kitchen";

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
};

// ── Shifts / Cash Register ──────────────────────────────────

export type Shift = {
  id: string;
  user_id: string;
  user_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  total_sales: number;
  total_orders: number;
  total_cancelled: number;
  notes: string | null;
  status: "open" | "closed";
};

// ── Modifiers ───────────────────────────────────────────────

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  max_select: number;
  sort_order: number;
  created_at: string;
  modifiers?: Modifier[];
};

export type Modifier = {
  id: string;
  group_id: string;
  name: string;
  price: number;
  available: boolean;
  sort_order: number;
};

export type SelectedModifier = {
  modifier_id: string;
  modifier_name: string;
  price: number;
};

// ── Inventory Movements ─────────────────────────────────────

export type InventoryMovementType = "purchase" | "adjustment" | "consumption" | "waste";

export type InventoryMovement = {
  id: string;
  product_id: string;
  type: InventoryMovementType;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  supplier: string | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  product_name?: string;
};

// ── Inventory ────────────────────────────────────────────────

export type Ingredient = {
  id: string;
  name: string;
  unit: string;           // g, kg, mL, L, pza, porción…
  stock: number;          // current stock in `unit`
  min_stock: number;      // low-stock alert threshold
  cost_per_unit: number;  // cost per 1 `unit`
  created_at: string;
};

export type ProductRecipe = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;       // amount of ingredient per 1 unit of product sold
  created_at: string;
  ingredient?: Ingredient;
};

export type StockMovementType = "sale" | "purchase" | "adjustment" | "waste";

export type StockMovement = {
  id: string;
  ingredient_id: string;
  type: StockMovementType;
  quantity: number;        // negative = consumption, positive = addition
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  ingredient?: Ingredient;
};
