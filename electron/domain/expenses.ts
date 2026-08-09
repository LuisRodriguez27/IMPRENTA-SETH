import type { ExpensesRow } from '../types/domain';

class Expenses {
  id: number;
  cash_session_id: number;
  user_id: number;
  edited_by: number | null;
  amount: number;
  description: string;
  date: string;
  active: boolean;
  supplier_order_id: number | null;
  // Vienen del JOIN con users; sin ellos la columna "Registrado por" queda vacía.
  user_username: string | null;
  edited_by_username: string | null;

  constructor({ id, cash_session_id, user_id, edited_by, amount, description, date, active, supplier_order_id, user_username, edited_by_username }: ExpensesRow) {
    this.id = id;
    this.cash_session_id = cash_session_id;
    this.user_id = user_id;
    this.edited_by = edited_by;
    this.amount = parseFloat(String(amount)) || 0;
    this.description = description;
    this.date = date;
    this.active = active;
    this.supplier_order_id = supplier_order_id || null;
    this.user_username = user_username ?? null;
    this.edited_by_username = edited_by_username ?? null;
  }

  isValid(): boolean {
    return !!(
      this.cash_session_id && this.cash_session_id > 0 &&
      this.user_id && this.user_id > 0 &&
      typeof this.amount === 'number' && this.amount > 0 && !isNaN(this.amount) &&
      this.description && this.date && this.active
    );
  }

  toPlainObject() {
    return { id: this.id, cash_session_id: this.cash_session_id, user_id: this.user_id, edited_by: this.edited_by, amount: this.amount, description: this.description, date: this.date, active: this.active, supplier_order_id: this.supplier_order_id, user_username: this.user_username, edited_by_username: this.edited_by_username };
  }
}

export default Expenses;
