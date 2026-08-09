import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { X, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { prepareNoteHtml, buildPrintHtml } from '@/features/notes/buildNoteHtml';
import { chunkNoteItems } from '@/features/notes/noteData';
import NotePage from '@/features/notes/NotePage';
import { budgetToNote } from '../utils/budgetNote';
import { type Budget } from '../types';

interface BudgetPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetData: Budget;
}

/**
 * La cotización se imprime sobre el mismo formato que la nota de orden, así que
 * comparte posiciones, vista previa y generador de HTML. Lo único propio de este
 * modal es el adaptador `budgetToNote`.
 */
export const BudgetPrintPreviewModal: React.FC<BudgetPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  budgetData
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !budgetData) return null;

  const note = budgetToNote(budgetData);
  const pages = chunkNoteItems(note.items);

  const handlePrint = async () => {
    setIsLoading(true);
    try {
      const { pagesHtml } = await prepareNoteHtml(note);
      const printHTML = buildPrintHtml({ title: `Presupuesto #${note.folio}`, pagesHtml });

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        toast.error('No se pudo abrir la ventana de impresión.');
        return;
      }
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = () => { printWindow.close(); };
        }, 500);
      };
      toast.success('Documento enviado a impresión');
    } catch (error) {
      console.error('Error al imprimir:', error);
      toast.error('Error al generar el documento de impresión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-60"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Printer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Vista Previa - Presupuesto #{budgetData.id}
              </h2>
              <p className="text-sm text-gray-500">
                Verifica los datos antes de imprimir
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Printer size={16} />
              {isLoading ? 'Imprimiendo...' : 'Imprimir'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="p-6 overflow-auto max-h-[calc(95vh-100px)]">
          <div className="flex flex-col items-center gap-8">
            {pages.map((items, index) => (
              <div key={index} className="flex justify-center">
                <NotePage
                  note={note}
                  items={items}
                  isLastPage={index === pages.length - 1}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetPrintPreviewModal;
