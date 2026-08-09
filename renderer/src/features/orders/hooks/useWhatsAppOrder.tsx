import { useNoteWhatsApp } from '@/features/notes/useNoteWhatsApp';
import { orderToNote } from '../utils/orderNote';

interface OrderWhatsAppArgs {
  orderData: any;
  productsData: any[];
  paymentsData: any[];
}

export function useWhatsAppOrder() {
  const base = useNoteWhatsApp<OrderWhatsAppArgs>({
    documentName: 'Orden',
    initialMessage: 'Se le envia la orden de compra en caso que extravie su nota.',
    buildNote: ({ orderData, productsData, paymentsData }) =>
      orderToNote(orderData, productsData, paymentsData),
    getPhone: ({ orderData }) => orderData.client?.phone || '',
    getDialogHint: ({ orderData }) => `(orden #${orderData.id})`,
  });

  return {
    ...base,
    sendWhatsApp: (orderData: any, productsData: any[], paymentsData: any[]) =>
      base.sendWhatsApp({ orderData, productsData, paymentsData }),
  };
}
