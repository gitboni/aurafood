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
  notes: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  source: OrderSource;
  location_id: string | null;
  shift_id: string | null;
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
  updated_at: string;
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
