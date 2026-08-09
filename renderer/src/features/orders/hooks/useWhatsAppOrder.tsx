import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  prepareNotePages,
  buildNoteDocumentsForCapture,
  PAGE_WIDTH_PX,
  PAGE_HEIGHT_PX,
} from '../utils/buildOrderPageHtml';
import { orderToNote } from '../utils/orderNoteData';

const CAPTURE_SCALE = 2;

const base64ToBlob = (b64: string): Blob => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer una página de la nota'));
    img.src = src;
  });

/** Apila varias páginas en un solo PNG vertical. Devuelve base64. */
const stitchPages = async (pngBase64: string[]): Promise<string> => {
  if (pngBase64.length === 1) return pngBase64[0];

  const images = await Promise.all(
    pngBase64.map(b64 => loadImage(`data:image/png;base64,${b64}`))
  );

  const width = Math.max(...images.map(i => i.naturalWidth));
  const height = images.reduce((sum, i) => sum + i.naturalHeight, 0);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo componer la imagen de la nota');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  let offsetY = 0;
  for (const img of images) {
    ctx.drawImage(img, 0, offsetY);
    offsetY += img.naturalHeight;
  }

  return canvas.toDataURL('image/png').split(',')[1];
};

export function useWhatsAppOrder() {
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [pendingArgs, setPendingArgs] = useState<{
    orderData: any;
    productsData: any[];
    paymentsData: any[];
  } | null>(null);

  const startWhatsAppFlow = (
    orderData: any,
    productsData: any[],
    paymentsData: any[]
  ) => {
    const initialMsg = `Se le envia la orden de compra en caso que extravie su nota.`;
    setMessageText(initialMsg);
    setPendingArgs({ orderData, productsData, paymentsData });
    setIsDialogOpen(true);
  };

  const confirmAndSend = async () => {
    if (!pendingArgs) return;
    setIsDialogOpen(false);
    setIsSendingWhatsApp(true);
    const { orderData, productsData, paymentsData } = pendingArgs;

    try {
      // ── Rasterizar el mismo documento que va a la impresora ───────────────
      // Lo hace el proceso principal con capturePage, es decir, con el motor de
      // render de Chromium. Así la imagen es idéntica a la impresión.
      const note = orderToNote(orderData, productsData, paymentsData);
      const pagesHtml = await prepareNotePages(note);
      const documents = buildNoteDocumentsForCapture(`Orden #${note.folio}`, pagesHtml);

      const pngPages = await window.api.renderNoteToImages(documents, {
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        scale: CAPTURE_SCALE,
      });

      const png = await stitchPages(pngPages);
      const pagesLabel = pngPages.length > 1 ? ` (${pngPages.length} páginas)` : '';

      // ── Copiar al portapapeles ────────────────────────────────────────────
      try {
        await window.api.copyImageToClipboard(png);
        toast.success(`Imagen copiada${pagesLabel}. ¡Pégala en WhatsApp con Ctrl+V!`);
      } catch {
        const url = URL.createObjectURL(base64ToBlob(png));
        const a = document.createElement('a');
        a.href = url;
        a.download = `orden-${orderData.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info(`Imagen descargada${pagesLabel}. Adjúntala manualmente en WhatsApp.`);
      }

      // ── Abrir WhatsApp ────────────────────────────────────────────────────
      const message = messageText;

      const rawPhone = (orderData.client?.phone || '').replace(/\D/g, '');
      const phoneWithCountry = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;

      let whatsappUrl: string;
      if (phoneWithCountry) {
        whatsappUrl = `https://web.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`;
      } else {
        whatsappUrl = `https://web.whatsapp.com/`;
        toast.warning('El cliente no tiene número registrado. Selecciona el chat manualmente.');
      }

      await window.api.openExternal(whatsappUrl);

    } catch (error) {
      console.error('Error al enviar por WhatsApp:', error);
      toast.error('Ocurrió un error al preparar el envío por WhatsApp.');
    } finally {
      setIsSendingWhatsApp(false);
      setPendingArgs(null);
    }
  };

  const whatsappDialogElement = isDialogOpen ? (
      <div className="fixed inset-0 flex items-center justify-center z-9999" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Mensaje de WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-4">Edita el mensaje que se enviará al cliente (orden #{pendingArgs?.orderData?.id}).</p>
          <textarea
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25d366] focus:border-transparent resize-none"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAndSend} className="bg-[#25D366] hover:bg-[#1ebe5d] text-white" disabled={isSendingWhatsApp}>Generar y Enviar</Button>
          </div>
        </div>
      </div>
  ) : null;

  return { isSendingWhatsApp, sendWhatsApp: startWhatsAppFlow, whatsappDialogElement };
}
