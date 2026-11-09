---
name: corregir-simulacro
description: Protocolo completo de corrección rápida de Simulacros Oficiales CTO del MIR (210 preguntas), control de fatiga por tramos, auditoría por los 4 bloques de prioridad poblacional P80 (≥70%, 50-69%, 35-49%, <35%) con enunciados 100% literales y generación reactiva de tarjetas visuales en Anki (mazo MIR 2027). Activar siempre que el usuario pida analizar, auditar o corregir un simulacro oficial completo (ej. "corrígeme el simulacro 19", "audita el simu 20").
---

# Protocolo de Corrección de Simulacros Oficiales CTO MIR (`corregir-simulacro`)

## 1. Contexto y Objetivos del Alumno
- **Meta:** Alcanzar y consolidar el **Percentil 80 (P80)** en CTO.
- **Enfoque de examen:** Examen de 200 preguntas + 10 de reserva (4,5 horas bajo presión de tiempo).
- **Mazo activo en macOS:** **`MIR 2027`** (`did = 1780386205296`) en `~/Library/Application Support/Anki2/Usuario 1/collection.anki2`.

---

## 2. Flujo de Ejecución Automática al Pedir un Simulacro
En cuanto el usuario pida corregir un simulacro (ej. *«corrígeme el simulacro 19»* o *«audita el simu 20»*):

1. **Ejecutar el script auditor:**
   ```bash
   python3 scripts/auditar_simulacro.py --sim <N>
   ```
   *(Si no se indica número, audita el último disponible en `src/data/simulacrosCTO.json`).*

2. **Salidas generadas automáticamente por Python:**
   - `/tmp/s<N>_audit.json`: Datos estructurados de todas las preguntas falladas y en blanco.
   - `/tmp/guia_sim<N>_esqueleto.md`: **Esqueleto Markdown completo con el 100% de los enunciados literales y opciones exactas**, ya dividido en los 4 Bloques Poblacionales P80.

3. **Generación del Artefacto de Corrección:**
   Crear el artefacto Markdown en `<appDataDir>/brain/<conversation-id>/guia_correccion_simulacro_<N>.md` tomando como base el esqueleto de Python y enriqueciéndolo:
   - **Aplicar negritas clínicas:** Resalta sobre el texto literal los datos pivote que cambian el diagnóstico (edad, antecedentes clave, tiempo de evolución, hallazgos radiológicos/analíticos decisivos y qué pide la pregunta: *NO*, *FALSA*, *MÁS probable*).
   - **Redactar el razonamiento conciso (1–2 líneas):** En `🎯 Por qué fallaste / Concepto clave`, explica el diferencial exacto entre la opción que marcó el alumno y la correcta, evitando rollo enciclopédico de CTO.
   - **Incluir siempre la propuesta `🃏 Anki sugerida`:** Redactar la propuesta atómica de 3 segundos en cada pregunta (sirve como micro-resumen de alto valor), pero **NO inyectarla todavía en la base de datos** (la inyección es reactiva).

---

## 3. Jerarquía y Estructura de los 4 Bloques de Prioridad Poblacional P80

El informe del simulacro se divide estrictamente en los **4 Bloques según el porcentaje de acierto de la academia (`pct`)**:

### 🔴 BLOQUE 1: Las «Imperdonables» (`≥ 70%` de acierto en la academia)
* Son los fallos que más hunden el percentil.
* Suelen deberse a despistes de lectura, prisas o trampas de opción en conceptos estándar.
* **Prioridad 1** de estudio y repaso.

### 🟠 BLOQUE 2: Preguntas Asequibles (`50% – 69%` de acierto en la academia)
* Conceptos de dificultad media que te colocan por encima de la media de la oposición.
* Requieren fijar algoritmos de primer escalón y diagnósticos diferenciales típicos.

### 🟡 BLOQUE 3: Discriminación P80 (`35% – 49%` de acierto en la academia)
* **El verdadero campo de batalla del P80**: preguntas que discriminan entre un percentil 50 y un percentil 80.
* Exigen precisión en detalles semiológicos, fármacos de segunda línea o excepciones clásicas.

### 📡 BLOQUE 4: Radar de Cosas Nuevas / Difíciles (`< 35%` de acierto en la academia)
* Preguntas muy complejas, atípicas o de autores rebuscados.
* Objetivo: capturar la "perla" o regla mnemotécnica rápida por si se repite, sin atascarse.

---

## 4. Formato Estricto de Cada Pregunta en la Guía

El formato de cada pregunta debe seguir esta estructura literal inalterada:

```markdown
### X. `Q<num>` · <Asignatura> (<% pob>% pob) — *<Título corto del concepto>* [✂️ `Con descartes` | 🎯 `Sin descartes` | ⚪ `Dejada en blanco`]
* **Enunciado completo:** <Texto literal íntegro de CTO con las palabras gatillo y datos pivote en **negrita**>.
* ❌ **Marcaste (<n>):** *<Texto textual de la opción marcada>* (<% alumnos que la marcaron>% pob).
* ✅ **Correcta (<n>):** ***<Texto textual de la opción correcta>***.
* **🎯 Por qué fallaste / Concepto clave:** <Explicación clínica y fisiopatológica directa en 1–2 líneas contrastando tu opción contra la correcta>.
* 🔗 **Nexo Clínico e Interrelación con Q<otra> (si existe en el simulacro):** <Comparativa directa: cómo se diferencia el caso clínico o por qué difiere la conducta frente a la otra pregunta afín del examen>.
* ✂️ **Por qué son falsas las demás opciones (descartes clave):**
  *(MANDATORIO si la pregunta pide la CORRECTA o más probable: explica en 1 frase clínica concisa por qué se excluye cada distractor, prestando especial atención a tu opción errónea y a la opción trampa de la academia)*:
  • **Opción X** *(tu elección errónea / trampa)*: <Motivo clínico exacto por el que se descarta>.
  • **Opción Y**: <Motivo por el que no aplica al caso clínico>.
* **🃏 Anki sugerida:** <Propuesta atómica de tarjeta respondible en ≤3 segundos>.
```
*(Si la pregunta fue dejada en blanco, sustituir la línea de Marcaste por: `* ⚪ **Dejada en blanco (No contestada).**`)*.

---

## 5. Inyección Reactiva en Anki (`MIR 2027`)
- **Regla de oro:** NUNCA inyectes tarjetas de forma automática o masiva al generar la guía. Solo se inyectan en `collection.anki2` **cuando el alumno lo pida explícitamente** (en el chat o en un comentario sobre el artefacto).
- Antes de escribir en la base de datos, comprueba que `/Applications/Anki.app` esté cerrado (`is_anki_running()` en `scripts/anki_visual_builder.py`).
- Usa siempre los componentes de `scripts/anki_visual_builder.py`:
  - `front_card()`: 1 sola pregunta cerrada (no multipregunta).
  - `back_wrapper(..., atomic_html=...)`: Caja verde con el dato atómico de 1–4 palabras para aprobar en <3 segundos.
  - `insert_cloze_card()` si el alumno prefiere formato Cloze.
