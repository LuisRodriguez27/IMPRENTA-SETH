import React from 'react';
import paidStampImage from '@/assets/SELLO-PAGADO.png';
import ClientColorIndicator from '../clients/components/ClientColorIndicator';
import type { ClientColor } from '../clients/types';
import {
  getDay,
  getMonth,
  getYear,
  getHours,
  getDayUTC,
  getMonthUTC,
  getYearUTC,
  money,
  type Note,
  type NoteItem,
} from './noteData';

interface NotePageProps {
  note: Note;
  items: NoteItem[];
  isLastPage: boolean;
}

/**
 * Una página de la nota, tal como se imprime.
 *
 * El lienzo mide 816 x 642.5px, exactamente lo mismo que la página impresa
 * (21.6cm x 17cm a 96dpi con root font-size 16px). Gracias a eso 1px de aquí
 * equivale a 1px del papel y las posiciones se trasladan sin conversión a
 * `buildNoteHtml.ts`, donde cada campo lleva anotada su clase Tailwind.
 *
 * Si mueves un campo aquí, muévelo también allá.
 */
const NotePage: React.FC<NotePageProps> = ({ note, items, isLastPage }) => {
  return (
    <div
      className="relative border border-gray-300 shadow-lg bg-cover bg-center bg-no-repeat"
      style={{
        width: '816px',
        height: '642.5px',
        backgroundImage: `url(${note.background})`,
      }}
    >
      {/* Sello de precio especial */}
      {note.hasPreferentialPrice && (
        <div
          className="absolute bottom-8 right-10 w-26 bg-red-600 text-white font-bold text-center p-1.5 select-none"
          style={{ zIndex: 10, fontSize: '0.65rem', lineHeight: '1.2' }}
        >
          USTED HA ADQUIRIDO UN PRECIO ESPECIAL
        </div>
      )}

      {/* Sello de saldada */}
      {note.isSaldada && (
        <img
          src={paidStampImage}
          alt="Saldada"
          className="absolute bottom-22 right-36"
          style={{ width: '7rem', height: 'auto', zIndex: 10, opacity: 0.9, transform: 'rotate(25deg)' }}
        />
      )}

      {/* Fecha de recibo */}
      <div
        className="absolute top-13 left-138 text-right text-sm font-bold text-black"
        style={{ width: '110px' }}
      >
        <div className="flex gap-4">
          <span>{getDay(note.date)}</span>
          <span>{getMonth(note.date)}</span>
          <span>{getYear(note.date)}</span>
        </div>
      </div>

      {/* Fecha de entrega */}
      {note.estimatedDeliveryDate && (
        <div
          className="absolute top-13 left-169 text-right text-sm font-bold text-black"
          style={{ width: '100px' }}
        >
          <div className="flex gap-5">
            <span>{getDayUTC(note.estimatedDeliveryDate)}</span>
            <span>{getMonthUTC(note.estimatedDeliveryDate)}</span>
            <span>{getYearUTC(note.estimatedDeliveryDate)}</span>
          </div>
        </div>
      )}

      {/* Hora */}
      {note.showTime && (
        <div className="absolute top-32 right-55">
          {getHours(note.date)}
        </div>
      )}

      {/* Cliente */}
      <div className="absolute top-32 left-25 w-[288px] text-xl font-bold text-black flex items-center gap-2">
        {note.clientColor && (
          <ClientColorIndicator color={note.clientColor as ClientColor} size="md" />
        )}
        <span className="truncate" style={{ fontSize: 'calc(1em - 2px)' }}>
          {note.clientName}
        </span>
      </div>

      {/* Teléfono — el `truncate` va en el span y no en el contenedor, igual que
          en el HTML de impresión, para que ambos midan lo mismo. */}
      {note.clientPhone && (
        <div className="absolute top-32 left-[620px] w-[152px] text-xl font-bold text-black">
          <span className="block truncate">{note.clientPhone}</span>
        </div>
      )}

      {/* Productos — `bottom-40` + `overflow-hidden` recortan la tabla para que
          no se derrame sobre la zona de totales. */}
      <div className="absolute top-42 left-6 right-6 bottom-40 overflow-hidden text-black">
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 mb-2 text-base py-1">
            <div className="col-span-1 text-center">{item.quantity}</div>
            <div className="col-span-8 pl-1">
              <div className={`font-medium${item.preserveLineBreaks ? ' whitespace-pre-wrap' : ''}`}>
                {item.name}
              </div>
              {item.description && (
                <div className="text-sm text-gray-700 -mt-2 leading-tight">
                  {item.description}
                </div>
              )}
            </div>
            <div className="col-span-1 text-right font-medium ml-6">
              ${money(item.unitPrice)}
            </div>
            <div className="col-span-2 text-right font-medium">
              ${money(item.totalPrice)}
            </div>
          </div>
        ))}
      </div>

      {/* Descripción */}
      {isLastPage && note.description && (
        <div className="absolute bottom-37 left-20 right-10 text-sm text-red-800 p-2 rounded">
          <div className="line-clamp-4 break-words">
            {note.description}
          </div>
        </div>
      )}

      {/* Folio */}
      {note.folio && (
        <div className="absolute bottom-22 right-18 text-xl font-bold text-red-600">
          <div className="text-center">No. {note.folio}</div>
        </div>
      )}

      {/* Le atendió */}
      {note.attendedByLine && (
        <div className="absolute bottom-28 left-6">
          <div className="text-blue-900 font-bold">{note.attendedByLine}</div>
        </div>
      )}

      {/* Método de pago */}
      {note.paymentLine && (
        <div className="absolute bottom-29 left-90">
          <div>{note.paymentLine}</div>
        </div>
      )}

      {/* Anticipo y resta */}
      {note.payments && (
        <>
          <div className="absolute bottom-16 left-43 w-33 h-8 flex items-center justify-center text-green-700 font-bold text-xl">
            {note.payments.hasPayments ? `$${money(note.payments.paid)}` : ''}
          </div>
          <div className="absolute bottom-16 left-80 w-33 h-8 flex items-center justify-center text-red-600 font-bold text-xl">
            ${money(note.payments.balance)}
          </div>
        </>
      )}

      {/* Total */}
      {note.totalLabel ? (
        <div className="absolute bottom-16 left-116 w-33 h-8 flex flex-col items-center justify-center font-bold text-red-600 border-2 border-red-600 bg-white box-border">
          <div style={{ fontSize: '0.625rem', lineHeight: 1 }}>{note.totalLabel}</div>
          <div style={{ fontSize: '1.125rem', lineHeight: 1.2 }}>${money(note.total)}</div>
        </div>
      ) : (
        <div className="absolute bottom-16 left-116 w-33 h-8 flex items-center justify-center text-black font-bold text-xl">
          ${money(note.total)}
        </div>
      )}
    </div>
  );
};

export default NotePage;
