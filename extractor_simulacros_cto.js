/**
 * CTO Campus — Extractor de Simulacros Unificado (Stats + Textos)
 * ===============================================================
 * Pega este script en la consola del navegador estando logueado en
 * https://campus-app.grupocto.com
 *
 * Descarga dos archivos automáticamente:
 *   1. simulacrosCTO.json (Estadísticas y netas del usuario - SIEMPRE COMPLETO)
 *   2. simulacros_textos.json (Enunciados, imágenes y respuestas - SOLO LOS NUEVOS)
 */

(async () => {
  console.log("🚀 Iniciando Extractor Unificado de Simulacros...");
  const headers = {};

  // PREGUNTA AL USUARIO PARA OPTIMIZAR
  const textoSimulacroStartStr = prompt(
    "¿Desde qué número de simulacro quieres descargar los textos largos?\n(Ej: Pon '17' para descargar solo los textos del simulacro 17. Pon '0' para descargar todos de nuevo).", 
    "17"
  );
  const textoSimulacroStart = parseInt(textoSimulacroStartStr || "0", 10);

  // ── 1. Obtener IDs básicos ─────────────────────────────────────────────
  let edicionId = 'c5b75a71-f844-4fdc-84da-0fce2924bf63';
  let grupoId = 'ef391c35-54e2-4013-9c65-623be7bb6446';
  const perfEntries = performance.getEntriesByType('resource');
  const activosEntry = perfEntries.find(e => e.name.includes('/examenes/activos/'));
  
  if (activosEntry) {
    const parts = new URL(activosEntry.name).pathname.split('/');
    const idx = parts.indexOf('activos');
    edicionId = parts[idx + 1];
    grupoId   = parts[idx + 2];
    console.log("✅ IDs extraídos correctamente del navegador.");
  } else {
    console.warn("⚠️  Usando IDs por defecto. Si falla, navega a Simulacros y vuelve a ejecutar.");
  }

  // ── 2. Obtener lista de simulacros ──────────────────────────────────────
  const listR = await fetch(`/api/campus/examenes/activos/${edicionId}/${grupoId}/Simulacro`, { headers });
  if (!listR.ok) {
    console.error("❌ Error al obtener simulacros:", listR.status);
    return;
  }
  const todosSimulacros = await listR.json();
  const realizados = todosSimulacros.filter(s => s.resultado?.id && s.resultado?.estado === 5);
  
  console.log(`📊 Simulacros completados encontrados: ${realizados.length}`);
  if (realizados.length === 0) return;

  const allPreguntas  = [];
  const allSimulacros = [];
  const allTextos     = [];

  // ── 3. Recorrer simulacros ──────────────────────────────────────────────
  for (const sim of realizados) {
    const examenId    = sim.id;
    const resultadoId = sim.resultado.id;
    const label       = sim.nombre || `Simulacro ${sim.numero}`;
    console.log(`\n📘 Procesando ${label}...`);

    // --- A. Extraer Estadísticas Globales (/info/ y /percentiles/) ---
    let infoData = null;
    try {
      const infoR = await fetch(`/api/campus/examenes/info/${examenId}/${edicionId}/${grupoId}?timestamp=${Date.now()}`);
      if (infoR.ok) infoData = await infoR.json();
    } catch (e) {}

    let percentilesData = null;
    try {
      const percR = await fetch(`/api/campus/examenes/percentiles/${resultadoId}`);
      if (percR.ok) percentilesData = await percR.json();
    } catch (e) {}

    // --- B. Extraer Respuestas del Alumno (/revisar/) ---
    let preguntasRevisar = [];
    try {
      const revR = await fetch(`/api/campus/examenes/revisar/${resultadoId}`);
      if (revR.ok) preguntasRevisar = (await revR.json()).revision || [];
    } catch (e) {}

    // Guardar Meta del Simulacro
    const rex = infoData?.resultado?.resultado_por_examen || {};
    const clasi = infoData?.resultado?.resultados_por_clasificacion || [];
    
    allSimulacros.push({
      numero:       sim.numero,
      nombre:       label,
      examen_id:    examenId,
      resultado_id: resultadoId,
      fecha:        rex.fecha_realizacion || sim.fecha_realizacion || null,
      stats: {
        total:           rex.total ?? preguntasRevisar.length,
        acertadas:       rex.acertadas ?? null,
        falladas:        rex.falladas ?? null,
        nulas:           rex.nulas ?? null,
        neta:            rex.netas ?? null,
        percentil_total: rex.percentil_total ?? null,
        cuenta_total:    rex.cuenta_total ?? null,
        dudadas:         rex.dudadas ?? null,
        acertadas_dudadas: rex.acertadas_dudadas ?? null,
        dificultad_media: rex.dificultad_media ?? null,
        ignoradas:       rex.ignoradas ?? null,
      },
      percentiles_campo: percentilesData ? {
        p5: percentilesData.p5, p25: percentilesData.p25, p50: percentilesData.p50, p75: percentilesData.p75, p95: percentilesData.p95
      } : null,
      por_asignatura: clasi.filter(c => c.nivel === 1).map(c => ({
        codigo: c.clasificacion_id || c.codigo, nombre: c.nombre, preguntas: c.total, acertadas: c.acertadas, falladas: c.falladas, nulas: c.nulas, neta: c.neta, pctAcierto: c.total > 0 ? Math.round((c.acertadas / c.total) * 1000) / 10 : 0, dificultad: c.dificultad_media,
      })),
      por_tema: clasi.filter(c => c.nivel === 2).map(c => ({
        codigo: c.clasificacion_id || c.codigo, nombre: c.nombre, asignatura: c.padre_id || c.asignatura, preguntas: c.total, acertadas: c.acertadas, falladas: c.falladas, nulas: c.nulas, neta: c.neta, pctAcierto: c.total > 0 ? Math.round((c.acertadas / c.total) * 1000) / 10 : 0, dificultad: c.dificultad_media,
      }))
    });

    // Guardar Estadísticas de Preguntas Individuales
    preguntasRevisar.forEach(p => {
      allPreguntas.push({
        simulacro: sim.numero, pregunta_id: p.pregunta_id, numero: p.numero, asignatura: p.asignatura, clasificaciones: p.clasificaciones || [],
        dificultad: p.dificultad, acertada: p.acertada ? 1 : 0, fallada: p.fallada ? 1 : 0, nula: p.nula ? 1 : 0, neta: p.neta, ignorar: p.ignorar ? true : false,
        tiempo: p.tiempo, dudas: p.dudas ? 1 : 0, respuesta_dada: p.respuesta, respuesta_correcta: p.correcta,
        pct_misma_respuesta: p.opciones_elegidas?.find(o => o.respuesta === p.respuesta)?.cuenta ?? null,
        pct_correcta: p.opciones_elegidas?.find(o => o.respuesta === p.correcta)?.cuenta ?? null,
      });
    });

    // --- C. Extraer TEXTOS (Enunciados y Opciones) haciendo peticiones por pregunta ---
    if (sim.numero >= textoSimulacroStart) {
      console.log(`   ⬇️  Descargando textos... (210 peticiones)`);
      const concurrencia = 10;
      for (let i = 1; i <= 210; i += concurrencia) {
        const promesas = [];
        for (let j = 0; j < concurrencia && (i + j) <= 210; j++) {
          const num = i + j;
          const url = `/api/campus/examenes/pregunta/${examenId}/${resultadoId}/${num}/true`;
          promesas.push(
            fetch(url).then(r => r.json()).then(p => {
              if (!p || !p.enunciado) return;
              allTextos.push({
                simulacro: sim.numero, numero_pregunta: num, id: p.id, numero: p.numero || num, enunciado: p.enunciado || '', dificultad: p.dificultad || 3,
                anulada: p.anulada ? true : false, reportada: p.reportada || false, comentario: p.comentario || '', imagen_nombre: p.imagen_nombre || null, tiene_video: p.tiene_video || false,
                respuestas: (p.respuestas || []).map(o => ({
                  id: o.id || o.opcion_id, numero: o.numero || o.opcion, enunciado: o.enunciado || o.texto || '', correcta: o.correcta || o.es_correcta || false
                }))
              });
            }).catch(e => {}) 
          );
        }
        await Promise.all(promesas);
        if ((i + concurrencia - 1) % 50 === 0) console.log(`      ... ${i + concurrencia - 1} / 210 procesadas`);
        await new Promise(r => setTimeout(r, 100)); // Respiro a la red
      }
      console.log(`   ✅ Textos del simulacro ${sim.numero} completados.`);
    } else {
      console.log(`   ⏭️  Saltando textos del simulacro ${sim.numero} (ya extraídos).`);
    }
  }

  // ── 4. Exportar Archivos ────────────────────────────────────────────────
  console.log(`\n🎉 Extracción finalizada. Preparando archivos...`);

  let campusState = {};
  try { campusState = JSON.parse(localStorage.getItem('campus_state') || '{}'); } catch (e) {}

  // A. JSON de Estadísticas (Siempre completo)
  const objStats = {
    meta: {
      version: 3, exportado: new Date().toISOString(),
      alumno: (campusState?.state?.alumno?.nombre || '') + ' ' + (campusState?.state?.alumno?.apellidos || ''),
      simulacros: allSimulacros.length, total_preguntas: allPreguntas.length,
    },
    simulacros: allSimulacros,
    preguntas: allPreguntas,
  };
  
  const a1 = document.createElement('a');
  a1.href = URL.createObjectURL(new Blob([JSON.stringify(objStats, null, 2)], { type: 'application/json' }));
  a1.download = 'simulacrosCTO.json';
  document.body.appendChild(a1); a1.click(); document.body.removeChild(a1);
  console.log(`💾 Guardado: simulacrosCTO.json (Stats completas)`);

  // B. JSON de Textos (Solo los nuevos)
  setTimeout(() => {
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob([JSON.stringify(allTextos, null, 2)], { type: 'application/json' }));
    a2.download = 'simulacros_textos.json';
    document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
    console.log(`💾 Guardado: simulacros_textos.json (Solo textos a partir del simulacro ${textoSimulacroStart})`);
  }, 1000);

})();
