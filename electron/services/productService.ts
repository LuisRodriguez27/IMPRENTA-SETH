import productRepository from '../repositories/productRepository';
import SimilarProductNames from '../domain/similarProductNames';
import type { ProductData } from '../types/product';
import db from '../db';
import cashSessionRepository from '../repositories/cashSessionRepository';
import expensesRepository from '../repositories/expensesRepository';


class ProductService {
  async getAllProducts() {
    try {
      const products = await productRepository.findAll();
      return products.map((p) => p.toPlainObject());
    } catch (error) {
      console.error('Error al obtener productos:', error);
      throw new Error('Error al obtener productos');
    }
  }

  async getProductById(id: number) {
    try {
      if (!id || isNaN(Number(id))) throw new Error('ID de producto inválido');
      const product = await productRepository.findById(id);
      if (!product) throw new Error('Producto no encontrado');
      return product.toPlainObject();
    } catch (error) {
      console.error('Error al obtener producto:', error);
      throw error;
    }
  }

  async createProduct({ name, serial_number, price, promo_price, discount_price, purchase_price, description, images }: ProductData) {
    try {
      if (!name) throw new Error('El nombre del producto es requerido');
      if (name.trim().length < 1) throw new Error('El nombre del producto no puede estar vacío');
      if (price === undefined || price === null || isNaN(Number(price))) throw new Error('El precio es requerido y debe ser un número válido');

      const numericPrice = parseFloat(String(price));
      if (numericPrice < 0) throw new Error('El precio debe ser mayor o igual a cero');
      if (serial_number && serial_number.trim() !== '') {
        if (await productRepository.existsBySerialNumber(serial_number.trim())) throw new Error('Ya existe un producto con este número de serie');
      }

      const product = await productRepository.create({
        name: name.trim(), serial_number: serial_number?.trim() || null, price: numericPrice,
        promo_price: promo_price !== undefined && promo_price !== null && promo_price !== '' ? parseFloat(String(promo_price)) : null,
        discount_price: discount_price !== undefined && discount_price !== null && discount_price !== '' ? parseFloat(String(discount_price)) : null,
        purchase_price: purchase_price !== undefined && purchase_price !== null && purchase_price !== '' ? parseFloat(String(purchase_price)) : null,
        description: description?.trim() || null, images: Array.isArray(images) ? images : []
      });
      return product.toPlainObject();
    } catch (error) {
      console.error('Error al crear producto:', error);
      throw error;
    }
  }

  async updateProduct(id: number, { name, serial_number, price, promo_price, discount_price, purchase_price, description, images, stock }: ProductData) {
    try {
      if (!id || isNaN(Number(id))) throw new Error('ID de producto inválido');
      if (!name) throw new Error('El nombre del producto es requerido');
      if (name.trim().length < 1) throw new Error('El nombre del producto no puede estar vacío');

      const productId = id;
      const existingProduct = await productRepository.findById(productId);
      if (!existingProduct) throw new Error('Producto no encontrado');
      if (price === undefined || price === null || isNaN(Number(price))) throw new Error('El precio es requerido y debe ser un número válido');

      const numericPrice = parseFloat(String(price));
      if (numericPrice < 0) throw new Error('El precio debe ser mayor o igual a cero');
      if (serial_number && serial_number.trim() !== '') {
        if (await productRepository.existsBySerialNumber(serial_number.trim(), productId)) throw new Error('Ya existe otro producto con este número de serie');
      }

      const finalStock = (stock !== undefined && stock !== null && stock !== '') 
        ? parseFloat(String(stock)) 
        : existingProduct.stock;

      const updated = await productRepository.update(productId, {
        name: name.trim(), serial_number: serial_number?.trim() || null, price: numericPrice,
        promo_price: promo_price !== undefined && promo_price !== null && promo_price !== '' ? parseFloat(String(promo_price)) : null,
        discount_price: discount_price !== undefined && discount_price !== null && discount_price !== '' ? parseFloat(String(discount_price)) : null,
        purchase_price: purchase_price !== undefined && purchase_price !== null && purchase_price !== '' ? parseFloat(String(purchase_price)) : null,
        description: description?.trim() || null, images: Array.isArray(images) ? images : [],
        stock: finalStock
      });
      if (!updated) throw new Error('Error al actualizar producto');

      const updatedProduct = await productRepository.findById(productId);
      if (!updatedProduct) throw new Error('Error: no se pudo recuperar el producto actualizado');

      const result = updatedProduct.toPlainObject();
      if (!result.id || !result.name) { console.error('Producto actualizado inválido:', result); throw new Error('Datos del producto actualizado inválidos'); }
      return result;
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      throw error;
    }
  }

  async deleteProduct(id: number) {
    try {
      if (!id || isNaN(Number(id))) throw new Error('ID de producto inválido');
      const productId = id;
      const existingProduct = await productRepository.findById(productId);
      if (!existingProduct) throw new Error('Producto no encontrado');
      const deleted = await productRepository.delete(productId);
      if (!deleted) throw new Error('Error al eliminar producto');
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      throw error;
    }
  }

