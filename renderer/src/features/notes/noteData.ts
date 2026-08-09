import { formatDateMX, formatDateOnlyMX } from '@/utils/dateUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Modelo único de la nota.
//
// Órdenes, órdenes rápidas y cotizaciones se imprimen sobre el mismo formato
// físico (21.6cm x 17cm): mismo encabezado, misma fila de CLIENTE, misma tabla y
// el mismo bloque de horario. Lo único que cambia es la imagen de fondo y qué
// campos aplican.
//
// Cada feature aporta su adaptador (`orderToNote`, `simpleOrderToNote`,
// `budgetToNote`) y de ahí salen las tres salidas, todas con las mismas
// posiciones:
//   • Vista previa    → NotePage.tsx
//   • Impresión       → buildNoteHtml.ts
//   • Imagen WhatsApp → useNoteWhatsApp.tsx (rasteriza ese mismo HTML)
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers de fecha ──────────────────────────────────────────────────────
export const getDay = (d: string) => formatDateMX(d, 'DD');
export const getMonth = (d: string) => formatDateMX(d, 'MM');
export const getYear = (d: string) => formatDateMX(d, 'YYYY');
export const getHours = (d: string) => formatDateMX(d, 'HH:mm');
// Para estimated_delivery_date (UTC midnight) – no aplicar offset de timezone
export const getDayUTC = (d: string) => formatDateOnlyMX(d, 'DD');
export const getMonthUTC = (d: string) => formatDateOnlyMX(d, 'MM');
export const getYearUTC = (d: string) => formatDateOnlyMX(d, 'YYYY');

// ── Formato de moneda (sin símbolo) ───────────────────────────────────────
export const money = (n: number) =>
	n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Paleta ────────────────────────────────────────────────────────────────
// Equivalentes sRGB exactos de los tokens de Tailwind v4 que usa la vista
// previa. Se guardan en hex y no en oklch() a propósito, para que cualquier
// rasterizador los entienda: hay librerías de captura que no parsean oklch.
export const NOTE_COLORS = {
	black: '#000',
	white: '#fff',
	/** text-red-600 — folio, saldo y sello de precio especial */
	red600: '#e7000b',
	/** text-red-800 — descripción */
	red800: '#9f0712',
	/** text-green-700 — monto pagado */
	green700: '#008236',
	/** text-blue-900 — "LE ATENDIÓ" */
	blue900: '#1c398e',
	/** text-gray-700 — descripción del producto */
	gray700: '#364153',
} as const;

// ── Color del indicador del cliente ───────────────────────────────────────
// Equivalente a <ClientColorIndicator>: devuelve el color sólo si es uno de los
// tres conocidos; si no, null y no se dibuja el círculo (igual que el componente,
// que retorna null cuando el color no está en CLIENT_COLORS).
export const clientColorHex = (color?: string | null): string | null =>
	color === 'green' ? '#00c950' :   // bg-green-500
		color === 'yellow' ? '#f0b100' :  // bg-yellow-500
			color === 'red' ? '#fb2c36' : // bg-red-500
				null;

// ── Modelo normalizado ────────────────────────────────────────────────────
export interface NoteItem {
	quantity: number | string;
	name: string;
	description: string;
	unitPrice: number;
	totalPrice: number;
	/** Respeta los saltos de línea del nombre (concepto de orden rápida). */
	preserveLineBreaks?: boolean;
}

/** Recuadros de anticipo y resta. `null` en formatos que no los llevan. */
export interface NotePayments {
	paid: number;
	balance: number;
	/** Si false, el recuadro del anticipo va vacío. */
	hasPayments: boolean;
}

export interface Note {
	/** Imagen del formato: nota u hoja de cotización. */
	background: string;
	/** Se imprime como "No. {folio}". Vacío no dibuja nada. */
	folio: string;
	date: string;
	/** La nota lleva hora junto al cliente; la cotización no. */
	showTime: boolean;
	estimatedDeliveryDate: string | null;
	clientName: string;
	/** Vacío no dibuja nada. */
	clientPhone: string;
	clientColor: string | null;
	/** Línea ya redactada. Vacía no dibuja nada. */
	attendedByLine: string;
	/** Línea ya redactada. Vacía no dibuja nada. */
	paymentLine: string;
	/** Vacía no dibuja nada. */
	description: string;
	items: NoteItem[];
	/** `null` en formatos sin recuadros de anticipo y resta. */
	payments: NotePayments | null;
	total: number;
	/**
	 * Cuando viene, el total se dibuja dentro de un recuadro con esta etiqueta.
	 * Lo usa la cotización, cuyo formato no trae el recuadro impreso.
	 */
	totalLabel: string | null;
	isSaldada: boolean;
	hasPreferentialPrice: boolean;
}

// ── Paginado ──────────────────────────────────────────────────────────────
export const ITEMS_PER_PAGE = 5;

export function chunkNoteItems(items: NoteItem[], itemsPerPage: number = ITEMS_PER_PAGE): NoteItem[][] {
	const chunks: NoteItem[][] = [];
	for (let i = 0; i < items.length; i += itemsPerPage) {
		chunks.push(items.slice(i, i + itemsPerPage));
	}
	if (chunks.length === 0) chunks.push([]);
	return chunks;
}

// ── Convierte una URL de imagen local a base64 ────────────────────────────
//
// `cropToAspect` recorta la imagen al centro para dejarla con esa proporción,
// es decir, hace por adelantado lo que haría `object-fit: cover`.
//
// Con el fondo ya recortado a la proporción de la página, estirar y "cover" dan
// el mismo resultado, así que el encuadre deja de depender de si quien rasteriza
// implementa `object-fit` o no. También aligera el base64.
export const imageToBase64 = (url: string, cropToAspect?: number): Promise<string> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			const nw = img.naturalWidth || img.width;
			const nh = img.naturalHeight || img.height;

			let sx = 0, sy = 0, sw = nw, sh = nh;
			if (cropToAspect && cropToAspect > 0) {
				if (nw / nh > cropToAspect) {
					sw = nh * cropToAspect;
					sx = (nw - sw) / 2;
				} else {
					sh = nw / cropToAspect;
					sy = (nh - sh) / 2;
				}
			}

			const canvas = document.createElement('canvas');
			canvas.width = Math.round(sw);
			canvas.height = Math.round(sh);
			canvas.getContext('2d')?.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = reject;
		img.src = url;
	});
