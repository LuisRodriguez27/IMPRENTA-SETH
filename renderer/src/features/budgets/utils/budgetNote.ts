import cotizacionImage from '@/assets/COTIZACION-IMPRESOS-SETh.jpg';
import {
  getBudgetItemType,
  getBudgetItemDisplayName,
  getBudgetItemDescription,
  type Budget,
} from '../types';
import type { Note } from '@/features/notes/noteData';

/**
 * Adapta un presupuesto al modelo compartido de nota.
 *
 * La hoja de cotización es el mismo formato que la nota (mismo tamaño, mismo
 * encabezado, misma fila de CLIENTE y la misma tabla), sólo cambia el diseño
 * impreso. Lo que no trae son los recuadros de ANTICIPO y RESTA, ni horario de
 * recepción, así que esos campos se omiten y el total se dibuja en su propio
 * recuadro.
 */
export function budgetToNote(budgetData: Budget): Note {
  const productsData = budgetData.budgetProducts || [];

  const hasPreferentialPrice = productsData.some(product => {
    const type = getBudgetItemType(product);
    const originalPrice = type === 'product'
      ? product.product_price
      : product.template_final_price;

    return originalPrice !== undefined && originalPrice !== null &&
      Math.abs(Number(product.unit_price) - Number(originalPrice)) > 0.01;
  });

  return {
    background: cotizacionImage,
    folio: `${budgetData.id}`,
    date: budgetData.date,
    showTime: false,
    estimatedDeliveryDate: null,
    clientName: budgetData.client?.name || 'Cliente no especificado',
    clientPhone: budgetData.client?.phone || '',
    clientColor: budgetData.client?.color ?? null,
    attendedByLine: '',
    paymentLine: '',
    description: '',
    items: productsData.map(product => ({
      quantity: product.quantity,
      name: getBudgetItemDisplayName(product),
      description: getBudgetItemDescription(product) || '',
      unitPrice: product.unit_price,
      totalPrice: product.total_price,
    })),
    payments: null,
    total: budgetData.total,
    totalLabel: 'TOTAL',
    isSaldada: false,
    hasPreferentialPrice,
  };
}
