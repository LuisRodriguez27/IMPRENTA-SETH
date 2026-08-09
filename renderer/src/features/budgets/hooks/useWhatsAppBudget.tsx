import { useNoteWhatsApp } from '@/features/notes/useNoteWhatsApp';
import { budgetToNote } from '../utils/budgetNote';
import { type Budget } from '../types';

export function useWhatsAppBudget() {
  return useNoteWhatsApp<Budget>({
    documentName: 'Presupuesto',
    initialMessage:
      'Le enviamos la cotización solicitada esperamos vernos favorecidos, será un placer colaborar con usted',
    buildNote: budgetToNote,
    getPhone: budgetData => budgetData.client?.phone || '',
    getDialogHint: budgetData => `con su presupuesto (#${budgetData.id})`,
  });
}
