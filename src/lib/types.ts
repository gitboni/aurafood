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

export type Order = {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_table: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  total: number;
  notes: string | null;
  source: OrderSource;
  location_id: string | null;
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
