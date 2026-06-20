import { z } from 'zod';

export const createProductTemplateSchema = z.object({
  productId: z.number().int().min(1, 'El ID del producto es obligatorio'),
  name: z.string().min(1, 'El nombre de la plantilla es obligatorio'),
  final_price: z.number().min(0, 'El precio final debe ser un número positivo').optional().or(z.nan().transform(() => undefined)),
  promo_price: z.number().min(0).optional().nullable(),
  dimensions: z.string().optional(),
  category: z.string().optional(),
  model: z.string().optional(),
  package: z.boolean(),
  piecesPerPack: z.number().int().min(0).nullable().optional().or(z.nan().transform(() => undefined)),
  description: z.string().optional().nullable(),
  created_by: z.number().int().optional(),
  stock: z.number({ error: 'El stock debe ser un número' }).min(0, 'El stock no puede ser negativo').optional().or(z.nan().transform(() => undefined))
});

export const editProductTemplateSchema = z.object({
  productId: z.number().int().min(1, 'El ID del producto es obligatorio').optional(),
  name: z.string().min(1, 'El nombre de la plantilla es obligatorio'),
  final_price: z.number().min(0, 'El precio final debe ser un número positivo').optional().or(z.nan().transform(() => undefined)),
  promo_price: z.number().min(0).optional().nullable(),
  dimensions: z.string().optional(),
  category: z.string().optional(),
  model: z.string().optional(),
  package: z.boolean(),
  piecesPerPack: z.number().int().min(0).nullable().optional().or(z.nan().transform(() => undefined)),
  description: z.string().optional().nullable(),
  created_by: z.number().int().optional(),
  stock: z.number({ error: 'El stock debe ser un número' }).min(0, 'El stock no puede ser negativo').optional().or(z.nan().transform(() => undefined))
});

export type CreateProductTemplateForm = z.infer<typeof createProductTemplateSchema>;
export type EditProductTemplateForm = z.infer<typeof editProductTemplateSchema>;

export interface ProductTemplate {
  id: number;
  productId: number;
  product_id?: number; // fallback
  name: string; // Nombre de la plantilla
  product_name?: string; // Nombre del producto padre
  final_price: number;
  promo_price?: number | null;
  dimensions: string;
  category: string;
  model: string;
  package: boolean;
  piecesPerPack?: number | null;
  description: string | null; // Descripción de la plantilla
  created_by?: number | null;
  stock?: number;
  active: boolean;

  serial_number?: string | null;
  created_by_username?: string | null;
}