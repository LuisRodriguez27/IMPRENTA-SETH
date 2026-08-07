// Genera electron/data/catalog.ts a partir de los CSV en csv/.
// Uso: pnpm run catalog:gen  (desde la raíz del proyecto)
//
// Regenerar SOLO tiene efecto en bases de datos donde la migración v2 aún no
// se ha aplicado. Si el cliente ya tiene el catálogo cargado, un cambio en los
// CSV necesita una migración NUEVA (v3, v4...) que actualice las filas
// existentes; nunca se modifica una migración ya aplicada.
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd(); // ejecutar desde la raíz del proyecto

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function toObjects(rows) {
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

const clean = (v) => (v && v.trim() !== '' ? v.trim() : null);
const num = (v) => {
  if (!v || v.trim() === '') return 0;
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const lit = (v) => (v === null ? 'null' : JSON.stringify(v));

const products = toObjects(parseCsv(fs.readFileSync(path.join(ROOT, 'csv/products.csv'), 'utf8')));
const templates = toObjects(parseCsv(fs.readFileSync(path.join(ROOT, 'csv/product-templates.csv'), 'utf8')));

const catalogProducts = products.map((p) => ({
  csvId: parseInt(p.id, 10),
  name: p.name.trim(),
  price: num(p.price),
}));

const knownIds = new Set(catalogProducts.map((p) => p.csvId));

const catalogTemplates = templates.map((t, i) => {
  const csvProductId = parseInt(t.productId, 10);
  if (!knownIds.has(csvProductId)) {
    throw new Error(`Fila ${i + 2} de product-templates.csv apunta a productId ${t.productId}, que no existe en products.csv`);
  }
  return {
    csvProductId,
    name: t.name.trim(),
    templateSerialNumber: clean(t.template_serial_number),
    dimensions: clean(t.dimensions),
    description: clean(t.description),
    finalPrice: num(t.final_price),
    category: clean(t.category),
  };
});

const sinPrecioProd = catalogProducts.filter((p) => p.price === 0).length;
const sinPrecioTpl = catalogTemplates.filter((t) => t.finalPrice === 0).length;
const sinSerie = catalogTemplates.filter((t) => t.templateSerialNumber === null).length;

const out = `// ARCHIVO GENERADO — no editar a mano.
// Origen: csv/products.csv y csv/product-templates.csv
// Regenerar con el script de generación y volver a compilar.
//
// Resumen del catálogo:
//   productos:  ${catalogProducts.length} (${sinPrecioProd} sin precio -> 0)
//   plantillas: ${catalogTemplates.length} (${sinPrecioTpl} sin precio -> 0, ${sinSerie} sin número de serie)
//
// Este catálogo lo consume la migración v2 (seed_catalogo_shiny_trodat).
// products.price y product_templates.final_price son NOT NULL, por eso los
// valores vacíos del CSV entran como 0 y se capturan después desde la app.

export interface CatalogProduct {
  /** id original en products.csv, usado para ligar las plantillas */
  csvId: number;
  name: string;
  price: number;
}

export interface CatalogTemplate {
  /** referencia a CatalogProduct.csvId, no al id real de la BD */
  csvProductId: number;
  name: string;
  templateSerialNumber: string | null;
  dimensions: string | null;
  description: string | null;
  finalPrice: number;
  category: string | null;
}

export const CATALOG_PRODUCTS: CatalogProduct[] = [
${catalogProducts.map((p) => `  { csvId: ${p.csvId}, name: ${lit(p.name)}, price: ${p.price} },`).join('\n')}
];

export const CATALOG_TEMPLATES: CatalogTemplate[] = [
${catalogTemplates.map((t) => `  { csvProductId: ${t.csvProductId}, name: ${lit(t.name)}, templateSerialNumber: ${lit(t.templateSerialNumber)}, dimensions: ${lit(t.dimensions)}, description: ${lit(t.description)}, finalPrice: ${t.finalPrice}, category: ${lit(t.category)} },`).join('\n')}
];
`;

const dest = path.join(ROOT, 'electron/data/catalog.ts');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, 'utf8');
console.log(`Escrito ${dest}`);
console.log(`  productos:  ${catalogProducts.length} (${sinPrecioProd} sin precio)`);
console.log(`  plantillas: ${catalogTemplates.length} (${sinPrecioTpl} sin precio, ${sinSerie} sin serie)`);
