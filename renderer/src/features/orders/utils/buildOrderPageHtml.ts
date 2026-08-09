import notaImage from '@/assets/NOTA-IMPRESOS-SETh.jpg';
import paidStampImage from '@/assets/SELLO-PAGADO.png';
import {
  getDay,
  getMonth,
  getYear,
  getHours,
  getDayUTC,
  getMonthUTC,
  getYearUTC,
  money,
  clientColorHex,
  chunkNoteItems,
  imageToBase64,
  NOTE_COLORS as C,
  type OrderNote,
  type NoteItem,
} from './orderNoteData';

// Re-exportado por compatibilidad: la implementación vive en orderNoteData.
export { imageToBase64 };

/** Proporción de la página de la nota: 21.6cm x 17cm. */
export const PAGE_ASPECT = 21.6 / 17;

// Escapa texto que viene de la base de datos antes de meterlo en el HTML.
const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ── Genera el HTML de UNA página de la nota ───────────────────────────────
// Coordenadas trasladadas 1:1 desde la vista previa (lienzo 816 x 642.5px).
// Equivalencia: clase Tailwind `N` = N * 0.25rem  (ej. left-138 = 34.5rem).
export function buildPageHtml(params: {
  note: OrderNote;
  items: NoteItem[];
  isLastPage: boolean;
  pageBreak: boolean;
  base64Image: string;
  base64Stamp: string | null;
}): string {
  const { note, items, isLastPage, pageBreak, base64Image, base64Stamp } = params;
  const circleColor = clientColorHex(note.clientColor);

  return `
    <div class="print-container" style="${pageBreak ? 'page-break-before: always;' : ''}">
      ${note.hasPreferentialPrice ? `
      <!-- Sello de precio especial · bottom-8 right-10 w-26 p-1.5 -->
      <div style="position: absolute; bottom: 2rem; right: 2.5rem; width: 6.5rem; background-color: ${C.red600}; color: ${C.white}; font-weight: 700; font-size: 0.65rem; line-height: 1.2; text-align: center; padding: 0.375rem; box-sizing: border-box; z-index: 10;">
        USTED HA ADQUIRIDO UN PRECIO ESPECIAL
      </div>
      ` : ''}

      ${note.isSaldada && base64Stamp ? `
      <!-- Sello de saldada · bottom-22 right-36 -->
      <img src="${base64Stamp}" alt="Saldada" style="position: absolute; bottom: 5.5rem; right: 9rem; width: 7rem; height: auto; z-index: 10; opacity: 0.9; transform: rotate(25deg);" />
      ` : ''}

      <!-- Imagen de fondo -->
      <img src="${base64Image}" alt="Fondo" class="background-image" />

      <!-- Fecha de recibo · top-13 left-138 w-[110px] text-sm -->
      <div style="position: absolute; top: 3.25rem; left: 34.5rem; width: 110px; text-align: right; font-size: 0.875rem; line-height: 1.25rem; font-weight: 700; color: ${C.black};">
        <div style="display: flex; gap: 1rem;">
          <span>${getDay(note.date)}</span>
          <span>${getMonth(note.date)}</span>
          <span>${getYear(note.date)}</span>
        </div>
      </div>

      ${note.estimatedDeliveryDate ? `
      <!-- Fecha de entrega · top-13 left-169 w-[100px] text-sm -->
      <div style="position: absolute; top: 3.25rem; left: 42.25rem; width: 100px; text-align: right; font-size: 0.875rem; line-height: 1.25rem; font-weight: 700; color: ${C.black};">
        <div style="display: flex; gap: 1.25rem;">
          <span>${getDayUTC(note.estimatedDeliveryDate)}</span>
          <span>${getMonthUTC(note.estimatedDeliveryDate)}</span>
          <span>${getYearUTC(note.estimatedDeliveryDate)}</span>
        </div>
      </div>
      ` : ''}

      <!-- Hora · top-32 right-55 (sin negrita, igual que el preview) -->
      <div style="position: absolute; top: 8rem; right: 13.75rem; font-size: 1rem; line-height: 1.5; font-weight: 400; color: ${C.black};">
        ${getHours(note.date)}
      </div>

      <!-- Cliente · top-32 left-25 w-[288px] text-xl -->
      <div style="position: absolute; top: 8rem; left: 6.25rem; width: 288px; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; color: ${C.black}; display: flex; align-items: center; gap: 0.5rem;">
        ${circleColor ? `<div style="width: 1rem; height: 1rem; border-radius: 9999px; background-color: ${circleColor}; flex-shrink: 0;"></div>` : ''}
        <span style="font-size: calc(1em - 2px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${esc(note.clientName)}
        </span>
      </div>

      <!-- Teléfono · top-32 left-[620px] w-[152px] text-xl -->
      <div style="position: absolute; top: 8rem; left: 620px; width: 152px; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; color: ${C.black};">
        <span style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(note.clientPhone)}</span>
      </div>

      <!-- Productos · top-42 left-6 right-6 bottom-40, recortado para que la
           tabla no se derrame sobre la zona de totales -->
      <div style="position: absolute; top: 10.5rem; left: 1.5rem; right: 1.5rem; bottom: 10rem; overflow: hidden; color: ${C.black};">
        ${items.map(item => `
        <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5; padding-top: 0.25rem; padding-bottom: 0.25rem;">
          <div style="grid-column: span 1 / span 1; text-align: center;">${esc(item.quantity)}</div>
          <div style="grid-column: span 8 / span 8; padding-left: 0.25rem;">
            <div style="font-weight: 500;${item.preserveLineBreaks ? ' white-space: pre-wrap;' : ''}">${esc(item.name)}</div>
            ${item.description
      ? `<div style="font-size: 0.875rem; line-height: 1.25; color: ${C.gray700}; margin-top: -0.5rem;">${esc(item.description)}</div>`
      : ''}
          </div>
          <div style="grid-column: span 1 / span 1; margin-left: 1.5rem; text-align: right; font-weight: 500;">$${money(item.unitPrice)}</div>
          <div style="grid-column: span 2 / span 2; text-align: right; font-weight: 500;">$${money(item.totalPrice)}</div>
        </div>
        `).join('')}
      </div>

      ${isLastPage && note.description ? `
      <!-- Descripción · bottom-37 left-20 right-10 p-2 text-sm -->
      <div style="position: absolute; bottom: 9.25rem; left: 5rem; right: 2.5rem; font-size: 0.875rem; line-height: 1.25rem; color: ${C.red800}; padding: 0.5rem; border-radius: 0.25rem;">
        <div style="display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: break-word;">
          ${esc(note.description)}
        </div>
      </div>
      ` : ''}

      <!-- Folio · bottom-22 right-18 text-xl -->
      <div style="position: absolute; bottom: 5.5rem; right: 4.5rem; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; color: ${C.red600};">
        <div style="text-align: center;">No. ${esc(note.folio)}</div>
      </div>

      <!-- Le atendió · bottom-28 left-6 -->
      <div style="position: absolute; bottom: 7rem; left: 1.5rem; font-size: 1rem; line-height: 1.5;">
        <div style="color: ${C.blue900}; font-weight: 700;">${esc(note.attendedByLine)}</div>
      </div>

      <!-- Método de pago · bottom-29 left-90 -->
      <div style="position: absolute; bottom: 7.25rem; left: 22.5rem; font-size: 1rem; line-height: 1.5; color: ${C.black};">
        ${esc(note.paymentLine)}
      </div>

      <!-- Pagos · bottom-16 left-43 w-33 h-8 text-xl -->
      <div style="position: absolute; bottom: 4rem; left: 10.75rem; width: 8.25rem; height: 2rem; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; color: ${C.green700};">
        ${note.showPagos ? `$${money(note.totalPagos)}` : ''}
      </div>

      <!-- Saldo · bottom-16 left-80 w-33 h-8 text-xl -->
      <div style="position: absolute; bottom: 4rem; left: 20rem; width: 8.25rem; height: 2rem; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; color: ${C.red600};">
        $${money(note.saldoPendiente)}
      </div>

      <!-- Total · bottom-16 left-116 w-33 h-8 text-xl -->
      <div style="position: absolute; bottom: 4rem; left: 29rem; width: 8.25rem; height: 2rem; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; color: ${C.black};">
        $${money(note.total)}
      </div>
    </div>`;
}

