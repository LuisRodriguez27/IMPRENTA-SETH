/**
 * Precio activo de venta (familias y productos).
 *
 * El catálogo muestra el menor de los precios capturados y lo etiqueta como
 * "Promo" o "Desc". Presupuestos y órdenes deben cobrar exactamente ese mismo
 * precio, así que la regla vive aquí en un solo lugar.
 *
 * Un precio alternativo cuenta sólo si viene capturado (no null/undefined) y es
 * menor al que se lleva acumulado; así un campo vacío nunca abarata la venta.
 */

export type PriceKind = 'base' | 'promo' | 'discount';

export interface ActivePrice {
  price: number;
  kind: PriceKind;
  basePrice: number;
}

const isCaptured = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && !isNaN(Number(value));

/** Familias: precio base, promoción y descuento. */
export const getActiveProductPrice = (product: {
  price: number;
  promo_price?: number | null;
  discount_price?: number | null;
}): ActivePrice => {
  const basePrice = Number(product.price) || 0;
  let price = basePrice;
  let kind: PriceKind = 'base';

  if (isCaptured(product.promo_price) && Number(product.promo_price) < price) {
    price = Number(product.promo_price);
    kind = 'promo';
  }

  if (isCaptured(product.discount_price) && Number(product.discount_price) < price) {
    price = Number(product.discount_price);
    kind = 'discount';
  }

  return { price, kind, basePrice };
};

/** Productos (plantillas): precio final y promoción. */
export const getActiveTemplatePrice = (template: {
  final_price: number;
  promo_price?: number | null;
}): ActivePrice => {
  const basePrice = Number(template.final_price) || 0;
  let price = basePrice;
  let kind: PriceKind = 'base';

  if (isCaptured(template.promo_price) && Number(template.promo_price) < price) {
    price = Number(template.promo_price);
    kind = 'promo';
  }

  return { price, kind, basePrice };
};

export const priceKindLabel = (kind: PriceKind): string | null =>
  kind === 'promo' ? 'Promo' : kind === 'discount' ? 'Desc' : null;
