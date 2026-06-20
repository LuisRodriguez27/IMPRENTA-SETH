import { Button, Input, Label } from "@/components/ui";
import { ProductTemplatesApiService } from "@/features/productTemplates/ProductTemplatesApiService";
import { createProductTemplateSchema, type CreateProductTemplateForm, type ProductTemplate } from "@/features/productTemplates/types";
import type { Product } from "../../products/types";
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleDollarSign, FileText, Loader, Package, Percent, Ruler, X } from "lucide-react";
import React, { useState } from "react";
import { useForm } from 'react-hook-form';
import { extractErrorMessage } from '@/utils/errorHandling';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated: (template: ProductTemplate) => void;
  product: Product;
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen, onClose, onTemplateCreated, product
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<CreateProductTemplateForm>({
    resolver: zodResolver(createProductTemplateSchema),
    defaultValues: {
      productId: product.id,
      name: '',
      final_price: product.price,
      package: false,
      description: ''
    }
  });

  const packageValue = watch('package');
  const [percentage, setPercentage] = useState<number>(0);

  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const newPercent = isNaN(val) ? 0 : val;
    setPercentage(newPercent);
    if (product) {
      const calculatedPrice = product.price * (1 + (newPercent / 100));
      setValue('final_price', parseFloat(calculatedPrice.toFixed(2)));
    }
  };

  // Set default values from product
  React.useEffect(() => {
    if (product && isOpen) {
      setValue('productId', product.id);
      setValue('name', '');
      setValue('final_price', product.price);
      setValue('description', '');
    }
  }, [product, isOpen, setValue]);

  const onSubmit = async (data: CreateProductTemplateForm) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const processedData = {
        ...data,
        created_by: 1
      };

      const newTemplate = await ProductTemplatesApiService.create(processedData);
      onTemplateCreated(newTemplate);
      reset();
      onClose();
    } catch (err: any) {
      console.error('Error creating template:', err);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setPercentage(0);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nueva Plantilla</h2>
              <p className="text-sm text-gray-500">
                Crear plantilla para: <span className="font-medium">{product.name}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Product Reference */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Producto:</span> {product.name}
              </div>
              <div>
                <span className="font-medium">Precio base:</span> ${product.price.toFixed(2)} MXN
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre de la Plantilla */}
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Nombre de la Plantilla *
              </Label>
              <div className="mt-1 relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="name"
                  type="text"
                  placeholder="Ej: Lona comercial roja"
                  className="pl-10"
                  {...register('name')}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Descripción
              </Label>
              <div className="mt-1 relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="description"
                  type="text"
                  placeholder="Ej: Detalles opcionales de la plantilla"
                  className="pl-10"
                  {...register('description')}
                />
              </div>
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Dimensiones */}
            <div>
              <Label htmlFor="dimensions" className="text-sm font-medium text-gray-700">
                Dimensiones
              </Label>
              <div className="mt-1 relative">
                <Ruler className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="dimensions"
                  type="text"
                  placeholder="Ej: 2.0m x 3.0m o Carta"
                  className="pl-10"
                  {...register('dimensions')}
                />
              </div>
              {errors.dimensions && (
                <p className="mt-1 text-sm text-red-600">{errors.dimensions.message}</p>
              )}
            </div>

            {/* Final Price */}
            <div>
              <Label htmlFor="final_price" className="text-sm font-medium text-gray-700">
                Precio Final *
              </Label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                <Input
                  id="final_price"
                  type="number"
                  step='0.01'
                  min='0'
                  placeholder="0.00"
                  className="pl-8"
                  {...register('final_price', {
                    valueAsNumber: true,
                    onChange: () => setPercentage(0)
                  })}
                />
              </div>
              {errors.final_price && (
                <p className="mt-1 text-sm text-red-600">{errors.final_price.message}</p>
              )}
            </div>

            {/* Promo Price */}
            <div>
              <Label htmlFor="promo_price" className="text-sm font-medium text-gray-700">
                Precio Promoción
              </Label>
              <div className="mt-1 relative">
                <CircleDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="promo_price"
                  type="number"
                  step='0.01'
                  min='0'
                  placeholder="0.00"
                  className="pl-10"
                  {...register('promo_price', {
                    setValueAs: v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) ? null : parseFloat(v as string)
                  })}
                />
              </div>
              {errors.promo_price && (
                <p className="mt-1 text-sm text-red-600">{errors.promo_price.message}</p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <Label htmlFor="category" className="text-sm font-medium text-gray-700">
                Categoría
              </Label>
              <div className="mt-1 relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="category"
                  type="text"
                  placeholder="Ej: Impresión o Tazas"
                  className="pl-10"
                  {...register('category')}
                />
              </div>
              {errors.category && (
                <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            {/* Modelo */}
            <div>
              <Label htmlFor="model" className="text-sm font-medium text-gray-700">
                Modelo
              </Label>
              <div className="mt-1 relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="model"
                  type="text"
                  placeholder="Ej: Premium o Blanco"
                  className="pl-10"
                  {...register('model')}
                />
              </div>
              {errors.model && (
                <p className="mt-1 text-sm text-red-600">{errors.model.message}</p>
              )}
            </div>

            {/* Percentage Adjustment */}
            <div>
              <Label htmlFor="percentage" className="text-sm font-medium text-gray-700">
                Ajuste % (Base: ${product.price})
              </Label>
              <div className="mt-1 relative">
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  id="percentage"
                  type="number"
                  step='0.01'
                  placeholder="0"
                  className="pl-10"
                  value={percentage === 0 ? '' : percentage}
                  onChange={handlePercentageChange}
                />
              </div>
            </div>

            {/* Es Paquete */}
            <div className="flex items-center gap-2 pt-8">
              <input
                id="package"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register('package')}
              />
              <Label htmlFor="package" className="text-sm font-medium text-gray-700 select-none">
                Es un Paquete
              </Label>
            </div>

            {/* Piezas por Paquete */}
            {packageValue && (
              <div>
                <Label htmlFor="piecesPerPack" className="text-sm font-medium text-gray-700">
                  Piezas por Paquete
                </Label>
                <div className="mt-1 relative">
                  <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <Input
                    id="piecesPerPack"
                    type="number"
                    min="0"
                    placeholder="Ej: 10"
                    className="pl-10"
                    {...register('piecesPerPack', { valueAsNumber: true })}
                  />
                </div>
                {errors.piecesPerPack && (
                  <p className="mt-1 text-sm text-red-600">{errors.piecesPerPack.message}</p>
                )}
              </div>
            )}

          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting && <Loader className="animate-spin" size={16} />}
              {isSubmitting ? 'Creando...' : 'Crear Plantilla'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

};

export default CreateTemplateModal;