# -*- coding: utf-8 -*-
import json
import os
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import generate_clinical_db as db

AUDIT_JSON = "/tmp/tirada_audit.json"
TARGET_FILE = "/tmp/guia_final.md"

with open(AUDIT_JSON, "r", encoding="utf-8") as f:
    audit_data = json.load(f)

meta = audit_data["meta"]
items = audit_data["items"]
m = meta["metricas"]

# Map item id or order to clinical data
# We know items[idx] corresponds to db.CLINICAL_DATA[idx + 1]
item_to_clin = {it["orden"]: db.CLINICAL_DATA[idx + 1] for idx, it in enumerate(items)}

# Group items by topic
# First compute statistics for all topics in the entire tirada
# Let's count totals per topic from the full tirada in src/data/ultima_tirada.json or from items
with open("src/data/ultima_tirada.json", "r", encoding="utf-8") as f:
    full_tirada = json.load(f)

preguntas_full = full_tirada.get("preguntas", [])

stats_por_tema = {}
for p in preguntas_full:
    t = p.get("tema") or "General"
    if t not in stats_por_tema:
        stats_por_tema[t] = {"total": 0, "aciertos": 0, "fallos": 0}
    stats_por_tema[t]["total"] += 1
    if p.get("isCorrect"):
        stats_por_tema[t]["aciertos"] += 1
    else:
        stats_por_tema[t]["fallos"] += 1

for t, st in stats_por_tema.items():
    st["pct"] = (st["aciertos"] / st["total"]) * 100.0 if st["total"] > 0 else 0.0

# Sort topics by lowest pct first, then by most fallos, then name
temas_ordenados = sorted(
    stats_por_tema.keys(),
    key=lambda t: (stats_por_tema[t]["pct"], -stats_por_tema[t]["fallos"], t)
)

items_audit_por_tema = {}
for it in items:
    t = it.get("tema") or "General"
    items_audit_por_tema.setdefault(t, []).append(it)

# Within each topic, sort items:
# 1. Fallos con Verde (falsos amigos)
# 2. Fallos con Naranja/Rojo
# 3. Aciertos frágiles
def item_sort_key(it):
    is_ok = it.get("isCorrect", False)
    conf = it.get("confidence", "green")
    if not is_ok:
        if conf == "green":
            return (1, it.get("orden", 0))
        else:
            return (2, it.get("orden", 0))
    else:
        return (3, it.get("orden", 0))

for t in items_audit_por_tema:
    items_audit_por_tema[t].sort(key=item_sort_key)

out = []
out.append(f"# 🩺 Guía de Corrección Quirúrgica · Tirada de {meta['asignatura']}")
out.append(f"> **Fecha y Hora:** {meta['fecha_humana']} | **Materia:** {meta['asignatura']}")
out.append(f"> **Resultado Global:** **{m['aciertos']}/{m['total']} aciertos** ({m['pct_acierto']}%) | **{m['netas']} Netas oficiales** (Fallos: {m['fallos']}, Blancas: {m['blancas']}).\n")

out.append("---")
out.append("")
out.append("## 📊 Tablero de Rendimiento por Temas y Subtemas")
out.append("> *📌 Temas ordenados de menor a mayor acierto para corregir lo urgente primero.*")
out.append("")
out.append("| Tema / Subtema | Preguntas | Aciertos | % Acierto | Fallos / Dudas a Revisar | Prioridad |")
out.append("| :--- | :---: | :---: | :---: | :---: | :---: |")

for t in temas_ordenados:
    st = stats_por_tema[t]
    n_audit = len(items_audit_por_tema.get(t, []))
    if n_audit == 0:
        continue
    if st["pct"] < 60:
        prio = "🔴 **Crítica**"
    elif st["pct"] < 75:
        prio = "🟠 **Mejorable**"
    else:
        prio = "🟢 **Firme**"
    out.append(f"| **{t}** | {st['total']} | {st['aciertos']} | **{st['pct']:.1f}%** | {n_audit} preguntas | {prio} |")

out.append("")
out.append("---")
out.append("")

