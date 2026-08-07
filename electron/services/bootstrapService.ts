// Configuración inicial de una instalación nueva.
//
// En una BD recién creada no existe ningún usuario, así que nadie puede
// iniciar sesión. La app detecta esa condición y muestra la pantalla de
// configuración inicial en lugar del login.
//
// Al crear ese primer usuario, en una sola transacción:
//   1. se guarda el usuario,
//   2. se le asignan TODOS los permisos (es el administrador del sistema),
//   3. se siembra el catálogo de productos, quedando él como autor.
//
// Si cualquier paso falla, se revierte todo y la app vuelve a pedir la
// configuración inicial: nunca queda a medias.

import * as bcrypt from 'bcryptjs';
import db from '../db';
import { CATALOG_PRODUCTS, CATALOG_TEMPLATES } from '../data/catalog';

const SALT_ROUNDS = 10;

// Lote de inserción de plantillas. 7 columnas x 100 filas = 700 parámetros,
// dentro del límite tanto de SQLite como de Postgres.
const BATCH_SIZE = 100;

/**
 * Error cuyo mensaje es seguro de mostrar en pantalla.
 * Todo lo demás (errores de SQL, del driver) se registra en el log y al
 * usuario se le da un mensaje genérico: knex incluye la consulta completa
 * en el mensaje, y volcarle mil líneas de SQL no le sirve de nada.
 */
class BootstrapError extends Error {}

export interface CreateFirstUserData {
  username: string;
  password: string;
}

export interface BootstrapResult {
  success: boolean;
  message: string;
  permissions?: number;
  products?: number;
  templates?: number;
}

async function countUsers(): Promise<number> {
  const row = await db.getOne<{ total: number | string }>('SELECT COUNT(*) AS total FROM users');
  return Number(row?.total ?? 0);
}

/**
 * Inserta el catálogo de productos y sus plantillas, atribuyéndolos a `userId`.
 * Debe llamarse dentro de una transacción.
 */
async function seedCatalog(userId: number): Promise<{ products: number; templates: number }> {
  // El id lo asigna la BD; se captura del INSERT porque products.name se
  // repite en el catálogo de origen (COJINES DE REPUESTO aparece dos veces,
  // con plantillas distintas) y no serviría para volver a localizarlos.
  const idByCsvId = new Map<number, number>();

  for (const product of CATALOG_PRODUCTS) {
    const result = await db.execute(
      `INSERT INTO products (name, price, stock) VALUES ($1, $2, $3)`,
      [product.name, product.price, 0]
    );
    const realId = Number(result.lastInsertRowid);

    if (!Number.isInteger(realId) || realId <= 0) {
      throw new Error(`No se pudo obtener el id del producto "${product.name}" tras insertarlo`);
    }
    idByCsvId.set(product.csvId, realId);
  }

  // Plantillas por lotes: ~990 filas de una en una alargan la espera sin
  // necesidad. Se omiten active y package para que apliquen los DEFAULT.
  for (let i = 0; i < CATALOG_TEMPLATES.length; i += BATCH_SIZE) {
    const batch = CATALOG_TEMPLATES.slice(i, i + BATCH_SIZE);
    const params: unknown[] = [];

    const tuples = batch.map((tpl) => {
      const productId = idByCsvId.get(tpl.csvProductId);
      if (!productId) {
        throw new Error(`La plantilla "${tpl.name}" apunta al producto ${tpl.csvProductId}, que no se sembró`);
      }
      const base = params.length;
      params.push(
        productId,
        tpl.name,
        tpl.templateSerialNumber,
        tpl.dimensions,
        tpl.description,
        tpl.finalPrice,
        tpl.category,
        userId
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    });

    await db.execute(
      `INSERT INTO product_templates
         (product_id, name, template_serial_number, dimensions, description, final_price, category, created_by)
       VALUES ${tuples.join(', ')}`,
      params
    );
  }

  return { products: CATALOG_PRODUCTS.length, templates: CATALOG_TEMPLATES.length };
}

class BootstrapService {
  /** true cuando la instalación todavía no tiene ningún usuario. */
  async isRequired(): Promise<boolean> {
    try {
      return (await countUsers()) === 0;
    } catch (error) {
      console.error('Error al verificar si hace falta la configuración inicial:', error);
      // Ante la duda no se muestra la pantalla de configuración: es preferible
      // que el usuario vea el login a que se ofrezca crear un administrador
      // sobre una BD que sí tiene usuarios.
      return false;
    }
  }

  async createFirstUser(data: CreateFirstUserData): Promise<BootstrapResult> {
    try {
      const username = typeof data?.username === 'string' ? data.username.trim() : '';
      const password = typeof data?.password === 'string' ? data.password : '';

      if (username.length < 3) {
        throw new BootstrapError('El nombre de usuario debe tener al menos 3 caracteres');
      }
      if (password.length < 6) {
        throw new BootstrapError('La contraseña debe tener al menos 6 caracteres');
      }

      // Candado real: aunque la pantalla solo se muestra sin usuarios, este
      // handler no puede crear un administrador con todos los permisos en una
      // instalación que ya está en uso.
      if ((await countUsers()) > 0) {
        throw new BootstrapError('La configuración inicial ya se completó en esta instalación');
      }

      const permissions = await db.getAll<{ id: number }>('SELECT id FROM permissions');
      if (permissions.length === 0) {
        throw new BootstrapError('No hay permisos registrados: la base de datos no se inicializó correctamente');
      }

      const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

      const run = db.transaction(async () => {
        const userResult = await db.execute(
          `INSERT INTO users (username, password) VALUES ($1, $2)`,
          [username, passwordHash]
        );
        const userId = Number(userResult.lastInsertRowid);

        if (!Number.isInteger(userId) || userId <= 0) {
          throw new Error('No se pudo obtener el id del usuario tras crearlo');
        }

        for (const permission of permissions) {
          await db.execute(
            `INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2)`,
            [userId, permission.id]
          );
        }

        const catalog = await seedCatalog(userId);
        return { userId, catalog };
      });

      const { catalog } = await run();

      console.log(
        `Configuración inicial completada: usuario "${username}", ` +
        `${permissions.length} permisos, ${catalog.products} productos, ${catalog.templates} plantillas.`
      );

      return {
        success: true,
        message: 'Configuración inicial completada',
        permissions: permissions.length,
        products: catalog.products,
        templates: catalog.templates,
      };
    } catch (error) {
      console.error('Error en la configuración inicial:', error);
      return {
        success: false,
        message: error instanceof BootstrapError
          ? error.message
          : 'No se pudo completar la configuración inicial. No se guardó nada; vuelve a intentarlo.',
      };
    }
  }
}

export default new BootstrapService();
