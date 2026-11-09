---
name: corregir-tirada
description: Protocolo completo de corrección rápida de tiradas diarias de preguntas (Modo Examen de Desgloses/Banco de cualquier longitud, >50 preguntas), agrupación granular por Temas, Subtemas y Clústeres de Preguntas Relacionadas (peor rendimiento primero), interrelación clínica cruzada entre preguntas afines, análisis estructurado «Espejo Clínico» del razonamiento escrito del alumno y generación reactiva de tarjetas visuales en Anki (mazo MIR 2027). Activar siempre que el usuario pida analizar, auditar o corregir una tirada diaria (ej. "corrígeme la tirada", "he hecho una tirada de Digestivo", "audita la tirada").
---

# Protocolo de Corrección de Tiradas Diarias de Preguntas (`corregir-tirada`)

## 1. Contexto y Objetivos de la Sesión Diaria
- **Objetivo:** Corrección ágil y de alto impacto de sesiones diarias de estudio activo (Desgloses, Banco o simulacros parciales).
- **Escalabilidad:** Diseñada para procesar **tiradas de cualquier longitud** (sin límite de 50 preguntas; admite tiradas largas de 60, 80 o 100+ preguntas de Motor 1 y Motor 2).
- **Enfoque metacognitivo:** Evalúa la calibración del alumno según su semáforo de seguridad al responder:
  - 🟢 **Segura (Verde):** Preguntas con alta certeza diagnóstica.
  - 🟠 **Dudosa (Naranja):** Dudas entre dos opciones o diagnóstico no confirmado.
  - 🔴 **Riesgo (Rojo):** Disparo intuitivo o a ciegas.
- **Mazo activo en macOS:** **`MIR 2027`** (`did = 1780386205296`) en `~/Library/Application Support/Anki2/Usuario 1/collection.anki2`.

---

## 2. Flujo de Ejecución Automática al Pedir Corrección de Tirada
En cuanto el usuario diga *«corrígeme la tirada»*, *«he hecho una tirada de Neumo»* o similar:

1. **Ejecutar el script auditor de tiradas:**
   ```bash
   python3 scripts/auditar_tirada.py
   ```
   *(Busca automáticamente y de forma 100% offline en: 1. Portapapeles `pbpaste` si contiene JSON `mir_tirada`, 2. `src/data/ultima_tirada.json`, 3. `~/Downloads/mir_tirada*.json` más reciente).*

2. **Salidas generadas automáticamente por Python:**
   - `/tmp/tirada_audit.json`: Datos estructurados de la tirada.
   - `/tmp/guia_tirada_esqueleto.md`: **Esqueleto Markdown completo con el 100% de los enunciados literales y opciones exactas**, agrupado por **Temas y Subtemas ordenados por peor rendimiento primero**.

3. **Creación del Artefacto Interactivo de la Conversación:**
   Generar el documento interactivo en `<appDataDir>/brain/<conversation-id>/guia_tirada_<asignatura>_<fecha>.md` tomando como base el esqueleto de Python y enriqueciéndolo:
   - **Fidelidad Absoluta a la Fuente Única (`tirada_audit.json`):** Prohibido utilizar diccionarios sintéticos o generar textos clínicos desconectados de la pregunta real. Las explicaciones deben fundamentarse directamente en `item['coment']` y las opciones literales de cada pregunta específica.
   - **Aplicar negritas clínicas:** Resalta sobre el texto literal los datos pivote que deciden el caso (edad, antecedentes, hallazgos guía y si piden *NO*, *FALSA*, *MÁS probable*).
   - **Desmontaje estructurado «Espejo Clínico» del razonamiento del alumno:** Si el alumno dejó una justificación escrita al responder, desglosar quirúrgicamente su proceso mental.
   - **Incluir siempre la propuesta `🃏 Anki sugerida`:** Redactar la tarjeta atómica de 3 segundos en cada pregunta revisada (funciona como micro-resumen de alto valor formativo).

---

## 3. Jerarquía y Organización del Documento (Agrupación Multinivel e Interrelación)

Para optimizar el tiempo de estudio y permitir que la mente repase la patología del tirón sin saltar caóticamente entre temas:

### 1. Tablero Resumen de Temas y Subtemas (al inicio)
Tabla sintética que desglosa tanto el rendimiento por **Tema** como los **Subtemas específicos** contenidos en la tirada (número de preguntas, aciertos, porcentaje y nivel de prioridad: **🔴 Crítica** si $<60\%$, **🟠 Mejorable** si $<75\%$, **🟢 Firme** si $\ge 75\%$).

