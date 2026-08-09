import React, { useState, useCallback } from 'react';
import { Image as ImageIcon, ImageOff, Upload, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { getImageSrc, getImageFileName } from '@/utils/imageUtils';
import useEmblaCarousel from 'embla-carousel-react';

interface ImageGalleryProps {
  productId: number;
  images?: string[] | null;
  onUploadStart?: () => void;
  onImagesAdded?: (paths: string[]) => void | Promise<void>;
  onImageDeleted?: (storedPath: string) => void | Promise<void>;
  onUploadError?: (error: string) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images = [],
  onUploadStart,
  onImagesAdded,
  onImageDeleted,
  onUploadError
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  // Rutas cuyo archivo original ya no se encuentra en la PC
  const [brokenPaths, setBrokenPaths] = useState<string[]>([]);

  // Carousel hooks (sin Autoplay, manual)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setPrevBtnEnabled(emblaApi.canScrollPrev());
    setNextBtnEnabled(emblaApi.canScrollNext());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect, images]);

  const currentImages = images || [];

  /**
   * Abre el explorador del sistema. No se copia el archivo: se guarda la ruta
   * original donde el cliente ya tiene la imagen en su PC.
   */
  const handleSelectImages = async () => {
    try {
      if (onUploadStart) onUploadStart();
      setIsSelecting(true);

      const result = await window.api.selectImages();
      if (result.canceled || result.paths.length === 0) return;

      const nuevas = result.paths.filter((p) => !currentImages.includes(p));
      if (nuevas.length === 0) {
        if (onUploadError) onUploadError('Esa imagen ya está en la galería del producto.');
        return;
      }

      if (onImagesAdded) await onImagesAdded(nuevas);
      setBrokenPaths((prev) => prev.filter((p) => !nuevas.includes(p)));
      // Scroll hasta la primera imagen agregada
      setTimeout(() => emblaApi?.scrollTo(currentImages.length), 100);
    } catch (error: any) {
      console.error(error);
      if (onUploadError) onUploadError(error.message || 'Error desconocido.');
    } finally {
      setIsSelecting(false);
    }
  };

  /**
   * Quita la imagen del producto. El archivo original del cliente NUNCA se borra:
   * sólo se elimina la referencia guardada en la base de datos.
   */
  const handleRemoveImage = async (storedPath: string) => {
    try {
      if (onImageDeleted) await onImageDeleted(storedPath);
    } catch (e) {
      console.error('Error quitando la imagen del producto', e);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Galería del Producto</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectImages}
          disabled={isSelecting}
          className="flex items-center gap-2"
        >
          <Upload size={14} />
          {isSelecting ? 'Añadiendo...' : 'Añadir'}
        </Button>
      </div>

      <div className="flex-1 min-h-62.5 relative bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden flex flex-col">
        {currentImages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
            <ImageIcon size={48} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">No hay imágenes asociadas.</p>
            <p className="text-xs mt-1 text-center">Selecciona fotos de tu equipo para crear una galería.</p>
          </div>
        ) : (
          <div className="relative flex-1 flex flex-col w-full h-full">
            <div className="overflow-hidden flex-1 flex" ref={emblaRef}>
              <div className="flex w-full h-full touch-pan-y">
                {currentImages.map((imgPath, index) => (
                  <div className="relative flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-2 group" key={`${imgPath}-${index}`}>
                    {brokenPaths.includes(imgPath) ? (
                      <div className="flex flex-col items-center justify-center text-center text-gray-400 px-4">
                        <ImageOff size={40} className="mb-2 opacity-60" />
                        <p className="text-xs font-medium text-gray-500">No se encontró el archivo</p>
                        <p className="text-[11px] mt-1 break-all">{imgPath}</p>
                      </div>
                    ) : (
                      <img
                        src={getImageSrc(imgPath)}
                        alt={getImageFileName(imgPath)}
                        title={imgPath}
                        className="w-full h-full object-contain max-h-75"
                        onError={() => setBrokenPaths((prev) => (prev.includes(imgPath) ? prev : [...prev, imgPath]))}
                      />
                    )}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8 rounded-full shadow-lg"
                        title="Quitar del producto (no borra el archivo original)"
                        onClick={() => handleRemoveImage(imgPath)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controles del Carrusel (si hay > 1 imagen) */}
            {currentImages.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md bg-white/80 hover:bg-white z-10"
                  onClick={scrollPrev}
                  disabled={!prevBtnEnabled}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md bg-white/80 hover:bg-white z-10"
                  onClick={scrollNext}
                  disabled={!nextBtnEnabled}
                >
                  <ChevronRight size={16} />
                </Button>
                {/* Dots */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {currentImages.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all ${index === selectedIndex ? "bg-primary-600 w-4" : "bg-gray-300"
                        }`}
                      onClick={() => emblaApi?.scrollTo(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {isSelecting && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;