  async searchProducts(searchTerm: string) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) return this.getAllProducts();
      const products = await productRepository.searchByTerm(searchTerm.trim());
      return products.map((p) => p.toPlainObject());
    } catch (error) {
      console.error('Error al buscar productos:', error);
      throw new Error('Error al buscar productos');
    }
  }

  async searchProductsWithTemplates(searchTerm: string) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) return this.getAllProductsWithTemplates();
      return await productRepository.searchWithTemplates(searchTerm.trim());
    } catch (error) {
      console.error('Error al buscar productos con plantillas:', error);
      throw new Error('Error al buscar productos con plantillas');
    }
  }

  async getProductsCount(): Promise<number> {
    try {
      return await productRepository.countActiveProducts();
    } catch (error) {
      console.error('Error al contar productos:', error);
      throw new Error('Error al contar productos');
    }
  }

  async getProductWithTemplates(productId: number) {
    try {
      if (!productId) throw new Error('ID de producto inválido');
      const productWithTemplates = await productRepository.findWithTemplates(productId);
      if (!productWithTemplates) throw new Error('Producto no encontrado');
      return productWithTemplates;
    } catch (error) {
      console.error('Error al obtener producto con plantillas:', error);
      throw error;
    }
  }

  async getAllProductsWithTemplates() {
    try {
      return await productRepository.findAllWithTemplates();
    } catch (error) {
      console.error('Error al obtener productos con plantillas:', error);
      throw new Error('Error al obtener productos con plantillas');
    }
  }

  async getProductsByPriceRange(minPrice: number, maxPrice: number) {
    try {
      if (isNaN(minPrice) || isNaN(maxPrice)) throw new Error('Los precios deben ser números válidos');
      if (minPrice < 0 || maxPrice < 0) throw new Error('Los precios deben ser mayores o iguales a cero');
      if (minPrice > maxPrice) throw new Error('El precio mínimo no puede ser mayor al precio máximo');
      const products = await productRepository.findByPriceRange(minPrice, maxPrice);
      return products.map((p) => p.toPlainObject());
    } catch (error) {
      console.error('Error al obtener productos por rango de precio:', error);
      throw error;
    }
  }

  async getMostUsedProducts(limit = 10) {
    try {
      if (isNaN(limit) || limit < 1) limit = 10;
      const products = await productRepository.findMostUsed(limit);
      return products.map((p) => p.toPlainObject());
    } catch (error) {
      console.error('Error al obtener productos más utilizados:', error);
      throw new Error('Error al obtener productos más utilizados');
    }
  }

  async getProductsWithSimilarNames() {
    try {
      const products = await productRepository.findAll();
      const plainProducts = products.map((p) => p.toPlainObject()) as Array<{ id: number; name: string; serial_number: string }>;

      const wordGroups: Record<string, Array<{ id: number; name: string; serial_number: string }>> = {};
      const sanitizeWord = (word: string) => word.toLowerCase().replace(/[.,:;()\-]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ignoredWords = ['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'para', 'con', 'por', 'a', 'al', 'del', 'sin', 'sus', 'tu', 'su'];

      plainProducts.forEach(product => {
        if (!product.name) return;
        const words = product.name.split(/\s+/);
        const uniqueWords = new Set(words.map(sanitizeWord).filter(w => w.length > 2 && !ignoredWords.includes(w)));
        uniqueWords.forEach(word => {
          if (!wordGroups[word]) wordGroups[word] = [];
          wordGroups[word].push({ id: product.id, name: product.name, serial_number: product.serial_number });
        });
      });

      const result: InstanceType<typeof SimilarProductNames>[] = [];
      Object.keys(wordGroups).forEach(word => {
        if (wordGroups[word].length > 1) {
          result.push(new SimilarProductNames({ word, count: wordGroups[word].length, products: wordGroups[word] }));
        }
      });

      result.sort((a, b) => (b.count as number) - (a.count as number));
      return result.map(item => item.toPlainObject());
    } catch (error) {
      console.error('Error al obtener nombres similares:', error);
      throw new Error('Error al obtener nombres similares');
    }
  }

  async getProductsPaginated(page = 1, limit = 10, searchTerm = '') {
    try {
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 10;
      const result = await productRepository.findPaginatedWithTemplates(page, limit, searchTerm);
      return { data: result.data, pagination: result.pagination, searchTerm: result.searchTerm };
    } catch (error) {
      console.error('Error al obtener productos paginados:', error);
      throw new Error('Error al obtener productos paginados');
    }
  }



  async addStock(productId: number, data: { quantity: number; cost: number; description?: string; userId: number }) {
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
        const updated = await productRepository.incrementStock(productId, data.quantity);
        if (!updated) {
          throw new Error('No se pudo actualizar el stock del producto.');
        }

        // 2. Obtener producto para su nombre
        const product = await productRepository.findById(productId);
        if (!product) {
          throw new Error('Producto no encontrado.');
        }

        // 3. Crear el gasto si el costo es mayor a 0
        if (data.cost > 0) {
          const defaultDesc = `Adición de stock: +${data.quantity} pzas de ${product.name}`;
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

        return product.toPlainObject();
      })();

      return result;
    } catch (error) {
      console.error('Error al agregar stock de producto:', error);
      throw error;
    }
  }
}


export default new ProductService();
