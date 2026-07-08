import { z } from 'zod';

// Item de orden - puede ser producto o plantilla
export const budgetItemSchema = z.object({
  product_id: z.number().int().min(1, 'Debe seleccionar un producto o una plantilla').nullable().optional(),
  template_id: z.number().int().min(1, 'Debe seleccionar un producto o una plantilla').nullable().optional(),
  quantity: z.number().min(0.0001, 'La cantidad debe ser al menos 0.0001'),
  unit_price: z.number().min(0, 'El precio debe ser un número positivo'),
}).refine((data) => {
  // Debe tener exactamente uno: product_id O template_id
  const hasProduct = data.product_id !== null && data.product_id !== undefined;
  const hasTemplate = data.template_id !== null && data.template_id !== undefined;
  return (hasProduct && !hasTemplate) || (!hasProduct && hasTemplate);
}, {
  message: "Debe especificar un producto O una plantilla, no ambos",
});

// Crear orden - nueva estructura con items
export const createBudgetSchema = z.object({
  client_id: z.number({ error: 'El cliente es obligatorio' }).int().min(1, 'El cliente es obligatorio'),
  user_id: z.number({ error: 'El usuario es obligatorio' }).int().min(1, 'El usuario es obligatorio'),
  date: z.string().min(1, 'La fecha es obligatoria'), 
  items: z.array(budgetItemSchema).min(1, 'La orden debe tener al menos un producto o plantilla')
});

// Editar presupuesto
export const editBudgetSchema = z.object({
  client_id: z.number().int().min(1).optional(),
  user_id: z.number().int().min(1).optional(),
  edited_by: z.number().int().min(1).optional(),
  date: z.string().optional(),
  items: z.array(budgetItemSchema).optional()
});

export type CreateBudgetForm = z.infer<typeof createBudgetSchema>;
export type EditBudgetForm = z.infer<typeof editBudgetSchema>;
export type BudgetItem = z.infer<typeof budgetItemSchema>;

// Interfaces de entidades
export interface Budget {
  id: number;
  client_id: number;
  user_id: number;
  edited_by?: number;
  date: string; // ISO date string
  total: number;
  converted_to_order?: boolean;
  active?: boolean;

  // Para joins
  client?: {
    id: number;
    name: string;
    phone: string;
    color?: string | null;
  };
  user?: {
    id: number;
    username: string;
  };
  editedByUser?: {
    id: number;
    username: string;
  };
  budgetProducts?: BudgetProduct[];
  payments?: {
    id: number;
    amount: number;
    date?: string;
  }[];
}

export interface BudgetProduct {
  id: number;
  budget_id: number;
  product_id: number | null;
  template_id?: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;

  // Datos añadidos por JOIN con products
  product_name?: string;
  serial_number?: string;
  product_price?: number;
  product_description?: string;

  // Datos añadidos por JOIN con templates
  template_dimensions?: string;
  template_category?: string;
  template_model?: string;
  template_package?: boolean | number;
  template_pieces_per_pack?: number | null;
  template_description?: string;
  template_final_price?: number;
  template_created_by_username?: string;
  template_base_product_name?: string;
}

// Tipos para el formulario del frontend
export interface BudgetFormItem {
  type: 'product' | 'template';
  id: number; // product_id o template_id
  name: string;
  quantity: number;
  unit_price: number;
  // Datos adicionales según el tipo
  description?: string;
  serial_number?: string; // solo productos
  dimensions?: string; // solo plantillas
  category?: string; // solo plantillas
  model?: string; // solo plantillas
  package?: boolean; // solo plantillas
  piecesPerPack?: number | null; // solo plantillas
}

// Funciones de utilidad
export const createBudgetItemFromFormItem = (formItem: BudgetFormItem): BudgetItem => {
  if (formItem.type === 'product') {
    return {
      product_id: formItem.id,
      template_id: null,
      quantity: formItem.quantity,
      unit_price: formItem.unit_price
    };
  } else {
    return {
      product_id: null,
      template_id: formItem.id,
      quantity: formItem.quantity,
      unit_price: formItem.unit_price
    };
  }
};

export const getBudgetItemDisplayName = (budgetProduct: BudgetProduct): string => {
  if (budgetProduct.product_id) {
    return budgetProduct.product_name || `Producto #${budgetProduct.product_id}`;
  } else if (budgetProduct.template_id) {
    const baseName = budgetProduct.template_base_product_name || budgetProduct.product_name || 'Producto';
    return `${baseName} (Producto)`;
  }
  return 'Item desconocido';
};


export const getBudgetItemDescription = (budgetProduct: BudgetProduct): string => {
  if (budgetProduct.product_id) {
    // Para productos directos, usar la descripción del producto
    return budgetProduct.product_description || '';
  } else if (budgetProduct.template_id) {
    // Para plantillas, usar la descripción de la plantilla
    return budgetProduct.template_description || '';
  }
  return '';
};

export const getBudgetItemType = (budgetProduct: BudgetProduct): 'product' | 'template' => {
  return budgetProduct.product_id ? 'product' : 'template';
};

export const calculateBudgetTotal = (items: BudgetFormItem[]): number => {
  return items.reduce((total, item) => total + ((item.quantity || 0) * (item.unit_price || 0)), 0);
};