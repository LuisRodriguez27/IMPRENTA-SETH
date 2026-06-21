import React, { useState } from 'react';
import { Package, Loader, DollarSign, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductsApiService } from '../ProductsApiService';
import { ProductTemplatesApiService } from '@/features/productTemplates/ProductTemplatesApiService';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedItem: any, type: 'product' | 'template') => void;
  item: { id: number; name: string; currentStock: number; purchasePrice?: number } | null;
  type: 'product' | 'template';
}

const AddStockModal: React.FC<AddStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  item,
  type
}) => {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && item) {
      if (item.purchasePrice !== undefined && item.purchasePrice !== null) {
        setPurchasePrice(item.purchasePrice.toString());
      } else {
        setPurchasePrice('');
      }
    }
  }, [isOpen, item]);

  const calculateAndSetCost = (qtyStr: string, priceStr: string) => {
    const qty = parseFloat(qtyStr);
    const price = parseFloat(priceStr);
    if (!isNaN(qty) && !isNaN(price)) {
      setCost((qty * price).toFixed(2));
    } else {
      setCost('');
    }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    calculateAndSetCost(val, purchasePrice);
  };

  const handlePurchasePriceChange = (val: string) => {
    setPurchasePrice(val);
    calculateAndSetCost(quantity, val);
  };

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError('No se pudo identificar al usuario actual. Por favor inicia sesión nuevamente.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    const costNum = parseFloat(cost || '0');

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('La cantidad de stock a agregar debe ser un número mayor a 0.');
      return;
    }

    if (isNaN(costNum) || costNum < 0) {
      setError('El costo total debe ser un número mayor o igual a 0.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        quantity: qtyNum,
        cost: costNum,
        description: description.trim() || undefined,
        userId: user.id
      };

      let result;
      if (type === 'product') {
        result = await ProductsApiService.addStock(item.id, payload);
      } else {
        result = await ProductTemplatesApiService.addStock(item.id, payload);
      }

      toast.success('Stock agregado y gasto registrado exitosamente.');
      onSuccess(result, type);
      handleClose();
    } catch (err: any) {
      console.error('Error adding stock:', err);
      // Extraer el mensaje de error de Electron
      const errMsg = err.message || 'Error al agregar stock';
      setError(errMsg.replace('Error: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setPurchasePrice('');
    setCost('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Surtir Stock / Registrar Gasto</h2>
              <p className="text-xs text-gray-500 mt-1">
                Aumenta el inventario y genera un gasto en la sesión de caja activa.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-red-800 text-sm">
                <AlertCircle className="shrink-0 h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Info Item */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-150 text-sm text-gray-700 space-y-1">
              <div>
                <strong>Elemento:</strong> {item.name}
              </div>
              <div className="flex justify-between">
                <span>Stock Actual:</span>
                <span className="font-semibold text-gray-950">{item.currentStock}</span>
              </div>
            </div>

            {/* Cantidad a agregar */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Cantidad a agregar *
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="number"
                  step="any"
                  required
                  placeholder="Ej: 50"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Precio de Compra Unitario */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Precio de Compra Unitario
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 5.00"
                  value={purchasePrice}
                  onChange={(e) => handlePurchasePriceChange(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Precio de compra por unidad establecido en el producto. Se puede modificar.
              </p>
            </div>

            {/* Costo total */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Costo Total (Se convertirá en Gasto) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ej: 250.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                El monto ingresado se registrará inmediatamente como un gasto en la caja.
              </p>
            </div>

            {/* Descripción opcional del gasto */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Notas / Descripción Opcional
              </label>
              <Input
                type="text"
                placeholder="Ej: Compra de material con proveedor X"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Surtir Inventario
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStockModal;
