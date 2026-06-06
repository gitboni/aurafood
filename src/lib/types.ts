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
  created_at: string;
};

export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";
export type OrderSource = "pos" | "qr";

export type Order = {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_table: string | null;
  status: OrderStatus;
  total: number;
  notes: string | null;
  source: OrderSource;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
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
