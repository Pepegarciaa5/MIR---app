/**
 * Extractor de planificación completa - Campus CTO MIR
 * Uso: pegar en la consola del navegador estando logueado en campus-app.grupocto.com
 *
 * Extrae TODOS los eventos del calendario (clases, estudio, desgloses, descansos,
 * simulacros, vacaciones...). Los eventos de Estudio y Desgloses incluyen la lista
 * de temas, ya que comparten el mismo bloque de contenido.
 */

(async function extractMIR() {
  const BASE = 'https://campus-app.grupocto.com';

  // 1. Obtener grupo_id desde localStorage
  const campusState = JSON.parse(localStorage.getItem('campus_state') || '{}');
  const grupoId = campusState?.state?.grupo?.id;
  if (!grupoId) { console.error('No se encontró grupo_id en localStorage'); return; }
  console.log('grupo_id:', grupoId);

  // 2. Obtener todos los eventos del curso de un solo golpe
  console.log('Obteniendo todos los eventos...');
  const resp = await fetch(`${BASE}/api/campus/eventos/intervalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grupo_id: grupoId, fecha_inicial: '2025-09-01', fecha_final: '2026-07-31' })
  });
  const todosEventos = await resp.json();
  console.log(`Total eventos: ${todosEventos.length}`);

  // 3. Extraer título principal del markdown
  function extractTitle(markdown) {
    if (!markdown) return null;
    const match = markdown.match(/^#+\s+(.+)$/m);
    return match ? match[1].trim() : markdown.slice(0, 80);
  }

  // 4. Obtener temas de cada bloque de Estudio (Desgloses comparte el mismo bloque)
  const estudios = todosEventos.filter(e => e.categoria === 'Estudio' && e.url);
  console.log(`Bloques de estudio a extraer: ${estudios.length}`);

  const bloqueMap = new Map(); // url_bloque → temas[]
  for (let i = 0; i < estudios.length; i++) {
    const evento = estudios[i];
    console.log(`[${i + 1}/${estudios.length}] ${evento.fecha_inicio.slice(0, 10)} - ${evento.asunto}`);
    try {
      const r = await fetch(`${BASE}/api/campus/estudio/bloque/${evento.url}`);
      const text = await r.text();
      if (text && !text.includes('"status":400')) {
        const bloque = JSON.parse(text);
        if (bloque.temas) {
          bloqueMap.set(evento.url, bloque.temas.map(t => ({
            orden: t.orden + 1,
            titulo: extractTitle(t.resumen),
            resumen: t.resumen || null
          })));
        }
      }
    } catch (e) { /* ignorar errores puntuales */ }
    await new Promise(r => setTimeout(r, 150));
  }

  // 5. Construir el resultado completo (sin más peticiones de red)
  const result = todosEventos
    .filter(e => e.fecha_inicio)
    .map(e => ({
      fecha: e.fecha_inicio.slice(0, 10),
      hora_inicio: e.fecha_inicio.slice(11, 16),
      hora_fin: e.fecha_fin ? e.fecha_fin.slice(11, 16) : null,
      nombre: e.asunto || '',
      categoria: e.categoria || '',
      asignatura: e.asignatura || null,
      vuelta: e.vuelta || null,
      bloque_num: e.numero || null,
      temas: bloqueMap.get(e.url) || []  // Desgloses reutiliza el bloque de Estudio del mismo día
    }));

  // 6. Descargar JSON
  const jsonBlob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(jsonBlob),
    download: 'planificacion_completa_MIR.json'
  }).click();

  // 7. Descargar CSV
  const headers = ['fecha', 'hora_inicio', 'hora_fin', 'nombre', 'categoria', 'asignatura', 'vuelta', 'bloque_num', 'temas'];
  const rows = result.map(d => [
    d.fecha, d.hora_inicio, d.hora_fin, d.nombre, d.categoria,
    d.asignatura, d.vuelta, d.bloque_num,
    d.temas.map(t => `${t.orden}. ${t.titulo}`).join(' | ')
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const csvBlob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(csvBlob),
    download: 'planificacion_completa_MIR.csv'
  }).click();

  const conTemas = result.filter(r => r.temas.length > 0).length;
  console.log(`✓ Extracción completa: ${result.length} eventos | ${conTemas} con temas`);
  return result;
})();
