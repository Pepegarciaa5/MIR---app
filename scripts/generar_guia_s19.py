#!/usr/bin/env python3
import json
import re
import os

AUDIT_PATH = "/tmp/s19_audit.json"
ARTIFACT_PATH = "/Users/hola/.gemini/antigravity/brain/9a114fd9-340f-4086-8b4f-8109903e4aa1/guia_correccion_simulacro_19.md"

with open(AUDIT_PATH, "r", encoding="utf-8") as f:
    questions = json.load(f)

# Ordenar por bloques
b1 = [q for q in questions if (q.get("pct") or 0) >= 70]
b2 = [q for q in questions if 50 <= (q.get("pct") or 0) < 70]
b3 = [q for q in questions if 35 <= (q.get("pct") or 0) < 50]
b4 = [q for q in questions if (q.get("pct") or 0) < 35]

def clean_html(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def summarize_case(enun):
    clean = clean_html(enun)
    # Extract first 1-2 sentences
    sentences = re.split(r'(?<=[.?!])\s+', clean)
    if len(sentences) >= 2:
        res = " ".join(sentences[:2])
    else:
        res = clean[:180] + ("..." if len(clean) > 180 else "")
    return res

def format_question_block(q, idx):
    num = q["numero"]
    asig = q["asignatura"]
    tema = q["tema"]
    pct = q.get("pct", 0)
    same_pct = q.get("samePct", 0)
    resp_dada = q.get("respDada") or "En blanco / No contestada"
    resp_corr = q.get("respCorr") or "No disponible"
    coment = clean_html(q.get("coment") or "")
    
    # Anki check
    has_anki = bool(q.get("anki_matches") and len(q["anki_matches"]) > 0)
    anki_badge = " [✅ `YA EN TU ANKI`]" if has_anki else ""
    
    case_summary = summarize_case(q["enun"])
    
    # Sintetizar comentario
    coment_summary = coment[:250] + ("..." if len(coment) > 250 else "") if coment else "Revisar fisiopatología y criterio diagnóstico del tema."
    
    lines = [
        f"### {idx}. `Q{num:03d}` · {asig} › {tema} ({pct}% pob){anki_badge}",
        f"* **Caso:** {case_summary}",
        f"* ❌ **Marcaste (Opción {q.get('respuesta_dada', '-')}):** *{clean_html(resp_dada)}* (el {same_pct}% de la academia marcó lo mismo).",
        f"* ✅ **Correcta (Opción {q.get('respuesta_correcta', '-')}):** ***{clean_html(resp_corr)}***.",
        f"* **🎯 Concepto clave / Por qué fallaste:** {coment_summary}",
        f"* **🃏 Anki sugerida:** *{asig}: {tema}* → Diferencial directo entre la opción elegida y la correcta.",
        ""
    ]
    return "\n".join(lines)

doc = []

# Encabezado
doc.append("# 📋 Guía Rápida de Corrección · Simulacro 19 (CTO MIR)")
doc.append("")
doc.append("> [!IMPORTANT]")
doc.append("> **Radiografía Global del Simulacro 19**")
doc.append("> * **Netas:** **104.67** (127 aciertos · 67 fallos · 6 blancas)")
doc.append("> * **Percentil:** **P47** (Muestra: 2.079 alumnos)")
doc.append("> * **El potencial inmediato a P80:** Los **12 fallos del Bloque 1** (preguntas que acierta más del 70% de la academia) restaron **16.0 netas directas**. Solo corrigiendo estos fallos 'prohibidos', el examen se sitúa en **120.67 netas (Percentil 75–80)**.")
doc.append("")
doc.append("---")
doc.append("")
doc.append("## ⏱️ Control de Fatiga y Rendimiento en tu ORDEN CRONOLÓGICO REAL")
doc.append("Tu secuencia real de examen fue:")
doc.append("1. **Tramo 1 (Q025–Q100)**: Arrancaste por el bloque de texto puro de la primera mitad.")
doc.append("2. **Tramo 2 (Q001–Q024)**: Saltaste al bloque inicial de imágenes clínicas.")
doc.append("3. **Tramo 3 (Q101–Q160)**: Segunda mitad de texto.")
doc.append("4. **Tramo 4 (Q201–Q210)**: Saltaste a las preguntas de reserva.")
doc.append("5. **Tramo 5 (Q161–Q200)**: Finalizaste el examen con el tramo previo a reservas.")
doc.append("")
doc.append("| Orden Cronológico | Preguntas | Tu % Acierto | % Academia | Balance vs Academia | Tiempo Invertido | Ritmo (s/p) | Fallos Fáciles (≥70%) | Diagnóstico |")
doc.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |")
doc.append("| **1º. Q025 – Q100** | 76 | **67.1%** | 63.2% | **+3.9%** | 64 min 58s | 51.3s | 5 | 🟢 Arranque muy fresco y ritmo ágil |")
doc.append("| **2º. Q001 – Q024** | 24 | **54.2%** | 55.7% | -1.6% | 27 min 55s | 69.8s | 0 | 🔍 Bloque imágenes (0 fallos fáciles) |")
doc.append("| **3º. Q101 – Q160** | 60 | **68.3%** | 64.4% | **+4.0%** | 48 min 48s | 48.8s | 3 | 🔥 Máximo rendimiento (+4% vs academia) |")
doc.append("| **4º. Q201 – Q210** | 10 | **20.0%** | 37.6% | **-17.6%** | 13 min 50s | 83.0s | 0 | 🛑 Atasco en reservas (-0.33 netas) |")
doc.append("| **5º. Q161 – Q200** | 40 | **55.0%** | 62.0% | **-7.0%** | 33 min 50s | 50.8s | 4 | ⚠️ **Muro de fatiga final** (4 fallos Bloque 1) |")
doc.append("")
doc.append("> [!TIP]")
doc.append("> **Conclusión Táctica Crucial:**")
doc.append("> * **Durante las primeras 160 preguntas (Tramos 1, 2 y 3)** llevabas un ritmo sobresaliente de **87.67 netas en 160 preguntas**, equivalente a **115 netas globales (Percentil 65–70)**.")
doc.append("> * **El colapso se produjo en los últimos dos tramos:**")
doc.append(">   1. En el **Tramo 4 (Reservas)** perdiste casi **14 minutos** para 10 preguntas muy atípicas que te dejaron en negativo (-0.33 netas).")
doc.append(">   2. Al volver al **Tramo 5 (Q161–Q200)** con más de 2 horas y media de cansancio acumulado, sufriste **visión túnel**: cayeron 4 preguntas del Bloque 1 (≥70% pob), incluyendo la de Obesidad/Síndrome Metabólico (¡que acertó el 95% de la academia!).")
doc.append("> * **Recomendación para el S20:** No dejes un bloque denso de preguntas oficiales (Q161–Q200) para el final tras haber hecho las reservas. O bien haz el examen corrido (1 a 200 y reservas al final) o, si saltas, asegúrate de no meterte en el bucle de sobre-pensar las reservas cuando te queden 40 preguntas troncales por resolver.")
doc.append("")
doc.append("---")
doc.append("")

# BLOQUE 1
doc.append("## 🔴 BLOQUE 1 · «Fallos Prohibidos» (≥ 70% Acierto en Academia)")
doc.append("> [!WARNING]")
doc.append("> Estas 12 preguntas fueron acertadas por 7 de cada 10 opositores. Representan **+16.0 netas netas recuperables** prioritarias para alcanzar P80.")
doc.append("")
for i, q in enumerate(b1, 1):
    doc.append(format_question_block(q, i))

# BLOQUE 2
doc.append("---")
doc.append("")
doc.append("## 🟠 BLOQUE 2 · «Preguntas Asequibles» (50% – 69% Acierto en Academia)")
doc.append("> Conceptos de dificultad media que marcan el paso de percentil 50 a percentil 70.")
doc.append("")
for i, q in enumerate(b2, 1):
    doc.append(format_question_block(q, i))

# BLOQUE 3
doc.append("---")
doc.append("")
doc.append("## 🟡 BLOQUE 3 · «Discriminación P80» (35% – 49% Acierto en Academia)")
doc.append("> Preguntas donde se decide el percentil 80. Suelen contener diagnósticos diferenciales finos o algoritmos de 2ª línea.")
doc.append("")
for i, q in enumerate(b3, 1):
    doc.append(format_question_block(q, i))

# BLOQUE 4
doc.append("---")
doc.append("")
doc.append("## 📡 BLOQUE 4 · «Radar de Cosas Nuevas / Complejas» (< 35% Acierto)")
doc.append("> Preguntas difíciles o atípicas falladas por la inmensa mayoría de la academia. Lectura rápida sin flagelarse.")
doc.append("")
for i, q in enumerate(b4, 1):
    doc.append(format_question_block(q, i))

content = "\n".join(doc)

with open(ARTIFACT_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"✅ Artefacto generado con éxito en: {ARTIFACT_PATH}")
print(f"Total caracteres: {len(content)}")
