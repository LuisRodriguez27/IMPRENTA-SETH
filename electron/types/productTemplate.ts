/**
 * Tipos del agregado ProductTemplate.
 * Espeja domain/productTemplate.ts
 */

// ─── Row types ─────────────────────────────────────────────────────────────

export interface ProductTemplateRow {
  id: number;
  product_id: number;
  productId?: number;
  final_price: number;
  promo_price: number | null;
  dimensions?: string | null;
  category?: string | null;
  model?: string | null;
  package?: boolean | number;
  pieces_per_pack?: number | null;
  piecesPerPack?: number | null;
  description: string | null;
  created_by: number | null;
  active: boolean | number;
  // Joined fields
  name?: string;
  product_name?: string | null;
  serial_number?: string | null;
  created_by_username?: string | null;
}

// ─── Input / DTO types ─────────────────────────────────────────────────────

export interface TemplateData {
  product_id?: number;
  productId?: number;
  name?: string | null;
  final_price: number | string;
  promo_price?: number | string | null;
  dimensions?: string | null;
  category?: string | null;
  model?: string | null;
  package?: boolean | number;
  pieces_per_pack?: number | string | null;
  piecesPerPack?: number | string | null;
  description?: string | null;
  created_by?: number | string | null;
}