global_idx = 1
for t in temas_ordenados:
    t_items = items_audit_por_tema.get(t, [])
    if not t_items:
        continue
    st = stats_por_tema[t]
    out.append(f"## 📁 {t} · ({st['aciertos']}/{st['total']} aciertos — {st['pct']:.1f}%)\n")

    for it in t_items:
        q_ord = it["orden"]
        clin = item_to_clin.get(q_ord, {})
        is_ok = it.get("isCorrect", False)
        conf = it.get("confidence", "green")
        conf_map = {"green": "🟢 Segura", "orange": "🟠 Duda", "red": "🔴 Riesgo"}
        conf_str = conf_map.get(conf, "🟢 Segura")
        status_badge = "✅ Acierto frágil" if is_ok else "❌ Fallo"
        dif = it.get("dificultad", 3)
        conv = it.get("convocatoria", "")

        out.append(f"### {global_idx}. `Q{q_ord:02d}` · {it['asignatura']} / {t} ({status_badge} · {conf_str} · Dif {dif})")
        if conv:
            out.append(f"* **Convocatoria oficial:** {conv}.")
        
        enun_text = clin.get("enun_bold") or it.get("enun", "")
        out.append(f"* **Enunciado completo:** {enun_text}")

        sel_letter = it.get("selectedLetter", "")
        corr_letter = it.get("correctLetter", "")
        opciones = it.get("opciones", {})
        resp_dada = it.get("respDada", opciones.get(sel_letter, ""))
        resp_corr = it.get("respCorr", opciones.get(corr_letter, ""))

        if is_ok:
            out.append(f"* ✅ **Marcaste y Correcta ({sel_letter}):** ***{resp_corr}*** *(Acierto con duda / de riesgo consolidado)*.")
        else:
            out.append(f"* ❌ **Marcaste ({sel_letter}):** *{resp_dada}*")
            if corr_letter:
                out.append(f"* ✅ **Correcta ({corr_letter}):** ***{resp_corr}***")
            else:
                out.append(f"* ⚠️ **Pregunta ANULADA por el Ministerio:** No se asigna respuesta válida definitiva.")

        justif = it.get("justificacion", "").strip()
        if justif:
            out.append(f'* 💬 **Tu justificación al responder:** *"{justif}"*')
            esp = clin.get("espejo", {})
            if esp:
                out.append(f"* **🎯 Desmontaje del razonamiento («Espejo Clínico»):**")
                out.append(f"  • **Premisa acertada:** {esp.get('premisa', '')}")
                out.append(f"  • **Dato ciego / Trampa que te desvió:** {esp.get('trampa', '')}")
                out.append(f"  • **Regla de decisión MIR:** {esp.get('regla', '')}")
            elif is_ok and clin.get("consolidacion"):
                out.append(f"* **🎯 Consolidación del Acierto Frágil:** {clin.get('consolidacion')}")
            elif not is_ok and clin.get("concepto_clave"):
                out.append(f"* **🎯 Concepto clave / Por qué fallaste:** {clin.get('concepto_clave')}")
        else:
            if not is_ok:
                out.append(f"* **🎯 Concepto clave / Por qué fallaste:** {clin.get('concepto_clave', '')}")
            else:
                out.append(f"* **🎯 Consolidación del Acierto Frágil:** {clin.get('consolidacion', '')}")

        # Descartes de opciones
        descartes = clin.get("descartes", {})
        if descartes:
            out.append(f"* ✂️ **Por qué son falsas las demás opciones (descartes clave):**")
            for let, mot in descartes.items():
                opt_txt = opciones.get(let, "")
                opt_short = (opt_txt[:55] + "...") if len(opt_txt) > 55 else opt_txt
                tag = ""
                if not is_ok and let == sel_letter:
                    tag = " *(tu elección errónea)*"
                out.append(f"  • **Opción {let}** ({opt_short}){tag}: {mot}")

        # Anki
        anki_txt = clin.get("anki", "")
        if anki_txt:
            out.append(f"* **🃏 Anki sugerida:**\n  {anki_txt}")

        out.append("")
        out.append("---")
        out.append("")
        global_idx += 1

content = "\n".join(out)
with open(TARGET_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Generated {global_idx - 1} questions in {TARGET_FILE}")
print(f"File size: {os.path.getsize(TARGET_FILE)} bytes")
