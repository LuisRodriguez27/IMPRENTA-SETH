/**
 * Tipos del agregado Expense (Gasto).
 * Espeja domain/expenses.ts
 */

// ─── Row types ─────────────────────────────────────────────────────────────

export interface ExpensesRow {
  id: number;
  cash_session_id: number;
  user_id: number;
  edited_by: number | null;
  amount: number;
  description: string;
  date: string;
  active: boolean;
  supplier_order_id: number | null;

  // Añadidos por el JOIN con users
  user_username?: string | null;
  edited_by_username?: string | null;
}

// ─── Input / DTO types ─────────────────────────────────────────────────────

export interface CreateExpenseData {
  cash_session_id: number;
  user_id: number;
  amount: number | string;
  description: string;
  date: string;
  supplier_order_id?: number | null;
}

export interface UpdateExpenseData {
  amount?: number | string;
  description?: string;
  date?: string;
  edited_by?: number | string;
  supplier_order_id?: number | null;
}