// ── CSS compartido para impresión y captura de imagen ─────────────────────
export const PRINT_STYLES = `
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    font-family: Arial, sans-serif !important;
    /* Igual que el preflight de Tailwind, para que los anchos con padding
       midan lo mismo aquí que en la vista previa. */
    box-sizing: border-box;
  }
  html {
    font-size: 16px !important;
  }
  @page {
    size: 21.6cm 17cm landscape;
    margin: 0;
  }
  @media print {
    html {
      font-size: 16px !important;
    }
    html, body {
      width: 21.6cm !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .print-container {
      width: 21.6cm !important;
      height: 17cm !important;
      position: relative !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .background-image {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      z-index: -1 !important;
    }
  }
  body {
    width: 21.6cm;
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
  }
  .print-container {
    width: 21.6cm;
    height: 17cm;
    position: relative;
    overflow: hidden;
  }
  .background-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }
`;

// ── Documento imprimible completo ─────────────────────────────────────────
export function buildPrintHtml(params: { title: string; pagesHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(params.title)}</title>
    <style>${PRINT_STYLES}</style>
</head>
<body>
    ${params.pagesHtml}
</body>
</html>`;
}

// ── Prepara base64s y genera el HTML de cada página por separado ──────────
export async function prepareNotePages(note: OrderNote): Promise<string[]> {
  const chunks = chunkNoteItems(note.items);

  // El fondo se recorta de antemano a la proporción de la página. Ver el
  // comentario de `imageToBase64`: es lo que hace que la captura para WhatsApp
  // salga igual que la impresión pese a que html2canvas ignora `object-fit`.
  const base64Image = await imageToBase64(notaImage, PAGE_ASPECT);
  const base64Stamp = note.isSaldada ? await imageToBase64(paidStampImage) : null;

  return chunks.map((chunk, i) =>
    buildPageHtml({
      note,
      items: chunk,
      isLastPage: i === chunks.length - 1,
      pageBreak: i > 0,
      base64Image,
      base64Stamp,
    })
  );
}

// ── Función principal para impresión ──────────────────────────────────────
export async function prepareNoteHtml(note: OrderNote): Promise<{ pagesHtml: string }> {
  const pages = await prepareNotePages(note);
  return { pagesHtml: pages.join('') };
}

// ─────────────────────────────────────────────────────────────────────────
// Captura a imagen (WhatsApp)
//
// La imagen se rasteriza en el proceso principal con `capturePage`, sobre el
// mismo documento que se manda a la impresora. Aquí sólo se arma un documento
// completo por página y se exponen sus dimensiones.
// ─────────────────────────────────────────────────────────────────────────

/** 21.6cm x 17cm a 96dpi: el tamaño exacto de la página impresa. */
export const PAGE_WIDTH_PX = 816.38;
export const PAGE_HEIGHT_PX = 642.52;

/** Un documento HTML independiente por página, listo para rasterizar. */
export function buildNoteDocumentsForCapture(title: string, pagesHtml: string[]): string[] {
  return pagesHtml.map((pageHtml, i) =>
    buildPrintHtml({
      title: pagesHtml.length > 1 ? `${title} (${i + 1}/${pagesHtml.length})` : title,
      pagesHtml: pageHtml,
    })
  );
}
