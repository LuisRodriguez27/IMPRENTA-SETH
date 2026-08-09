import notaImage from '@/assets/NOTA-IMPRESOS-SETh.jpg';
import type { Note } from '@/features/notes/noteData';

/**
 * Adapta una orden rápida al modelo compartido de nota.
 *
 * Es una orden de un solo concepto: sin fecha de entrega, sin color de cliente,
 * sin descripción y sin sellos. El teléfono va concatenado al nombre.
 */
export function simpleOrderToNote(orderData: any): Note {
  const paymentsData = orderData.payments || [];
  const totalPagos = paymentsData.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
  const saldoPendiente = Math.max(0, orderData.total - totalPagos);

  const clientName = `${orderData.client_name || 'Cliente de Mostrador'}${orderData.client_phone ? ` - ${orderData.client_phone}` : ''}`;

  return {
    background: notaImage,
    folio: `R-${orderData.id}`,
    date: orderData.date,
    showTime: true,
    estimatedDeliveryDate: null,
    clientName,
    clientPhone: '',
    clientColor: null,
    attendedByLine: `GRACIAS POR SU COMPRA. LE ATENDIÓ ${orderData.user?.username || ''}`,
    paymentLine: paymentsData.length > 0
      ? `Pago realizado con: ${paymentsData[0]?.descripcion || ''}`
      : '',
    description: '',
    items: [{
      quantity: 1,
      name: orderData.concept,
      description: '',
      unitPrice: orderData.total,
      totalPrice: orderData.total,
      preserveLineBreaks: true,
    }],
    payments: {
      paid: totalPagos,
      balance: saldoPendiente,
      hasPayments: paymentsData.length > 0,
    },
    total: orderData.total,
    totalLabel: null,
    // Las órdenes rápidas no llevan sellos.
    isSaldada: false,
    hasPreferentialPrice: false,
  };
}