### 2. Bloques Temáticos (Nivel 1)
* Los temas se ordenan **de menor a mayor porcentaje de acierto** (los temas más flojos o con más fallos aparecen arriba del todo).
* Si la tirada es multiasignatura (ej. Cardiología + Digestivo), se respeta la jerarquía **Asignatura $\to$ Tema**.

### 3. Subtemas y Clústeres de Preguntas Relacionadas (Nivel 2)
* **Prohibido listar preguntas como fichas sueltas sin conexión:** Dentro de cada tema, las preguntas se agrupan bajo su **Subtema específico** (ej. *Subtema: Hipertensión Portal y Varices*, *Subtema: Glomerulonefritis membranoproliferativa*).
* **🧬 Clúster Clínico de Preguntas Relacionadas ($\ge 2$ preguntas afines):**
  - Siempre que 2 o más preguntas de la tirada traten sobre la misma patología, el mismo síndrome o diagnósticos diferenciales enfrentados, se agrupan bajo un encabezado de clúster:
    `### 🧬 Clúster Clínico: <Subtema / Concepto Común> (<N> preguntas interrelacionadas: Q<x>, Q<y>)`
  - Se añade una llamada explicativa de nexo:
    `> 💡 **Interrelación de la Tirada:** Este bloque conecta las preguntas [Q...] sobre *<Subtema>*. Compara en paralelo los datos pivote y síntomas guía que diferencian cada caso.`

### 4. Orden dentro de cada Subtema o Clúster (Nivel 3)
1. 🔴 **Fallos con seguridad 🟢 Verde:** Falsos amigos / sesgos cognitivos (máxima prioridad).
2. 🟠 **Fallos con duda 🟠 Naranja o 🔴 Roja:** Lagunas conceptuales del tema.
3. 🟡 **Aciertos frágiles:** Preguntas que acertaste pero marcadas con duda (🟠/🔴) o habiendo descartado inicialmente la correcta, para consolidar el acierto.

*(Nota: Las preguntas acertadas con seguridad 🟢 Verde sin incidencias NO se incluyen en la guía para no sobrecargar la corrección).*

---

## 4. Formato Estricto de Cada Pregunta («Espejo Clínico» e Interrelación Cruzada)

### 🚨 Regla de Oro del Triaje (Evitar Sobrecorrección):
Para no quemar energía mental en anécdotas y evitar atascarse en la corrección:
* **🔥 Pregunta Nuclear / Rentable (Tema Top MIR o $\ge 35\%$ acierto CTO):** Se analiza a fondo según las plantillas A, B o C (desmontaje clínico, nexo con preguntas afines de la tirada, descartes y tarjeta Anki).
* **📡 Pregunta Satélite / Marciana (Tema infrecuente / anecdótico o $< 35\%$ acierto CTO):** Se procesa en **MODO TELEGRAMA (10 segundos)** usando la plantilla D. No se desarrollan los descartes de las 4 opciones para no sobrecargar de teoría estéril.

---

### A. Fallo Nuclear con Justificación Escrita (`justificacion` no vacía):
```markdown
### X. `Q<orden>` · <Asignatura> / <Tema> / <Subtema> (❌ Fallo · <Semáforo Confianza> · Dif <Dificultad>)
* **Convocatoria oficial:** <Convocatoria oficial>.
* **Enunciado completo:** <Texto literal íntegro con las palabras gatillo y datos pivote en **negrita**>.
* ❌ **Marcaste (<letra>):** *<Texto textual de la opción marcada>*.
* ✅ **Correcta (<letra>):** ***<Texto textual de la opción correcta>***.
* 💬 **Tu justificación al responder:** *"<Texto literal que escribió el alumno>"*
* **🎯 Desmontaje del razonamiento («Espejo Clínico»):**
  • **Premisa acertada:** <Qué dato o concepto vio muy bien el alumno en el enunciado>.
  • **Dato ciego / Trampa que te desvió:** <Qué dato clave, síntoma negativo o matiz diferencial pasó por alto o malinterpretó>.
  • **Regla de decisión MIR:** <Regla directa y nemotécnica en 1 línea para no volver a dudar jamás en ese diagnóstico>.
* 🔗 **Nexo Clínico e Interrelación con Q<otra> (si existe en la tirada):**
  <Contraste directo: "En Q<otra> la presencia de X condicionaba conducta A, mientras que aquí el dato pivote Y obliga a elegir B" o "Patrón de sesgo repetido: en ambas preguntas te hizo dudar el distractor Z">.
* ✂️ **Por qué son falsas las demás opciones (descartes clave):**
  • **Opción X** *(no descartada)*: <Motivo clínico o farmacológico exacto de exclusión>.
  • **Opción Y** *(tu elección errónea)*: <Por qué no aplica al caso>.
* **🃏 Anki sugerida:** <Propuesta atómica de tarjeta respondible en ≤3 segundos>.
```

