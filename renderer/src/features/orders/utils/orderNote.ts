import notaImage from '@/assets/NOTA-IMPRESOS-SETh.jpg';
import { getOrderItemType, getOrderItemDisplayName, getOrderItemDescription } from '../types';
import type { Note } from '@/features/notes/noteData';

/** Adapta una orden al modelo compartido de nota. */
export function orderToNote(
  orderData: any,
  productsData: any[],
  paymentsData: any[]
): Note {
  const totalPagos = paymentsData.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const saldoPendiente = orderData.total - totalPagos;

  const hasPreferentialPrice = productsData.some(product => {
    const type = getOrderItemType(product);
    const originalPrice = type === 'product'
      ? product.product_price
      : product.template_final_price;

    return originalPrice !== undefined && originalPrice !== null &&
      Math.abs(Number(product.unit_price) - Number(originalPrice)) > 0.01;
  });

  return {
    background: notaImage,
    folio: `${orderData.id}`,
    date: orderData.date,
    showTime: true,
    estimatedDeliveryDate: orderData.estimated_delivery_date ?? null,
    clientName: orderData.client?.name || 'Cliente no especificado',
    clientPhone: orderData.client?.phone || '',
    clientColor: orderData.client?.color ?? null,
    attendedByLine: `LE ATENDIÓ ${orderData.user?.username || ''}`,
    paymentLine: paymentsData.length > 0
      ? `Pago realizado con: ${paymentsData[0]?.descripcion || ''}`
      : '',
    description: orderData.description || '',
    items: productsData.map(product => ({
      quantity: product.quantity,
      name: getOrderItemDisplayName(product),
      description: getOrderItemDescription(product) || '',
      unitPrice: product.unit_price,
      totalPrice: product.total_price,
    })),
    payments: {
      paid: totalPagos,
      balance: saldoPendiente,
      hasPayments: paymentsData.length > 0,
    },
    total: orderData.total,
    totalLabel: null,
    isSaldada: saldoPendiente <= 0.01,
    hasPreferentialPrice,
  };
}
