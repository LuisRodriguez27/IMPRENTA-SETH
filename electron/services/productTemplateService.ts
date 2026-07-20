import productTemplateRepository from '../repositories/productTemplateRepository';
import productRepository from '../repositories/productRepository';
import type { TemplateData } from '../types/productTemplate';
import db from '../db';
import cashSessionRepository from '../repositories/cashSessionRepository';
import expensesRepository from '../repositories/expensesRepository';


class ProductTemplateService {
  async getAllTemplates() {
    try {
      const templates = await productTemplateRepository.findAll();
      return templates.map((t) => t.toPlainObject());
    } catch (error) {
      console.error('Error al obtener plantillas:', error);
      throw new Error('Error al obtener plantillas');
    }
  }

  async getTemplateById(id: number) {
    try {
      if (!id || isNaN(Number(id))) throw new Error('ID de plantilla inválido');
      const template = await productTemplateRepository.findById(id);
      if (!template) throw new Error('Plantilla no encontrada');
      return template.toPlainObject();
    } catch (error) {
      console.error('Error al obtener plantilla:', error);
      throw error;
    }
  }

  async getTemplatesByProductId(productId: number) {
    try {
      if (!productId || isNaN(Number(productId))) throw new Error('ID de producto inválido');
      const templates = await productTemplateRepository.findByProductId(productId);
      return templates.map((t) => t.toPlainObject());
    } catch (error) {
      console.error('Error al obtener plantillas del producto:', error);
      throw error;
    }
  }

  async createTemplate(data: TemplateData) {
    try {
      const productId = data.productId !== undefined ? data.productId : data.product_id;
      if (!productId || isNaN(Number(productId))) throw new Error('ID de producto inválido');
      if (data.final_price === undefined || data.final_price === null || isNaN(Number(data.final_price))) throw new Error('El precio final es requerido y debe ser un número válido');

      const numericFinalPrice = parseFloat(String(data.final_price));
      if (numericFinalPrice < 0) throw new Error('El precio final debe ser mayor o igual a cero');

      const product = await productRepository.findById(parseInt(String(productId)));
      if (!product) throw new Error('El producto especificado no existe');

      const dimensions = data.dimensions;
      const pzas = data.piecesPerPack !== undefined ? data.piecesPerPack : data.pieces_per_pack;

      const template = await productTemplateRepository.create({
        product_id: parseInt(String(productId)),
        name: data.name?.trim() || null,
        final_price: numericFinalPrice,
        promo_price: data.promo_price !== undefined ? (data.promo_price !== null ? parseFloat(String(data.promo_price)) : null) : null,
        purchase_price: data.purchase_price !== undefined ? (data.purchase_price !== null && data.purchase_price !== '' ? parseFloat(String(data.purchase_price)) : null) : null,
        dimensions: dimensions ? String(dimensions).trim() : '',
        category: data.category ? String(data.category).trim() : '',
        model: data.model ? String(data.model).trim() : '',
        package: data.package === true || data.package === 1 || String(data.package) === 'true',
        piecesPerPack: pzas !== undefined && pzas !== null ? parseInt(String(pzas), 10) : null,
        description: data.description?.trim() || null,
        template_serial_number: data.template_serial_number?.trim() || null,
        created_by: data.created_by ? parseInt(String(data.created_by)) : null
      });
      if (!template) throw new Error('Error al crear plantilla');
      return template.toPlainObject();
    } catch (error) {
      console.error('Error al crear plantilla:', error);
      throw error;
    }
  }

