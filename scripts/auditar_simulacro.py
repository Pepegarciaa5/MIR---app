#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditor Automático de Simulacros CTO
====================================
Uso:
  python3 scripts/auditar_simulacro.py           # Audita el último simulacro disponible
  python3 scripts/auditar_simulacro.py --sim 19  # Audita el Simulacro 19 específicamente

Genera:
  1. Resumen por consola de métricas globales, fatiga por tramos (Q1-50, Q51-100, Q101-150, Q151-200, Q201-210)
     y desglose en los 4 Bloques de Prioridad (≥70%, 50-69%, 35-49%, <35%).
  2. Archivo /tmp/s{N}_audit.json con el texto completo, opciones, respuesta marcada, correcta
     y comentario oficial de CTO.
  3. Esqueleto Markdown /tmp/guia_sim{N}_esqueleto.md con enunciados 100% literales y formato oficial.
"""

import os
import re
import sys
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CTO_JSON = os.path.join(ROOT_DIR, "src", "data", "simulacrosCTO.json")
TEXTOS_JSON = os.path.join(ROOT_DIR, "src", "data", "simulacros_textos.json")


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(text))
    text = re.sub(r"&nbsp;", " ", text)
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def generate_markdown_skeleton(sim_num, sim_info, audit_items, sim_qs, cuenta_total, out_path):
    st = sim_info["stats"]
    netas = st["neta"] / 3.0 if st["neta"] > 210 else st["neta"]
    percentil = int(round((st.get("percentil_total") or 0) * 100))

    b1 = [x for x in audit_items if x["pct"] >= 70]
    b2 = [x for x in audit_items if 50 <= x["pct"] < 70]
    b3 = [x for x in audit_items if 35 <= x["pct"] < 50]
    b4 = [x for x in audit_items if x["pct"] < 35]

    out = []
    out.append(f"# ⚡ Guía de Corrección Rápida — Simulacro {sim_num}")
    out.append(
        f"> **Resultado global:** **{st['acertadas']} Aciertos** · **{st['falladas']} Fallos** · **{st['nulas']} Blancas** "
        f"= **{netas:.2f} Netas** (Percentil {percentil}) | **Muestra:** {cuenta_total} alumnos  "
    )
    out.append("")
    out.append("---")
    out.append("")
    out.append("## ⏱️ Rendimiento por Tramos (Control de Fatiga)")
    out.append("")
    out.append("| Tramo | Preguntas | Acierto Tú | Media Academia | Balance | Blancas | Fallos Fáciles (≥70%) |")
    out.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")

    for a, b in [(1, 50), (51, 100), (101, 150), (151, 200), (201, 210)]:
        sub = [q for q in sim_qs if a <= q["numero"] <= b]
        if not sub:
            continue
        u_acc = sum(1 for q in sub if q["acertada"]) / len(sub) * 100
        p_acc = sum((q.get("pct_correcta") or 0) / cuenta_total * 100 for q in sub) / len(sub)
        f_easy = sum(1 for q in sub if not q["acertada"] and ((q.get("pct_correcta") or 0) / cuenta_total * 100) >= 70)
        blancas_tramo = sum(1 for q in sub if q.get("nula") == 1)
        tramo_label = f"Q{a:03d}–Q{b:03d}" + (" (Reservas)" if a >= 201 else "")
        dif_str = f"+{u_acc - p_acc:.1f}%" if (u_acc - p_acc) >= 0 else f"{u_acc - p_acc:.1f}%"
        out.append(
            f"| **{tramo_label}** | {len(sub)} | **{u_acc:.1f}%** | {p_acc:.1f}% | **{dif_str}** | {blancas_tramo} | {f_easy} |"
        )

    out.append("")
    out.append("---")
    out.append("")

    def format_question(idx, it):
        num = it["numero"]
        asig = it["asignatura"]
        pct = it["pct"]
        is_reserva = num >= 201
        is_blanca = it.get("nula") == 1
        used_descartes = it.get("dudas") == 1

        badge = ""
        if is_reserva:
            badge = "[📌 `Reserva`]"
        elif is_blanca:
            badge = "[⚪ `Dejada en blanco`]"
        elif used_descartes:
            badge = "[✂️ `Con descartes`]"
        else:
            badge = "[🎯 `Sin descartes`]"

        lines = []
        lines.append(f"### {idx}. `Q{num:03d}` · {asig} ({pct}% pob) — *[TITULO_CONCEPTO]* {badge}")
        lines.append(f"* **Enunciado completo:** {it['enun']}")
        if is_blanca:
            lines.append(f"* ⚪ **Dejada en blanco (No contestada).**")
            lines.append(f"* ✅ **Correcta ({it['respuesta_correcta']}):** ***{it['respCorr']}***.")
        else:
            lines.append(f"* ❌ **Marcaste ({it['respuesta_dada']}):** *{it['respDada']}* ({it.get('samePct', 0)}% pob).")
            lines.append(f"* ✅ **Correcta ({it['respuesta_correcta']}):** ***{it['respCorr']}***.")
        lines.append(f"* **🎯 Por qué fallaste / Concepto clave:** [ANÁLISIS_CLÍNICO_FISIOPATOLÓGICO]")

        # Descartes de distractores clave
        opciones = it.get("opciones", {})
        corr_num = it.get("respuesta_correcta")
        dada_num = it.get("respuesta_dada")
        same_pct = it.get("samePct", 0)

        distractores = [k for k in sorted(opciones.keys()) if k != corr_num]
        if distractores:
            lines.append(f"* ✂️ **Por qué son falsas las demás opciones (descartes clave):**")
            for num_opt in distractores:
                txt = opciones.get(num_opt, "")
                txt_short = (txt[:65] + "...") if len(txt) > 65 else txt
                extra = ""
                if num_opt == dada_num and not is_blanca:
                    extra = f" *(tu elección · trampa del {same_pct}% pob)*"
                lines.append(f"  • **Opción {num_opt}** ({txt_short}){extra}: [POR_QUÉ_SE_DESCARTA]")

        lines.append(f"* **🃏 Anki sugerida:** [ANKI_SUGERIDA]")
        lines.append("")
        return "\n".join(lines)

    # Bloque 1
    out.append(f"## 🔴 BLOQUE 1: Las «Imperdonables» (≥ 70% de acierto en la academia — {len(b1)} preguntas)")
    out.append("> *Objetivo: Análisis quirúrgico de despistes de lectura, prisas o trampas de opción en preguntas masivas.*")
    out.append("")
    for i, it in enumerate(b1, 1):
        out.append(format_question(i, it))
    out.append("---")
    out.append("")

    # Bloque 2
    out.append(f"## 🟠 BLOQUE 2: Preguntas Asequibles (50% – 69% de acierto en la academia — {len(b2)} preguntas)")
    out.append("> *Objetivo: Consolidar conceptos estándar de dificultad media que te colocan por encima de la media de CTO.*")
    out.append("")
    for i, it in enumerate(b2, 1):
        out.append(format_question(i, it))
    out.append("---")
    out.append("")

    # Bloque 3
    out.append(f"## 🟡 BLOQUE 3: Discriminación P80 (35% – 49% de acierto en la academia — {len(b3)} preguntas)")
    out.append("> *Objetivo: Las preguntas que marcan la diferencia para entrar al Percentil 80 (detalles diagnósticos finos).*")
    out.append("")
    for i, it in enumerate(b3, 1):
        out.append(format_question(i, it))
    out.append("---")
    out.append("")

    # Bloque 4
    out.append(f"## 📡 BLOQUE 4: Radar de Cosas Nuevas / Difíciles (< 35% de acierto en la academia — {len(b4)} preguntas)")
    out.append("> *Objetivo: Preguntas muy difíciles o atípicas; capturar el anclaje si cae de nuevo sin gastar energía excesiva.*")
    out.append("")
    for i, it in enumerate(b4, 1):
        out.append(format_question(i, it))

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"✅ Esqueleto Markdown de Simulacro generado con enunciados 100% literales en: {out_path}")


def main():
    with open(CTO_JSON, "r", encoding="utf-8") as f:
        cto = json.load(f)
    with open(TEXTOS_JSON, "r", encoding="utf-8") as f:
        textos = json.load(f)

    sim_num = None
    if "--sim" in sys.argv:
        idx = sys.argv.index("--sim")
        if idx + 1 < len(sys.argv):
            sim_num = int(sys.argv[idx + 1])
    if sim_num is None:
        sim_num = max(s["numero"] for s in cto["simulacros"])

    sim_info = [s for s in cto["simulacros"] if s["numero"] == sim_num][-1]
    cuenta_total = sim_info["stats"].get("cuenta_total") or 1
    sim_qs = [q for q in cto["preguntas"] if q["simulacro"] == sim_num]
    text_map = {q["numero"]: q for q in textos if str(q.get("simulacro")) == str(sim_num)}

    print(f"============================================================")
    print(f"📊 AUDITORÍA AUTOMÁTICA · SIMULACRO {sim_num} ({sim_info.get('nombre')})")
    print(f"============================================================")
    st = sim_info["stats"]
    netas = st["neta"] / 3.0 if st["neta"] > 210 else st["neta"]
    print(f"• Acertadas: {st['acertadas']} | Falladas: {st['falladas']} | Blancas/Nulas: {st['nulas']}")
    print(f"• Netas: {netas:.2f} | Percentil CTO: P{int(round((st.get('percentil_total') or 0)*100))} (Muestra: {cuenta_total} alumnos)")

    print("\n--- ⏱️ RENDIMIENTO POR TRAMOS DE 50 PREGUNTAS (CONTROL DE FATIGA) ---")
    for a, b in [(1, 50), (51, 100), (101, 150), (151, 200), (201, 210)]:
        sub = [q for q in sim_qs if a <= q["numero"] <= b]
        if not sub:
            continue
        u_acc = sum(1 for q in sub if q["acertada"]) / len(sub) * 100
        p_acc = sum((q.get("pct_correcta") or 0) / cuenta_total * 100 for q in sub) / len(sub)
        f_easy = sum(1 for q in sub if not q["acertada"] and ((q.get("pct_correcta") or 0) / cuenta_total * 100) >= 70)
        blancas_tramo = sum(1 for q in sub if q.get("nula") == 1)
        print(f"  Q{a:03d}–Q{b:03d}: Tú = {u_acc:5.1f}% | Academia = {p_acc:5.1f}% | Dif = {u_acc - p_acc:+5.1f}% | Blancas = {blancas_tramo} | Perdidas fáciles (≥70%) = {f_easy}")

    audit_items = []
    for q in sorted(sim_qs, key=lambda x: x["numero"]):
        num = q["numero"]
        t = text_map.get(num, {})
        if q.get("acertada") == 1 or t.get("anulada"):
            continue
        respuestas = t.get("respuestas", [])
        opciones_dict = {r["numero"]: strip_html(r["enunciado"]) for r in respuestas}
        resp_dada_num = q.get("respuesta_dada") or 0
        resp_corr_num = q.get("respuesta_correcta") or 0
        resp_dada_txt = opciones_dict.get(resp_dada_num, "EN BLANCO (No contestada)")
        resp_corr_txt = opciones_dict.get(resp_corr_num, "")
        pct = round((q.get("pct_correcta") or 0) / cuenta_total * 100, 1)
        same_pct = round((q.get("pct_misma_respuesta") or 0) / cuenta_total * 100, 1)
        clasif = q.get("clasificaciones") or []
        asig_nombre = clasif[0] if len(clasif) > 0 else q.get("asignatura", "")
        tema_nombre = " / ".join(clasif[1:]) if len(clasif) > 1 else ""

        audit_items.append({
            "numero": num,
            "asignatura_cod": q.get("asignatura"),
            "asignatura": asig_nombre,
            "tema": tema_nombre,
            "pct": pct,
            "samePct": same_pct,
            "respuesta_dada": resp_dada_num,
            "respuesta_correcta": resp_corr_num,
            "nula": q.get("nula", 0),
            "dudas": q.get("dudas", 0),
            "tiempo": q.get("tiempo", 0),
            "ignorar": bool(q.get("ignorar")),
            "enun": strip_html(t.get("enunciado", "")),
            "opciones": opciones_dict,
            "respDada": resp_dada_txt,
            "respCorr": resp_corr_txt,
            "coment": strip_html(t.get("comentario", ""))
        })

    b1 = [x for x in audit_items if x["pct"] >= 70]
    b2 = [x for x in audit_items if 50 <= x["pct"] < 70]
    b3 = [x for x in audit_items if 35 <= x["pct"] < 50]
    b4 = [x for x in audit_items if x["pct"] < 35]

    print("\n--- 🎯 DISTRIBUCIÓN DE FALLOS/BLANCAS POR BLOQUE DE PRIORIDAD ---")
    print(f"  🔴 Bloque 1 (≥70% pob · Fallos Prohibidos):      {len(b1)} preguntas")
    print(f"  🟠 Bloque 2 (50–69% pob · Asequibles):           {len(b2)} preguntas")
    print(f"  🟡 Bloque 3 (35–49% pob · Discriminación P80):   {len(b3)} preguntas")
    print(f"  📡 Bloque 4 (<35% pob · Radar Cosas Nuevas):     {len(b4)} preguntas")
    print(f"  Total a revisar: {len(audit_items)} preguntas")

    out_json = f"/tmp/s{sim_num}_audit.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(audit_items, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Auditoría JSON guardada en: {out_json}")

    out_md = f"/tmp/guia_sim{sim_num}_esqueleto.md"
    generate_markdown_skeleton(sim_num, sim_info, audit_items, sim_qs, cuenta_total, out_md)


if __name__ == "__main__":
    main()
