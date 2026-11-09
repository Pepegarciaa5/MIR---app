#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditor Automático de Tiradas de Preguntas (Modo Examen)
========================================================
Funciona 100% OFFLINE (sin depender de Supabase):
Busca automáticamente la tirada más reciente entre:
  1. Portapapeles de macOS (`pbpaste`), si contiene un JSON con `"tipo": "mir_tirada"`
  2. `src/data/ultima_tirada.json` (guardado automático en servidor local Vite)
  3. Archivos `~/Downloads/mir_tirada*.json` (descargados automáticamente desde el navegador)
  4. O ruta indicada con `--file <ruta.json>`

Genera:
  1. Resumen ejecutivo por consola (Netas, calibración de confianza V/N/R, rendimiento por tema,
     control de fatiga por tramos Q1-20, Q21-40, Q41-60, etc.).
  2. Archivo `/tmp/tirada_audit.json` con las preguntas enriquecidas.
  3. Esqueleto Markdown `/tmp/guia_tirada_esqueleto.md` agrupado por TEMAS (peor rendimiento primero)
     y con el formato de desmontaje «Espejo Clínico» para el razonamiento del alumno.
"""

import os
import re
import sys
import glob
import json
import shutil
import subprocess

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESGLOSES_FILT_JSON = os.path.join(ROOT_DIR, "src", "data", "desgloses_filtrables.json")
DESGLOSES_RAW_JSON = os.path.join(ROOT_DIR, "src", "data", "desgloses.json")
SIM_TEXTOS_JSON = os.path.join(ROOT_DIR, "src", "data", "simulacros_textos.json")
BANCO_JSON = os.path.join(ROOT_DIR, "src", "data", "bancoPreguntas.json")
ULTIMA_TIRADA_LOCAL = os.path.join(ROOT_DIR, "src", "data", "ultima_tirada.json")

LETTER_TO_NUM = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}
NUM_TO_LETTER = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E"}


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(text))
    text = re.sub(r"&nbsp;", " ", text)
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def infer_subtema(asignatura, tema, enun, coment):
    sub = ""
    tema_l = (tema or "").lower()
    t_full = (enun + " " + coment).lower()

    # 1. TIROIDES
    if "tiroides" in tema_l:
        if any(w in t_full for w in ["feocromocitoma", "carcinoma medular", "men 2", "men2", "neoplasia endocrina múltiple", "protooncogen ret", "protooncogén ret"]):
            return "Neoplasias endocrinas múltiples (MEN)"
        if any(w in t_full for w in ["carcinoma papilar", "carcinoma folicular", "cáncer de tiroides", "tumor maligno", "nódulo", "paaf", "tiroglobulina", "células altas", "i-131", "i131", "radioyodo", "hemitiroidectomía"]):
            return "Nódulo y cáncer de tiroides"
        if any(w in t_full for w in ["de quervain", "tiroiditis subaguda", "hashimoto", "tiroiditis linfocitaria", "tiroiditis silente", "posparto", "hürthle", "oxifílicas"]):
            return "Tiroiditis"
        if any(w in t_full for w in ["graves", "plummer", "adenoma tóxico", "tirotoxicosis", "antitiroideos", "metimazol", "tiamazol", "propiltiouracilo", "tsi", "trab", "oftalmopatía"]):
            return "Hipertiroidismo"
        if any(w in t_full for w in ["eutiroideo enfermo"]):
            return "Síndrome del eutiroideo enfermo"
        if any(w in t_full for w in ["coma mixedematoso", "hipotiroidismo", "levotiroxina", "l-tiroxina", "anti-tpo"]):
            return "Hipotiroidismo y tratamiento sustitutivo"
        if any(w in t_full for w in ["bocio simple", "bocio multinodular", "bocio"]):
            return "Bocio simple y multinodular"
        return "Patología tiroidea general"

    # 2. DIABETES
    elif "diabetes" in tema_l:
        if any(w in t_full for w in ["mody", "mitocondrial", "midd", "sordomudo", "gen leu-uur", "m.3243a>g", "herencia materna"]):
            return "Formas monogénicas y genéticas de diabetes"
        if any(w in t_full for w in ["cetoacidosis", "cad", "cuerpos cetónicos", "acetoacetato", "beta-hidroxibutirato", "kussmaul", "bicarbonato"]):
            return "Complicaciones agudas (Cetoacidosis diabética)"
        if any(w in t_full for w in ["somogyi", "fenómeno del alba", "monitorización continua", "tiempo en rango", "tir"]):
            return "Monitorización y control glucémico"
        if any(w in t_full for w in ["metformina", "sulfonilurea", "glibenclamida", "gliclazida", "glimepirida", "isglt2", "dapagliflozina", "empagliflozina", "glp-1", "dpp-4", "insulina"]):
            return "Tratamiento farmacológico (antidiabéticos e insulinas)"
        if any(w in t_full for w in ["nefropatía", "retinopatía", "neuropatía", "pie diabético", "microalbuminuria", "albuminuria"]):
            return "Complicaciones crónicas de la diabetes"
        if any(w in t_full for w in ["sobrecarga oral", "sog", "criterios diagnósticos", "glucemia basal alterada", "tolerancia alterada"]):
            return "Diagnóstico y cribado de diabetes"
        if any(w in t_full for w in ["niño", "pediátrica", "requerimientos nutricionales"]):
            return "Diabetes mellitus tipo 1"
        return "Diabetes mellitus general"

    # 3. DISLIPEMIAS Y NUTRICIÓN
    elif any(w in tema_l for w in ["dislipemia", "obesidad", "nutrición"]):
        if any(w in t_full for w in ["bypass", "gastrectomía", "manga gástrica", "bariátrica", "orlistat", "obesidad mórbida"]):
            return "Obesidad y cirugía bariátrica"
        if any(w in t_full for w in ["enteral", "parenteral", "polimérica", "oligomérica", "harris-benedict", "realimentación", "desnutrición", "malnutrición", "soporte nutricional"]):
            return "Soporte nutricional y desnutrición"
        if any(w in t_full for w in ["vitamina b12", "cobalamina", "liposoluble", "ácido fólico"]):
            return "Vitaminas y oligoelementos"
        if any(w in t_full for w in ["síndrome metabólico", "criterios atp-iii", "perímetro de cintura"]):
            return "Síndrome metabólico"
        if any(w in t_full for w in ["hipercolesterolemia familiar", "estatina", "ezetimiba", "pcsk9", "hipertrigliceridemia", "fibrato", "fenofibrato", "gemfibrozilo", "xantomas"]):
            return "Dislipemias y metabolismo lipídico"
        if any(w in t_full for w in ["riesgo cardiovascular", "esc/eas", "score"]):
            return "Evaluación del riesgo cardiovascular"
        return "Dislipemia y nutrición"

    return "General / Varios"


def load_question_catalog():
    catalog = {}

    if os.path.exists(DESGLOSES_FILT_JSON):
        with open(DESGLOSES_FILT_JSON, "r", encoding="utf-8") as f:
            for q in json.load(f):
                catalog[str(q.get("id"))] = q

    if os.path.exists(DESGLOSES_RAW_JSON):
        with open(DESGLOSES_RAW_JSON, "r", encoding="utf-8") as f:
            for q in json.load(f):
                qid = str(q.get("id"))
                if qid not in catalog:
                    catalog[qid] = q

    if os.path.exists(SIM_TEXTOS_JSON):
        with open(SIM_TEXTOS_JSON, "r", encoding="utf-8") as f:
            for q in json.load(f):
                qid = str(q.get("id"))
                if qid not in catalog:
                    catalog[qid] = q

    if os.path.exists(BANCO_JSON):
        with open(BANCO_JSON, "r", encoding="utf-8") as f:
            for q in json.load(f):
                qid = str(q.get("id"))
                if qid not in catalog:
                    opts = q.get("options") or []
                    ans_num = q.get("answer") or 1
                    catalog[qid] = {
                        "id": qid,
                        "enunciado": q.get("text", ""),
                        "comentario": q.get("comentario", ""),
                        "asignatura": q.get("asignatura", ""),
                        "tema": q.get("tema", ""),
                        "respuestas": [
                            {"numero": idx + 1, "enunciado": txt, "correcta": (idx + 1) == ans_num}
                            for idx, txt in enumerate(opts)
                        ],
                    }

    return catalog


def find_latest_tirada():
    if "--file" in sys.argv:
        idx = sys.argv.index("--file")
        if idx + 1 < len(sys.argv):
            fpath = sys.argv[idx + 1]
            with open(fpath, "r", encoding="utf-8") as f:
                return json.load(f), f"archivo ({fpath})"

    candidates = []

    # 1. Portapapeles de macOS (pbpaste)
    try:
        clip = subprocess.check_output(["pbpaste"], text=True, stderr=subprocess.DEVNULL).strip()
        if clip.startswith("{") and '"mir_tirada"' in clip:
            data = json.loads(clip)
            if data.get("tipo") == "mir_tirada":
                candidates.append((data.get("timestamp", ""), data, "Portapapeles macOS (pbpaste)"))
    except Exception:
        pass

    # 2. Disco local
    if os.path.exists(ULTIMA_TIRADA_LOCAL):
        try:
            with open(ULTIMA_TIRADA_LOCAL, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("tipo") == "mir_tirada":
                    candidates.append((data.get("timestamp", ""), data, f"Disco local ({ULTIMA_TIRADA_LOCAL})"))
        except Exception:
            pass

    # 3. Descargas
    dl_pattern = os.path.expanduser("~/Downloads/mir_tirada*.json")
    for path in glob.glob(dl_pattern):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("tipo") == "mir_tirada":
                    candidates.append((data.get("timestamp", ""), data, f"Descargas ({os.path.basename(path)})"))
        except Exception:
            pass

    if not candidates:
        print("❌ No se encontró ninguna tirada en el portapapeles, en src/data/ultima_tirada.json ni en ~/Downloads/mir_tirada*.json")
        sys.exit(1)

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1], candidates[0][2]


def generate_markdown_skeleton(tirada, audit_items, out_path="/tmp/guia_tirada_esqueleto.md"):
    m = tirada.get("metricas", {})
    all_preguntas = tirada.get("preguntas", [])
    total = m.get("total", len(all_preguntas))
    aciertos = m.get("aciertos", 0)
    fallos = m.get("fallos", 0)
    netas = m.get("netas", 0.0)
    pct = m.get("pct_acierto", 0.0)

    # 1. Agrupar TODAS las preguntas de la tirada por tema y subtema para calcular rendimiento real
    temas_stats = {}
    subtemas_stats = {}
    for p in all_preguntas:
        t_name = p.get("tema") or "General / Varios"
        s_name = p.get("subtema") or ""
        if not s_name or s_name.lower() in ("general", "otros", "general / conceptos clave"):
            enun_p = p.get("enunciado", "") or p.get("enun", "")
            coment_p = p.get("comentario", "") or p.get("coment", "")
            s_name = infer_subtema(p.get("asignatura", ""), t_name, enun_p, coment_p)
            p["subtema"] = s_name

        if t_name not in temas_stats:
            temas_stats[t_name] = {"total": 0, "aciertos": 0, "fallos": 0, "dudas": 0}
        temas_stats[t_name]["total"] += 1
        if p.get("isCorrect"):
            temas_stats[t_name]["aciertos"] += 1
        else:
            temas_stats[t_name]["fallos"] += 1
        if (p.get("confidence") or "green") in ("orange", "red") or p.get("discardedCorrect"):
            temas_stats[t_name]["dudas"] += 1

        if s_name:
            sub_key = (t_name, s_name)
            if sub_key not in subtemas_stats:
                subtemas_stats[sub_key] = {"total": 0, "aciertos": 0, "fallos": 0, "dudas": 0}
            subtemas_stats[sub_key]["total"] += 1
            if p.get("isCorrect"):
                subtemas_stats[sub_key]["aciertos"] += 1
            else:
                subtemas_stats[sub_key]["fallos"] += 1
            if (p.get("confidence") or "green") in ("orange", "red") or p.get("discardedCorrect"):
                subtemas_stats[sub_key]["dudas"] += 1

    for t_name, st in temas_stats.items():
        st["pct"] = (st["aciertos"] / st["total"] * 100.0) if st["total"] > 0 else 0.0

    for sub_key, sst in subtemas_stats.items():
        sst["pct"] = (sst["aciertos"] / sst["total"] * 100.0) if sst["total"] > 0 else 0.0

    # 2. Agrupar los audit_items por tema y mapear preguntas interrelacionadas
    items_por_tema = {}
    for it in audit_items:
        t_name = it.get("tema") or "General / Varios"
        if t_name not in items_por_tema:
            items_por_tema[t_name] = []
        items_por_tema[t_name].append(it)

    # Detección de clústeres y preguntas afines en la tirada
    related_map = {}
    for i, it in enumerate(audit_items):
        qid = it["id"]
        sub = it.get("subtema")
        tema = it.get("tema")
        related = []
        for j, other in enumerate(audit_items):
            if i == j:
                continue
            if sub and other.get("subtema") and sub.lower() == other.get("subtema", "").lower():
                related.append(other)
            elif tema and other.get("tema") and tema.lower() == other.get("tema", "").lower():
                if not sub and not other.get("subtema"):
                    related.append(other)
        related_map[qid] = related

    # 3. Ordenar temas por PEOR RENDIMIENTO PRIMERO (menor % acierto, mayor número de fallos)
    temas_ordenados = sorted(
        temas_stats.keys(),
        key=lambda t: (temas_stats[t]["pct"], -temas_stats[t]["fallos"], -temas_stats[t]["dudas"])
    )

    out = []
    asig_title = tirada.get("asignatura", "Reumatología")
    out.append(f"# 🩺 Guía de Corrección · Tirada de {asig_title}")
    out.append(f"> **Fecha:** {tirada.get('fecha_humana', '')} | **Materia:** {asig_title} (*{', '.join(tirada.get('temas', []))}*)  ")
    out.append(f"> **Resultado Global:** **{aciertos}/{total} aciertos** ({pct:.1f}%) | **{netas:.2f} Netas oficiales**.  ")
    out.append("")
    out.append("---")
    out.append("")
    out.append("## 📊 Tablero de Rendimiento por Temas y Subtemas")
    out.append("> *📌 Temas y subtemas ordenados de menor a mayor acierto para corregir lo urgente primero e interrelacionar conceptos afines.*")
    out.append("")
    out.append("| Tema / Subtema | Preguntas | Aciertos | % Acierto | Fallos / Dudas a Revisar | Prioridad |")
    out.append("| :--- | :---: | :---: | :---: | :---: | :---: |")

    for t_name in temas_ordenados:
        st = temas_stats[t_name]
        n_audit = len(items_por_tema.get(t_name, []))
        if st["pct"] < 60:
            prio = "🔴 **Crítica**"
        elif st["pct"] < 75:
            prio = "🟠 **Mejorable**"
        else:
            prio = "🟢 **Firme**"
        out.append(
            f"| **{t_name}** | {st['total']} | {st['aciertos']} | **{st['pct']:.1f}%** | {n_audit} preguntas | {prio} |"
        )

        # Desglose de subtemas bajo el tema
        subtemas_del_tema = [k[1] for k in subtemas_stats.keys() if k[0] == t_name]
        subtemas_del_tema_sorted = sorted(
            subtemas_del_tema,
            key=lambda sn: (subtemas_stats[(t_name, sn)]["pct"], -subtemas_stats[(t_name, sn)]["fallos"])
        )
        for sn in subtemas_del_tema_sorted:
            sst = subtemas_stats[(t_name, sn)]
            n_sub_audit = sum(1 for it in items_por_tema.get(t_name, []) if it.get("subtema") == sn)
            sub_prio = "🔴" if sst["pct"] < 60 else ("🟠" if sst["pct"] < 75 else "🟢")
            out.append(
                f"| &nbsp;&nbsp;└─ *{sn}* | {sst['total']} | {sst['aciertos']} | {sst['pct']:.1f}% | {n_sub_audit} preg. | {sub_prio} |"
            )

    out.append("")
    out.append("---")
    out.append("")

    def format_item(idx, it, rel_items=None):
        conf_map = {"green": "🟢 Segura", "orange": "🟠 Duda", "red": "🔴 Riesgo"}
        conf_str = conf_map.get(it.get("confidence", "green"), "🟢 Segura")
        conv = it.get("convocatoria", "")
        enun_txt = it.get("enun", "")
        justif = it.get("justificacion", "").strip()
        is_ok = it.get("isCorrect", False)
        sub_str = f" / {it['subtema']}" if it.get("subtema") else ""

        lines = []
        status_badge = "✅ Acierto frágil" if is_ok else "❌ Fallo"
        lines.append(f"### {idx}. `Q{it['orden']:02d}` · {it['asignatura']} / {it['tema']}{sub_str} ({status_badge} · {conf_str} · Dif {it.get('dificultad', 3)})")
        if conv:
            lines.append(f"* **Convocatoria oficial:** {conv}.")
        lines.append(f"* **Enunciado completo:** {enun_txt}")

        if is_ok:
            lines.append(f"* ✅ **Marcaste y Correcta ({it['selectedLetter']}):** ***{it['respCorr']}*** *(Acierto con duda / descartando correcta)*.")
        else:
            lines.append(f"* ❌ **Marcaste ({it['selectedLetter']}):** *{it['respDada']}*")
            lines.append(f"* ✅ **Correcta ({it['correctLetter']}):** ***{it['respCorr']}***")

        if justif:
            lines.append(f'* 💬 **Tu justificación al responder:** *"{justif}"*')

        pct_pob = it.get("pctPob")
        es_marciana = (pct_pob is not None and pct_pob < 35) or it.get("isSatelite", False) or it.get("origen_tirada") == "satelite_absorbido"

        if es_marciana and not is_ok:
            lines.append(f"* 📡 **Triaje:** Pregunta Satélite / Marciana (<35% pob o tema secundario · Modo Telegrama 10s)")
            lines.append(f"* ⚡ **Perla directa (10s):** [REGLA_DIRECTA_EN_1_FRASE]")
            lines.append(f"* ❌ **Por qué no aplica la tuya:** [DIFERENCIAL_EN_1_LÍNEA_SIN_ROLLO]")
            if rel_items:
                rel_q_str = ", ".join(f"Q{r['orden']:02d}" for r in rel_items)
                lines.append(f"* 🔗 **Nexo Clínico con {rel_q_str}:** [DIFERENCIAL_RÁPIDO_CON_{rel_q_str}]")
            lines.append(f"* **🃏 Anki sugerida:** [ANKI_SUGERIDA]")
            lines.append("")
            return "\n".join(lines)

        coment_txt = it.get("coment", "").strip()

        if justif:
            lines.append(f"* **🎯 Desmontaje del razonamiento («Espejo Clínico»):**")
            lines.append(f"  • **Premisa acertada:** [PREMISA_QUE_VISTE_BIEN]")
            lines.append(f"  • **Dato ciego / Trampa que te desvió:** [DATO_CIEGO_O_TRAMPA]")
            lines.append(f"  • **Regla de decisión MIR:** [REGLA_DIRECTA_PARA_NO_DUDAR]")
            if coment_txt:
                lines.append(f"  • **Explicación oficial CTO:** {coment_txt}")
        else:
            if coment_txt:
                lines.append(f"* **🎯 Concepto clave / Por qué fallaste:** {coment_txt}")
            else:
                lines.append(f"* **🎯 Concepto clave / Por qué fallaste:** [ANÁLISIS_CLÍNICO_FISIOPATOLÓGICO]")

        # Interrelación obligatoria si hay preguntas afines en la tirada
        if rel_items:
            rel_q_str = ", ".join(f"Q{r['orden']:02d}" for r in rel_items)
            lines.append(f"* 🔗 **Nexo Clínico e Interrelación con {rel_q_str}:** [INTERRELACIÓN_CLÍNICA: Compara qué dato pivote o síntoma discriminador diferencia esta pregunta de {rel_q_str}, o si caíste en el mismo sesgo en ambas]")
        else:
            lines.append(f"* 🔗 **Nexo Clínico / Diagnóstico Diferencial:** [DIFERENCIAL_CLÍNICO: Compara este cuadro con otras patologías afines del tema/subtema]")

        # Análisis de distractores / descartes (priorizando los NO descartados por el alumno)
        opciones = it.get("opciones", {})
        corr_letter = it.get("correctLetter", "")
        sel_letter = it.get("selectedLetter", "")
        discarded = it.get("discardedOptions", [])

        distractores = [k for k in sorted(opciones.keys()) if k != corr_letter]
        if distractores:
            no_descartados = [k for k in distractores if k not in discarded]
            ya_descartados = [k for k in distractores if k in discarded]

            lines.append(f"* ✂️ **Por qué son falsas las demás opciones (descartes clave):**")
            if ya_descartados and no_descartados:
                descartadas_str = ", ".join(f"**{d}**" for d in ya_descartados)
                lines.append(f"  *(Descartadas previamente por ti: {descartadas_str})*")

            for d_letra in no_descartados:
                txt = opciones.get(d_letra, "")
                txt_short = (txt[:65] + "...") if len(txt) > 65 else txt
                mark = " *(tu elección errónea)*" if d_letra == sel_letter and not is_ok else " *(no descartada)*"
                lines.append(f"  • **Opción {d_letra}** ({txt_short}){mark}: [POR_QUÉ_SE_DESCARTA]")

            for d_letra in ya_descartados:
                txt = opciones.get(d_letra, "")
                txt_short = (txt[:50] + "...") if len(txt) > 50 else txt
                lines.append(f"  • *(Descartada)* **Opción {d_letra}** ({txt_short}): [POR_QUÉ_SE_DESCARTA]")

        lines.append(f"* **🃏 Anki sugerida:** [ANKI_SUGERIDA]")
        lines.append("")
        return "\n".join(lines)

    global_idx = 1
    for t_name in temas_ordenados:
        sub_items = items_por_tema.get(t_name, [])
        if not sub_items:
            continue

        st = temas_stats[t_name]
        out.append(f"## 📁 {t_name} · ({st['aciertos']}/{st['total']} aciertos — {st['pct']:.1f}%)")
        out.append("")

        # Agrupar sub_items por subtema o clúster clínico
        items_by_subtema = {}
        for it in sub_items:
            s_name = it.get("subtema") or "General / Conceptos Clave"
            if s_name not in items_by_subtema:
                items_by_subtema[s_name] = []
            items_by_subtema[s_name].append(it)

        # Ordenar subtemas por peor rendimiento
        def sub_sort_key(sn):
            sub_key = (t_name, sn)
            sst = subtemas_stats.get(sub_key, {"pct": 100, "fallos": 0})
            return (sst["pct"], -sst["fallos"])

        sorted_subs = sorted(items_by_subtema.keys(), key=sub_sort_key)

        for s_name in sorted_subs:
            sub_list = items_by_subtema[s_name]

            # Ordenar preguntas del subtema por prioridad pedagógica de error
            def sort_priority(x):
                if not x.get("isCorrect"):
                    return 0 if (x.get("confidence") == "green" or x.get("discardedCorrect")) else 1
                return 2

            sub_list_sorted = sorted(sub_list, key=sort_priority)

            if s_name != "General / Conceptos Clave" and len(sub_list_sorted) >= 2:
                q_refs = ", ".join(f"`Q{x['orden']:02d}`" for x in sub_list_sorted)
                out.append(f"### 🧬 Clúster Clínico: {s_name} ({len(sub_list_sorted)} preguntas interrelacionadas: {q_refs})")
                out.append(f"> 💡 **Interrelación de la Tirada:** Este clúster agrupa preguntas relacionadas sobre *{s_name}*. Compara los datos pivote que diferencian cada caso clínico.")
                out.append("")
            elif s_name != "General / Conceptos Clave":
                out.append(f"### 🎯 Subtema: {s_name}")
                out.append("")

            for it in sub_list_sorted:
                rel = related_map.get(it["id"], [])
                out.append(format_item(global_idx, it, rel))
                global_idx += 1

        out.append("---")
        out.append("")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"✅ Esqueleto Markdown de Tirada generado con éxito en: {out_path}")


def main():
    tirada, fuente = find_latest_tirada()
    catalog = load_question_catalog()

    preguntas = tirada.get("preguntas", [])
    contestadas = [p for p in preguntas if p.get("contestada")]
    aciertos = [p for p in contestadas if p.get("isCorrect")]
    fallos = [p for p in contestadas if not p.get("isCorrect")]
    blancas = [p for p in preguntas if not p.get("contestada")]
    netas = len(aciertos) - (len(fallos) / 3.0)
    pct_global = (len(aciertos) / len(contestadas) * 100.0) if contestadas else 0.0

    print("======================================================================")
    print(f"📊 AUDITORÍA DE TIRADA · {tirada.get('asignatura', 'Mixto')} ({tirada.get('fecha_humana', '')})")
    print(f"📍 Fuente: {fuente}")
    if tirada.get("temas"):
        print(f"📚 Temas filtrados: {', '.join(tirada['temas'])}")
    print("======================================================================")
    print(f"• Total: {len(preguntas)} | Contestadas: {len(contestadas)} | Aciertos: {len(aciertos)} | Fallos: {len(fallos)} | Blancas: {len(blancas)}")
    print(f"• Netas: {netas:.2f} / {len(contestadas)} ({pct_global:.1f}% acierto)")

    # Desglose por Origen (Temas estudiados vs Simulacros vs Relleno)
    print("\n--- 🎯 RENDIMIENTO POR ORIGEN DE LAS PREGUNTAS ---")
    for orig_key, orig_label in [
        ("tema_estudiado", "Desgloses del filtro exacto     "),
        ("simulacro_asignatura", "Simulacros CTO de la asignatura "),
        ("relleno_asignatura", "Otros Desgloses de la asignatura"),
        ("relleno_global", "Relleno adaptativo global       "),
    ]:
        sub = [p for p in contestadas if p.get("origen_tirada", "tema_estudiado") == orig_key]
        if not sub:
            continue
        ok = sum(1 for p in sub if p.get("isCorrect"))
        print(f"  • {orig_label}: {ok:2d}/{len(sub):2d} aciertos ({ok/len(sub)*100:5.1f}%)")

    # Calibración por Nivel de Confianza (Verde / Naranja / Rojo)
    print("\n--- 🧠 CALIBRACIÓN METACOGNITIVA (NIVEL DE SEGURIDAD) ---")
    for conf_key, conf_label in [
        ("green", "🟢 Segura (Verde)  "),
        ("orange", "🟠 Dudosa (Naranja)"),
        ("red", "🔴 Riesgo (Rojo)   "),
    ]:
        sub = [p for p in contestadas if (p.get("confidence") or "green") == conf_key]
        if not sub:
            continue
        ok = sum(1 for p in sub if p.get("isCorrect"))
        ko = len(sub) - ok
        print(f"  • {conf_label}: {len(sub):2d} preg → {ok:2d} aciertos ({ok/len(sub)*100:5.1f}%) | {ko:2d} fallos")

    # Control de Fatiga por Tramos de 20 preguntas (soporta tiradas >50 preguntas)
    print("\n--- ⏱️ CONTROL DE RITMO Y FATIGA POR TRAMOS ---")
    max_orden = max((p.get("orden", 0) for p in contestadas), default=len(contestadas))
    tramos = []
    step = 20
    for start in range(1, max_orden + 1, step):
        tramos.append((start, start + step - 1))

    for a, b in tramos:
        sub = [p for p in contestadas if a <= p.get("orden", 0) <= b]
        if not sub:
            continue
        ok = sum(1 for p in sub if p.get("isCorrect"))
        avg_sec = sum(p.get("seconds", 0) for p in sub) / len(sub)
        print(f"  Q{a:02d}–Q{b:02d}: Acierto = {ok/len(sub)*100:5.1f}% ({ok}/{len(sub)}) | Tiempo medio = {avg_sec:4.1f}s/preg")

    audit_items = []
    for p in preguntas:
        qid = str(p.get("id"))
        orden = p.get("orden")
        contestada = p.get("contestada", False)
        is_correct = p.get("isCorrect", False)
        conf = p.get("confidence") or "green"
        disc_corr = p.get("discardedCorrect", False)

        # Incluir todas las falladas/blancas Y los aciertos con duda (orange/red) o donde descartó la correcta
        needs_audit = (not contestada) or (not is_correct) or (conf in ("orange", "red")) or disc_corr
        if not needs_audit:
            continue

        raw_q = catalog.get(qid, {})
        respuestas = raw_q.get("respuestas", [])
        opciones_dict = {}
        for r in respuestas:
            num = r.get("numero")
            letra = NUM_TO_LETTER.get(num, str(num))
            opciones_dict[letra] = strip_html(r.get("enunciado", ""))

        if not opciones_dict and p.get("options"):
            for idx_opt, opt_txt in enumerate(p.get("options", [])):
                letra = NUM_TO_LETTER.get(idx_opt + 1, str(idx_opt + 1))
                opciones_dict[letra] = strip_html(opt_txt)

        sel_letter = p.get("selectedLetter") or "BLANCO"
        corr_letter = p.get("correctLetter") or ""
        if not corr_letter and respuestas:
            for r in respuestas:
                if r.get("correcta"):
                    corr_letter = NUM_TO_LETTER.get(r.get("numero"), str(r.get("numero")))

        resp_dada_txt = opciones_dict.get(sel_letter, "EN BLANCO")
        resp_corr_txt = opciones_dict.get(corr_letter, "")
        enun_txt = strip_html(raw_q.get("enunciado", "") or p.get("enunciado", ""))
        coment_txt = strip_html(raw_q.get("comentario", "") or p.get("comentario", ""))
        asignatura = p.get("asignatura") or raw_q.get("asignatura") or "General"
        tema = p.get("tema") or raw_q.get("tema") or ""
        subtema = p.get("subtema") or raw_q.get("subtema") or ""
        if not subtema or subtema.lower() in ("general", "otros", "general / conceptos clave"):
            subtema = infer_subtema(asignatura, tema, enun_txt, coment_txt)
        dif = p.get("dificultad") or raw_q.get("dificultad") or 3
        convocatoria = p.get("convocatoria") or raw_q.get("convocatoria") or ""
        origen_tirada = p.get("origen_tirada") or "tema_estudiado"
        pct_pob = p.get("pctPob") or raw_q.get("pctPob") or p.get("pct_pob") or raw_q.get("pct_pob")
        is_satelite = p.get("isSatelite") or raw_q.get("isSatelite") or (origen_tirada == "satelite_absorbido")

        audit_items.append({
            "orden": orden,
            "id": qid,
            "asignatura": asignatura,
            "tema": tema,
            "subtema": subtema,
            "dificultad": dif,
            "convocatoria": convocatoria,
            "origen_tirada": origen_tirada,
            "pctPob": pct_pob,
            "isSatelite": bool(is_satelite),
            "contestada": contestada,
            "isCorrect": is_correct,
            "confidence": conf,
            "discardedCorrect": disc_corr,
            "discardedOptions": p.get("discardedOptions", []),
            "seconds": p.get("seconds", 0),
            "selectedLetter": sel_letter,
            "correctLetter": corr_letter,
            "enun": enun_txt,
            "opciones": opciones_dict,
            "respDada": resp_dada_txt,
            "respCorr": resp_corr_txt,
            "coment": coment_txt,
            "justificacion": p.get("justificacion", ""),
        })

    con_justif = [x for x in audit_items if x.get("justificacion")]

    print("\n--- 🗂️ PREGUNTAS A REVISAR EN EL ARTEFACTO ---")
    print(f"  • Total preguntas a revisar: {len(audit_items)} (Fallos + Aciertos con duda)")
    if con_justif:
        print(f"  • Con justificación médica del alumno: {len(con_justif)} preguntas")

    out_json = "/tmp/tirada_audit.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({
            "meta": {
                "id": tirada.get("id"),
                "timestamp": tirada.get("timestamp"),
                "fecha_humana": tirada.get("fecha_humana"),
                "asignatura": tirada.get("asignatura"),
                "temas": tirada.get("temas"),
                "metricas": tirada.get("metricas"),
                "fuente": fuente,
            },
            "items": audit_items,
        }, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Auditoría JSON guardada en: {out_json}")
    generate_markdown_skeleton(tirada, audit_items)


if __name__ == "__main__":
    main()
