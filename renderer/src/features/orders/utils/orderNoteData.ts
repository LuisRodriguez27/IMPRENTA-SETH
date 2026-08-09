import { getOrderItemType, getOrderItemDisplayName, getOrderItemDescription } from '../types';
import { formatDateMX, formatDateOnlyMX } from '@/utils/dateUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Modelo único de la nota.
//
// Tanto las órdenes normales como las órdenes rápidas se imprimen sobre el mismo
// formato físico, así que comparten posiciones y plantilla. Lo único que cambia
// son los datos: aquí se normalizan a `OrderNote` con un adaptador por tipo, y
// de ahí salen las tres salidas, todas sobre las mismas posiciones:
//   • Vista previa    → components/OrderNotePage.tsx
//   • Impresión       → utils/buildOrderPageHtml.ts
//   • Imagen WhatsApp → hooks/useWhatsAppOrder.tsx (captura ese mismo HTML)
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

// ── Paleta de la nota ─────────────────────────────────────────────────────
// Equivalentes sRGB exactos de los tokens de Tailwind v4 que usa la vista
// previa. Se guardan en hex y no en oklch() a propósito, para que cualquier
// rasterizador los entienda: hay librerías de captura que no parsean oklch.
export const NOTE_COLORS = {
	black: '#000',
	white: '#fff',
	/** text-red-600 — folio, saldo y sello de precio especial */
	red600: '#e7000b',
	/** text-red-800 — descripción de la orden */
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

export interface OrderNote {
	/** Se imprime como "No. {folio}" */
	folio: string;
	date: string;
	estimatedDeliveryDate: string | null;
	clientName: string;
	clientPhone: string;
	clientColor: string | null;
	/** Línea completa, ya redactada */
	attendedByLine: string;
	/** Línea completa, ya redactada; vacía si no hay pagos */
	paymentLine: string;
	description: string;
	items: NoteItem[];
	totalPagos: number;
	saldoPendiente: number;
	total: number;
	/** Si false, el recuadro de pagos va vacío */
	showPagos: boolean;
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

// ── Adaptador: orden normal ───────────────────────────────────────────────
export function orderToNote(
	orderData: any,
	productsData: any[],
	paymentsData: any[]
): OrderNote {
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
		folio: `${orderData.id}`,
		date: orderData.date,
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
		totalPagos,
		saldoPendiente,
		total: orderData.total,
		showPagos: paymentsData.length > 0,
		isSaldada: saldoPendiente <= 0.01,
		hasPreferentialPrice,
	};
}

// ── Adaptador: orden rápida ───────────────────────────────────────────────
// Es una orden de un solo concepto: sin fecha de entrega, sin color de cliente,
// sin descripción y sin sellos. El teléfono va concatenado al nombre.
export function simpleOrderToNote(orderData: any): OrderNote {
	const paymentsData = orderData.payments || [];
	const totalPagos = paymentsData.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
	const saldoPendiente = Math.max(0, orderData.total - totalPagos);

	const clientName = `${orderData.client_name || 'Cliente de Mostrador'}${orderData.client_phone ? ` - ${orderData.client_phone}` : ''}`;

	return {
		folio: `R-${orderData.id}`,
		date: orderData.date,
		estimatedDeliveryDate: null,
		clientName,
		clientPhone: '',
		clientColor: null,
		attendedByLine: `LE ATENDIÓ ${orderData.user?.username || ''}`,
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
		totalPagos,
		saldoPendiente,
		total: orderData.total,
		showPagos: paymentsData.length > 0,
		// Las órdenes rápidas no llevan sellos.
		isSaldada: false,
		hasPreferentialPrice: false,
	};
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