  async updateTemplate(id: number, data: Omit<TemplateData, 'created_by'>) {
    try {
      if (!id || isNaN(Number(id))) throw new Error('ID de plantilla inválido');
      const productId = data.productId !== undefined ? data.productId : data.product_id;
      if (!productId || isNaN(Number(productId))) throw new Error('ID de producto inválido');
      if (data.final_price === undefined || data.final_price === null || isNaN(Number(data.final_price))) throw new Error('El precio final es requerido y debe ser un número válido');

      const templateId = id;
      const existingTemplate = await productTemplateRepository.findById(templateId);
      if (!existingTemplate) throw new Error('Plantilla no encontrada');

      const product = await productRepository.findById(parseInt(String(productId)));
      if (!product) throw new Error('El producto especificado no existe');

      const numericFinalPrice = parseFloat(String(data.final_price));
      if (numericFinalPrice < 0) throw new Error('El precio final debe ser mayor o igual a cero');

      const dimensions = data.dimensions;
      const pzas = data.piecesPerPack !== undefined ? data.piecesPerPack : data.pieces_per_pack;

      const finalStock = (data.stock !== undefined && data.stock !== null && data.stock !== '')
        ? parseFloat(String(data.stock))
        : existingTemplate.stock;

      const updated = await productTemplateRepository.update(templateId, {
        product_id: parseInt(String(productId)),
        name: data.name?.trim() || null,
        final_price: numericFinalPrice,
        promo_price: data.promo_price !== undefined ? (data.promo_price !== null ? parseFloat(String(data.promo_price)) : null) : null,
        purchase_price: data.purchase_price !== undefined ? (data.purchase_price !== null && data.purchase_price !== '' ? parseFloat(String(data.purchase_price)) : null) : null,
        dimensions: dimensions ? String(dimensions).trim() : '',
        category: data.category ? String(data.category).trim() : '',
        model: data.model ? String(data.model).trim() : '',
        package: data.package === true || data.package === 1 || String(data.package) === 'true',
        piecesPerPack: pzas !== undefined && pzas !== null ? parseInt(String(pzas), 10) : null,
        description: data.description?.trim() || null,
        template_serial_number: data.template_serial_number?.trim() || null,
        stock: finalStock
      });
      if (!updated) throw new Error('Error al actualizar plantilla');

      const updatedTemplate = await productTemplateRepository.findById(templateId);
      if (!updatedTemplate) throw new Error('Error: no se pudo recuperar la plantilla actualizada');

      return updatedTemplate.toPlainObject();
    } catch (error) {
      console.error('Error al actualizar plantilla:', error);
      throw error;
    }
  }

  async deleteTemplate(id: number) {
    try {
      if (!id || isNaN(Number(id))) throw new Error('ID de plantilla inválido');
      const templateId = id;
      const existingTemplate = await productTemplateRepository.findById(templateId);
      if (!existingTemplate) throw new Error('Plantilla no encontrada');
      const deleted = await productTemplateRepository.delete(templateId);
      if (!deleted) throw new Error('Error al eliminar plantilla');
    } catch (error) {
      console.error('Error al eliminar plantilla:', error);
      throw error;
    }
  }

  async searchTemplates(searchTerm: string) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) return this.getAllTemplates();
      const templates = await productTemplateRepository.searchByTerm(searchTerm.trim());
      return templates.map((t) => t.toPlainObject());
    } catch (error) {
      console.error('Error al buscar plantillas:', error);
      throw new Error('Error al buscar plantillas');
    }
  }

  async getTemplatesPaginated(page = 1, limit = 10, searchTerm = '') {
    try {
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 10;
      const result = await productTemplateRepository.findPaginated(page, limit, searchTerm);
      return { data: result.data.map((t) => t.toPlainObject()), pagination: result.pagination, searchTerm: result.searchTerm };
    } catch (error) {
      console.error('Error al obtener plantillas paginadas:', error);
      throw new Error('Error al obtener plantillas paginadas');
    }
  }


  async addStock(templateId: number, data: { quantity: number; cost: number; description?: string; userId: number }) {
    try {
      const activeSession = await cashSessionRepository.getActive();
      if (!activeSession) {
        throw new Error('No hay una sesión de caja activa. Debes abrir la caja antes de registrar gastos y stock.');
      }

      if (isNaN(data.quantity) || data.quantity <= 0) {
        throw new Error('La cantidad a agregar debe ser un número mayor a 0');
      }

      if (isNaN(data.cost) || data.cost < 0) {
        throw new Error('El costo debe ser un número mayor o igual a 0');
      }

      const result = await db.transaction(async () => {
        // 1. Incrementar stock
        const updated = await productTemplateRepository.incrementStock(templateId, data.quantity);
        if (!updated) {
          throw new Error('No se pudo actualizar el stock de la plantilla.');
        }

        // 2. Obtener plantilla para su nombre
        const template = await productTemplateRepository.findById(templateId);
        if (!template) {
          throw new Error('Plantilla no encontrada.');
        }

        // 3. Crear el gasto si el costo es mayor a 0
        if (data.cost > 0) {
          const nameToUse = template.name || template.description || `Plantilla #${template.id}`;
          const defaultDesc = `Adición de stock: +${data.quantity} pzas de la plantilla ${nameToUse}`;
          const finalDesc = data.description?.trim()
            ? `${data.description.trim()} (${defaultDesc})`
            : defaultDesc;

          await expensesRepository.create({
            cash_session_id: activeSession.id,
            user_id: data.userId,
            amount: data.cost,
            description: finalDesc,
            date: new Date().toISOString()
          });
        }

        return template.toPlainObject();
      })();

      return result;
    } catch (error) {
      console.error('Error al agregar stock de plantilla:', error);
      throw error;
    }
  }
}


export default new ProductTemplateService();
