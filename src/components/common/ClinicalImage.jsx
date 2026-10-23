import React, { useState, useEffect, useCallback } from 'react';
import { getSimulacroImageUrl } from '../../lib/simulacros';

/**
 * Componente para renderizar imágenes clínicas (radiología, dermatología, histología, ECG...)
 * de simulacros y desgloses CTO con visor ampliable (Lightbox) y controles de zoom.
 */
export default function ClinicalImage({
  src,
  imagen_nombre,
  alt = 'Imagen clínica asociada',
  caption = null,
  className = '',
  maxHeight = 'max-h-80 md:max-h-96'
}) {
  const rawTarget = src || imagen_nombre;
  const imageUrl = getSimulacroImageUrl(rawTarget);

  const [isOpen, setIsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Manejar cierre con la tecla Escape y atajos
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setZoomLevel(1);
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
      } else if (e.key === '-' || e.key === '_') {
        setZoomLevel((prev) => Math.max(prev - 0.5, 0.75));
      } else if (e.key === '0') {
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpenModal = useCallback((e) => {
    if (e) e.stopPropagation();
    setZoomLevel(1);
    setIsOpen(true);
  }, []);

  const handleCloseModal = useCallback((e) => {
    if (e) e.stopPropagation();
    setIsOpen(false);
    setZoomLevel(1);
  }, []);

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.max(prev - 0.5, 0.75));
  };

  const handleResetZoom = (e) => {
    e.stopPropagation();
    setZoomLevel(1);
  };

  const toggleDoubleZoom = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => (prev > 1.2 ? 1 : 2));
  };

  if (!imageUrl || hasError) {
    if (!rawTarget) return null;
    return (
      <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-xs flex items-center justify-center gap-2">
        <span>🖼️</span>
        <span>Imagen clínica no disponible</span>
      </div>
    );
  }

  return (
    <>
      {/* Vista previa inline dentro de la pregunta */}
      <div className={`my-4 flex flex-col items-center select-none ${className}`}>
        <div
          onClick={handleOpenModal}
          className="group relative cursor-zoom-in inline-block rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-sm hover:shadow-md transition-all duration-200"
          title="Haz clic para ver la imagen a pantalla completa con zoom"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-xs z-10">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <img
            src={imageUrl}
            alt={alt}
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`${maxHeight} w-auto object-contain transition-transform duration-300 group-hover:scale-[1.015]`}
          />

          {/* Badge flotante de zoom */}
          <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-[11px] font-semibold tracking-wide flex items-center gap-1.5 shadow-sm transition-opacity opacity-85 group-hover:opacity-100">
            <span>🔍</span>
            <span>Ampliar</span>
          </div>
        </div>

        {caption && (
          <p className="mt-1.5 text-xs text-slate-500 italic text-center max-w-lg">
            {caption}
          </p>
        )}
      </div>

      {/* Modal Lightbox a pantalla completa */}
      {isOpen && (
        <div
          onClick={handleCloseModal}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200 select-none"
        >
          {/* Barra superior con información y controles de cierre */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between gap-3 text-white max-w-5xl mx-auto w-full py-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="text-base">🩻</span>
              <span className="truncate max-w-xs sm:max-w-md">{alt}</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                title="Abrir imagen original en nueva pestaña"
              >
                <span>↗</span>
                <span className="hidden sm:inline">Pestaña nueva</span>
              </a>

              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-colors flex items-center gap-1"
                title="Cerrar (Esc)"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Cerrar [Esc]</span>
              </button>
            </div>
          </div>

          {/* Zona central con la imagen ampliada y zoom dinámico */}
          <div
            onClick={toggleDoubleZoom}
            className="flex-1 flex items-center justify-center overflow-auto p-2 my-2 cursor-zoom-in"
            title="Doble clic o clic para alternar zoom 1x / 2x"
          >
            <img
              src={imageUrl}
              alt={alt}
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out'
              }}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg shadow-2xl pointer-events-auto"
            />
          </div>

          {/* Barra inferior de controles de zoom */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 max-w-sm mx-auto w-full py-2 bg-slate-900/80 backdrop-blur-md px-4 rounded-2xl border border-white/10 text-white text-xs shadow-xl"
          >
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.75}
              className="p-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm transition-colors"
              title="Reducir zoom (-)"
            >
              −
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-mono font-bold text-xs transition-colors min-w-[55px] text-center"
              title="Restablecer tamaño normal (100%)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.5}
              className="p-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm transition-colors"
              title="Aumentar zoom (+)"
            >
              +
            </button>

            <div className="h-4 w-px bg-white/20 mx-1" />

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Clic en la imagen para 2x · [Esc] salir
            </span>
          </div>
        </div>
      )}
    </>
  );
}
