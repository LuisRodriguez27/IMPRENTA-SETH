import type { ProductTemplateRow } from '../types/domain';

class ProductTemplate {
  id: number;
  productId: number;
  name: string;
  product_name: string;
  final_price: number;
  promo_price: number | null;
  purchase_price: number | null;
  dimensions: string;
  category: string;
  model: string;
  package: boolean;
  piecesPerPack: number | null;
  description: string | null;
  template_serial_number: string | null;
  created_by: number | null;
  stock: number;
  active: boolean;
  serial_number: string | null;
  created_by_username: string | null;

  constructor(row: ProductTemplateRow) {
    this.id = row.id;
    this.productId = row.productId !== undefined ? row.productId : row.product_id;
    this.name = row.name || '';
    this.product_name = row.product_name || '';
    this.final_price = parseFloat(String(row.final_price)) || 0;
    this.promo_price = row.promo_price !== null && row.promo_price !== undefined ? parseFloat(String(row.promo_price)) : null;
    this.purchase_price = row.purchase_price !== null && row.purchase_price !== undefined ? parseFloat(String(row.purchase_price)) : null;
    this.dimensions = row.dimensions || '';
    this.category = row.category || '';
    this.model = row.model || '';
    this.package = row.package === 1 || row.package === true;
    
    const pzas = row.piecesPerPack !== undefined 
      ? row.piecesPerPack 
      : row.pieces_per_pack;
    this.piecesPerPack = pzas !== null && pzas !== undefined ? parseInt(String(pzas), 10) : null;
    
    this.description = row.description || null;
    this.template_serial_number = row.template_serial_number || null;
    this.created_by = row.created_by || null;
    this.stock = parseFloat(String(row.stock)) || 0;
    this.active = row.active === 1 || row.active === true;
    this.serial_number = row.serial_number || null;
    this.created_by_username = row.created_by_username || null;
  }

  isActive(): boolean { return this.active === true; }
  hasCustomDimensions(): boolean { return !!(this.dimensions && this.dimensions.trim().length > 0); }
  hasDescription(): boolean { return !!(this.description && this.description.trim().length > 0); }
  isFree(): boolean { return this.final_price === 0; }
  isPaid(): boolean { return this.final_price > 0; }

  getDisplayName(): string {
    if (this.hasDescription()) return `${this.name} - ${this.description}`;
    return `${this.name} - Plantilla ${this.id}`;
  }

  getFormattedPrice(): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(this.final_price);
  }

  getDimensions(): string | null {
    return this.dimensions || null;
  }

  isValid(): boolean {
    return !!(this.productId && this.productId > 0 && typeof this.final_price === 'number' && this.final_price >= 0 && !isNaN(this.final_price));
  }

  matchesSearchTerm(searchTerm: string): boolean {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return !!(
      (this.name && this.name.toLowerCase().includes(term)) ||
      (this.description && this.description.toLowerCase().includes(term)) ||
      (this.serial_number && this.serial_number.toLowerCase().includes(term)) ||
      (this.template_serial_number && this.template_serial_number.toLowerCase().includes(term)) ||
      (this.category && this.category.toLowerCase().includes(term)) ||
      (this.model && this.model.toLowerCase().includes(term)) ||
      (this.created_by_username && this.created_by_username.toLowerCase().includes(term))
    );
  }

  toPlainObject() {
    return {
      id: this.id,
      productId: this.productId,
      name: this.name,
      product_name: this.product_name,
      final_price: this.final_price,
      promo_price: this.promo_price,
      purchase_price: this.purchase_price,
      dimensions: this.dimensions,
      category: this.category,
      model: this.model,
      package: this.package,
      piecesPerPack: this.piecesPerPack,
      description: this.description,
      template_serial_number: this.template_serial_number,
      created_by: this.created_by,
      active: this.active,
      stock: this.stock,
      serial_number: this.serial_number,
      created_by_username: this.created_by_username
    };
  }
}

export default ProductTemplate;