### B. Fallo Nuclear sin Justificación Escrita:
```markdown
### X. `Q<orden>` · <Asignatura> / <Tema> / <Subtema> (❌ Fallo · <Semáforo Confianza> · Dif <Dificultad>)
* **Convocatoria oficial:** <Convocatoria oficial>.
* **Enunciado completo:** <Texto literal íntegro con las palabras gatillo y datos pivote en **negrita**>.
* ❌ **Marcaste (<letra>):** *<Texto textual de la opción marcada>*.
* ✅ **Correcta (<letra>):** ***<Texto textual de la opción correcta>***.
* **🎯 Concepto clave / Por qué fallaste:** <Explicación clínica y fisiopatológica directa en 1–2 líneas contrastando tu opción contra la correcta>.
* 🔗 **Nexo Clínico e Interrelación con Q<otra>:** <Diferencial directo frente a la otra pregunta afín de la tirada o frente al algoritmo del subtema>.
* ✂️ **Por qué son falsas las demás opciones (descartes clave):**
  • **Opción X** *(no descartada / tu error)*: <Dato clínico de exclusión>.
  • **Opción Y** *(no descartada)*: <Dato clínico de exclusión>.
* **🃏 Anki sugerida:** <Propuesta atómica de tarjeta respondible en ≤3 segundos>.
```

### C. Acierto Frágil (acertada con duda 🟠/🔴):
```markdown
### X. `Q<orden>` · <Asignatura> / <Tema> / <Subtema> (✅ Acierto frágil · <Semáforo Confianza> · Dif <Dificultad>)
* **Convocatoria oficial:** <Convocatoria oficial>.
* **Enunciado completo:** <Texto literal íntegro con negritas clínicas>.
* ✅ **Marcaste y Correcta (<letra>):** ***<Texto textual de la opción correcta>*** *(Acierto con duda / habiendo descartado la correcta)*.
* 💬 **Tu justificación al responder:** *"<Texto literal del alumno>"* (si existe).
* **🎯 Consolidación del Acierto Frágil:** <Explicación en 1 línea del dato discriminador que convierte la duda en una certeza automática>.
* 🔗 **Nexo Clínico e Interrelación con Q<otra>:** <Cómo consolida o complementa el concepto visto en la otra pregunta de la tirada>.
* ✂️ **Por qué son falsas las demás opciones (descartes clave):**
  • **Opción X** *(la opción que te hacía dudar)*: <Por qué queda descartada con seguridad>.
* **🃏 Anki sugerida:** <Propuesta atómica de tarjeta respondible en ≤3 segundos>.
```

### D. Fallo en Pregunta Satélite / Marciana (📡 MODO TELEGRAMA · 10 segundos):
```markdown
### X. `Q<orden>` · <Asignatura> / <Tema> / <Subtema> (📡 Pregunta Satélite · Dif <Dificultad>)
* **Convocatoria oficial:** <Convocatoria oficial>.
* **Enunciado completo:** <Texto literal íntegro>.
* ❌ **Marcaste (<letra>):** *<Texto de tu opción>* | ✅ **Correcta (<letra>):** ***<Texto opción correcta>***.
* **⚡ Perla directa (10s):** <Regla directa de 1 frase: "Ante X, la respuesta es Y porque Z">.
* **❌ Por qué la tuya no:** <Diferencial ultra-rápido de 1 línea sin rollo>.
*(Nota: No se generan descartes enciclopédicos de las demás opciones ni se exige memorizar el contexto para no quemar batería mental en temas de baja rentabilidad).*
```

---

## 5. Inyección Reactiva en Anki (`MIR 2027`)
- **Búsqueda bajo demanda:** La propuesta `🃏 Anki sugerida` ya está redactada en la guía. Solo se inyecta en `collection.anki2` **cuando el alumno lo solicite expresamente**.
- Comprueba que Anki esté cerrado antes de inyectar (`is_anki_running()` en `scripts/anki_visual_builder.py`).
- Cumple la **Regla de 3 Segundos**: anverso cerrado con 1 dato + reverso con caja verde de respuesta directa en 1–4 palabras.
- Admite tarjetas `Basic` (`insert_new_visual_cards`) y tarjetas `Cloze` (`insert_cloze_card`).
