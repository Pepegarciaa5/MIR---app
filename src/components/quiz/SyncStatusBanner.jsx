import React from 'react';

/**
 * SyncStatusBanner — Componente visual para mostrar el estado de sincronización
 * con Supabase al finalizar un test (tanto adaptativo como del banco de preguntas).
 * Informa con claridad si los datos se han subido a la nube o si están guardados
 * localmente a la espera de conexión a Internet.
 */
export default function SyncStatusBanner({ syncState, onRetry, className = '' }) {
  if (!syncState) return null;

  const { status, pendingCount = 0, syncedCount = 0, errorMsg, lastSyncTime } = syncState;

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  if (status === 'syncing') {
    return (
      <div className={`p-4 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-900 flex items-center justify-between gap-4 animate-pulse ${className}`}>
        <div className="flex items-center gap-3 text-left">
          <svg className="w-6 h-6 text-cyan-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <div>
            <h4 className="font-bold text-sm text-cyan-900">Sincronizando con Supabase...</h4>
            <p className="text-xs text-cyan-700">Subiendo preguntas y guardando tus resultados en la nube.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'synced') {
    return (
      <div className={`p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-4 text-left ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 text-lg flex-shrink-0 font-bold">
            ✓
          </div>
          <div>
            <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
              Sincronizado con Supabase
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                En la nube
              </span>
            </h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              {syncedCount > 0 ? `${syncedCount} preguntas y resultado guardados correctamente.` : 'Todas tus preguntas y estadísticas están al día en la nube.'}
              {lastSyncTime && <span className="text-emerald-600 ml-1">({formatTime(lastSyncTime)})</span>}
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex-shrink-0 hover:opacity-80"
            title="Volver a verificar sincronización"
          >
            Verificar
          </button>
        )}
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className={`p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left ${className}`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0 mt-0.5">📡</div>
          <div>
            <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
              Modo sin conexión (Guardado seguro en este dispositivo)
            </h4>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Estás offline. {pendingCount > 0 ? `Hay ${pendingCount} preguntas pendientes de subir a Supabase.` : 'Tus respuestas están a salvo localmente.'} Se sincronizarán automáticamente al volver a tener Internet.
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <span>🔄</span> Comprobar y Sincronizar
          </button>
        )}
      </div>
    );
  }

  // Error status
  return (
    <div className={`p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left ${className}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 mt-0.5">⚠️</div>
        <div>
          <h4 className="font-bold text-sm text-rose-900">
            Pendiente de sincronizar con Supabase
          </h4>
          <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
            {errorMsg ? errorMsg : 'No se pudo conectar con Supabase en este momento.'} Las respuestas están guardadas en tu dispositivo sin riesgo de pérdida.
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 flex-shrink-0"
        >
          <span>🔄</span> Reintentar
        </button>
      )}
    </div>
  );
}
