#!/usr/bin/env python3
"""
Script maestro diario para la 3ª Vuelta MIR 2027 (CTO UCV6127):
1. Sincroniza en vivo las últimas Evaluaciones CTO contestadas (p. ej. la noche anterior a las 20:00),
   detecta nuevos fallos/blancas, los clasifica por Bloques de Prioridad (% poblacional) para la
   corrección exprés de las 09:30 (25 min) y los reinyecta en src/data/evaluaciones_cto.json.
2. Genera la Hoja de Ruta Quirúrgica del día (semáforo de temas del bloque CTO según peso MIR +
   tasa de fallo en Simulacros y Evaluaciones + subtemas exactos fallados) y descarga los Esquemas PDF.

Uso:
  python3 scripts/preparar_dia_v3.py [--fecha YYYY-MM-DD] [--ultimas-eval N]
"""

import os
import re
import sys
import json
import argparse
import unicodedata
import urllib.request
import urllib.parse
from datetime import datetime, date
from pathlib import Path

from sync_campus_v3 import (
    load_env,
    create_cto_client,
    EXPEDIENTE_ID,
    GRUPO_ID,
    EDICION_ID,
    CTO_ASIG_TO_APP,
    OVH_IMG_BASE,
)

PLAN_PATH = Path("src/data/planificacionCTO.json")
EVAL_PATH = Path("src/data/evaluaciones_cto.json")
FALLADAS_PATH = Path("src/data/cto_clasificaciones_falladas.json")
DESGLOSES_PATH = Path("src/data/desgloses_filtrables.json")
SIMS_PATH = Path("src/data/simulacrosCTO.json")
SIMS_TEXTOS_PATH = Path("src/data/simulacros_textos.json")
ESCUELA_MEDICA_PATH = Path("src/data/escuelaMedica.json")
ESQUEMAS_DIR = Path("PDFs_CTO/Esquemas_3V")
EXPORTS_DIR = Path("exports")
IMG_DIR = Path("public/img")

OVH_ESQUEMAS_BASE = "https://materiales.s3.gra.io.cloud.ovh.net/campus/documentos/esquemas"

CODIGO_TO_APP_ASIG = {
    "AL": "Alergología",
    "AT": "Anatomía",
    "AP": "Anatomía Patológica",
    "AN": "Anestesiología",
    "BL": "Bioética y Medicina Legal",
    "BQ": "Bioquímica",
    "CD": "Cardiología",
    "CG": "Cirugía General",
    "DM": "Dermatología",
    "DG": "Digestivo",
    "ED": "Endocrinología y Metabolismo",
    "EP": "Estadística y Epidemiología",
    "FC": "Medicina Familiar y Comunitaria",
    "FM": "Farmacología",
    "FS": "Fisiología",
    "GC": "Ginecología y Obstetricia",
    "GR": "Geriatría",
    "GT": "Genética",
    "HM": "Hematología",
    "IF": "Infecciosas",
    "IG": "Inmunología",
    "MP": "Estadística y Epidemiología",
    "NF": "Nefrología",
    "NM": "Neumología",
    "NR": "Neurología y Neurocirugía",
    "OF": "Oftalmología",
    "ON": "Oncología",
    "OR": "Otorrinolaringología",
    "PD": "Pediatría",
    "PQ": "Psiquiatría",
    "RM": "Reumatología",
    "RX": "Radiología",
    "TM": "Traumatología",
    "UG": "Urgencias",
    "UR": "Urología",
}


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s).strip().lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def sync_and_audit_recent_evaluaciones(req_json, limit_new=45):
    """Sincroniza evaluaciones_cto.json y devuelve las preguntas nuevas o recientes falladas/blancas."""
    prev_ids = set()
    if EVAL_PATH.exists():
        try:
            old_data = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
            prev_ids = {q.get("cto_id") for q in old_data if q.get("cto_id")}
        except Exception:
            pass

    path = (
        f"/api/campus/preguntas/filtros?tipoPregunta=revision_preguntas_evaluacion"
        f"&edicionId={EDICION_ID}&grupoId={GRUPO_ID}&expedienteId={EXPEDIENTE_ID}"
        f"&simulacros=&convocatorias=&asignaturas=&temas=&soloImagen=false"
    )
    res = req_json("GET", path)
    raw_qs = res if isinstance(res, list) else (res.get("preguntas", []) if isinstance(res, dict) else [])

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    formatted_qs = []
    newly_added = []

    for idx, rq in enumerate(raw_qs, 1):
        qid = rq.get("id")
        correcta = int(rq.get("correcta") or 1)
        user_resp = rq.get("respuesta")
        resultado = int(rq.get("resultado") or 0)

        opciones_elegidas = rq.get("opciones_elegidas") or []
        total_votes = sum(int(o.get("cuenta") or 0) for o in opciones_elegidas)
        votes_by_opt = {int(o.get("respuesta") or 0): int(o.get("cuenta") or 0) for o in opciones_elegidas}
        pct_correcta = round((votes_by_opt.get(correcta, 0) / total_votes) * 100) if total_votes > 0 else 50

        opts_list = []
        for opt_i, r_opt in enumerate(rq.get("respuestas") or [], 1):
            num_opt = int(r_opt.get("numero") or opt_i)
            pct_opt = round((votes_by_opt.get(num_opt, 0) / total_votes) * 100) if total_votes > 0 else None
            opts_list.append(
                {
                    "id": num_opt,
                    "texto": (r_opt.get("enunciado") or r_opt.get("contestacion") or r_opt.get("texto") or "").strip(),
                    "porcentaje": pct_opt,
                }
            )

        img_name = (rq.get("imagen_nombre") or "").strip()
        local_img = None
        if img_name:
            safe_name = f"evalcto_{os.path.basename(img_name)}"
            dest_img = IMG_DIR / safe_name
            if not dest_img.exists() or dest_img.stat().st_size < 500:
                img_url = f"{OVH_IMG_BASE}/{urllib.parse.quote(img_name)}"
                try:
                    req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        dest_img.write_bytes(resp.read())
                except Exception:
                    pass
            if dest_img.exists():
                local_img = safe_name

        raw_asig = (rq.get("asignatura") or "Miscelánea").strip()
        app_asig = CTO_ASIG_TO_APP.get(raw_asig, raw_asig)

        q_item = {
            "id": f"EVALCTO_{qid}",
            "cto_id": qid,
            "numero": idx,
            "year": 2026,
            "origen": "Evaluación CTO",
            "asignatura": app_asig,
            "asignatura_cto": raw_asig,
            "tema": (rq.get("tema") or "General").strip(),
            "subtema": (rq.get("subtema") or "").strip(),
            "dificultad": rq.get("dificultad"),
            "enunciado": (rq.get("enunciado") or "").strip(),
            "opciones": opts_list,
            "correcta": correcta,
            "respuesta_usuario": int(user_resp) if user_resp else None,
            "resultado_cto": resultado,
            "fallada_o_blanca": resultado != 1,
            "pct_acierto_pob": pct_correcta,
            "total_respuestas_pob": total_votes,
            "explicacion": (rq.get("comentario") or "").strip(),
            "imagen": local_img,
        }
        formatted_qs.append(q_item)
        if qid not in prev_ids:
            newly_added.append(q_item)

    EVAL_PATH.write_text(json.dumps(formatted_qs, ensure_ascii=False, indent=2), encoding="utf-8")
    return formatted_qs, newly_added


def find_target_date(plan_events, requested_date=None):
    if requested_date:
        return requested_date
    today_str = date.today().isoformat()
    # Buscar el próximo día con bloque de Estudio en 3ª Vuelta (o desde hoy)
    v3_dates = sorted(
        {
            e["fecha"]
            for e in plan_events
            if e.get("categoria") == "Estudio" and (e.get("fecha") or "") >= max(today_str, "2026-11-06")
        }
    )
    return v3_dates[0] if v3_dates else "2026-11-06"


def clean_html(txt):
    if not txt:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", str(txt), flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()


def generate_notebooklm_pack(target_date, code, app_asig, topic_stats, mapa_textos, bloque_num=None):
    """
    Como NotebookLM solo tiene el Manual CTO de la asignatura (y NO tiene acceso a nuestras bases de datos),
    este motor lee nuestras bases de datos locales (Simulacros + Evaluaciones CTO), extrae los enunciados y
    conceptos exactos donde ha fallado el alumno, y los incrusta DIRECTAMENTE dentro de los prompts para
    que el alumno solo tenga que copiar y pegar en su cuaderno de NotebookLM sin subir ningún archivo.
    """
    prompts_lines = []
    p1_p2_topics = [ts for ts in topic_stats[:6] if ts["score"] > 0]
    top3_titles = [ts["titulo"] for ts in topic_stats[:3] if ts["score"] > 0]

    # Construir lista de casos/conceptos reales fallados por el alumno para inyectarlos dentro del Mega-Prompt
    casos_fallados_resumen = []
    for ts in p1_p2_topics[:4]:
        t_name = ts["titulo"]
        ejemplos_tema = []
        for q in ts.get("eval_fails_list", [])[:3]:
            enun = clean_html(q.get("enunciado"))
            if enun:
                ejemplos_tema.append(enun[:160])
        for p in ts.get("sim_fails_list", [])[:3]:
            if len(ejemplos_tema) >= 4:
                break
            key = f"{p.get('simulacro')}-{p.get('numero')}"
            t_obj = mapa_textos.get(key, {})
            enun = clean_html(t_obj.get("enunciado") or p.get("enunciado"))
            if enun:
                ejemplos_tema.append(enun[:160])
        if ejemplos_tema:
            casos_fallados_resumen.append(f"- En {t_name}: " + " // ".join(ejemplos_tema))

    prompts_lines.append("### 🧠 Prompts Autónomos para NotebookLM (Solo necesitas tu Manual CTO en NotebookLM)")
    prompts_lines.append("")
    prompts_lines.append(
        "> 💡 **Cómo funciona:** Como NotebookLM solo tiene tu Manual CTO y no ve tus bases de datos, **yo ya he extraído aquí abajo las dudas y preguntas exactas que has fallado en Simulacros y Evaluaciones** y las he metido dentro del propio prompt. Solo tienes que **copiar y pegar** en tu cuaderno de NotebookLM."
    )
    prompts_lines.append("")
    prompts_lines.append("#### 1️⃣ Mega-Prompt Todo-en-Uno para pegar en NotebookLM (genera tu Informe + Interrogatorio):")
    prompts_lines.append("```text")
    prompts_lines.append(
        f"Actúa como mi tutor quirúrgico del MIR para {app_asig} usando exclusivamente el Manual CTO de este cuaderno.\n"
        f"Hoy solo tengo 90 minutos y quiero dominar mis temas prioritarios ({', '.join(top3_titles)}).\n"
        "En mis simulacros y tests previos he fallado específicamente estas preguntas y situaciones clínicas:\n"
        + "\n".join(casos_fallados_resumen)
        + "\n\n"
        "A partir del Manual CTO:\n"
        "1. Hazme un Informe Estructurado con tablas comparativas ultra-densas que resuelvan exactamente cada uno de esos puntos y subtemas.\n"
        "2. Explícame las diferencias clave, criterios diagnósticos, escalas y contraindicaciones que permiten no volver a caer en esas preguntas.\n"
        "3. Al final, hazme un interrogatorio interactivo de 5 preguntas cortas (una a una, esperando mi respuesta) sobre esos mismos conceptos."
    )
    prompts_lines.append("```")
    prompts_lines.append("")
    prompts_lines.append("#### 2️⃣ Prompts Cortos Tema por Tema (para ir navegando tú el Manual en NotebookLM):")
    for rank_i, ts in enumerate(p1_p2_topics, 1):
        badge = "🔴 P1" if rank_i <= 3 else "🟠 P2"
        focos = [k for k, _ in ts["subtemas_fallados"] if k not in ("General", "Otros")] or [ts["titulo"]]
        focos_joined = ", ".join(focos[:3])
        ejemplos = []
        for q in ts.get("eval_fails_list", [])[:2]:
            ejemplos.append(clean_html(q.get("enunciado"))[:135])
        for p in ts.get("sim_fails_list", [])[:2]:
            if len(ejemplos) >= 3:
                break
            key = f"{p.get('simulacro')}-{p.get('numero')}"
            t_obj = mapa_textos.get(key, {})
            en = clean_html(t_obj.get("enunciado") or p.get("enunciado"))
            if en:
                ejemplos.append(en[:135])
        dudas_txt = f" y resuélveme estas dudas concretas donde suelo dudar: «{'» | «'.join(ejemplos)}»" if ejemplos else ""
        prompts_lines.append(
            f"- **{badge} · {ts['titulo']}:**\n"
            f"  `Según el Manual CTO, hazme una tabla resumen y diagnóstico diferencial de {ts['titulo']} centrándote en [{focos_joined}]{dudas_txt}.`"
        )
    prompts_lines.append("")
    return "\n".join(prompts_lines)


def build_morning_briefing(target_date, plan_events, eval_qs):
    day_events = [e for e in plan_events if e.get("fecha") == target_date]
    estudio_evs = [e for e in day_events if e.get("categoria") == "Estudio"]

    desgloses = json.loads(DESGLOSES_PATH.read_text(encoding="utf-8")) if DESGLOSES_PATH.exists() else []
    sims_raw = json.loads(SIMS_PATH.read_text(encoding="utf-8")) if SIMS_PATH.exists() else []
    sims_qs = sims_raw if isinstance(sims_raw, list) else sims_raw.get("preguntas", [])
    sims_textos = json.loads(SIMS_TEXTOS_PATH.read_text(encoding="utf-8")) if SIMS_TEXTOS_PATH.exists() else []
    mapa_textos = {f"{t.get('simulacro')}-{t.get('numero_pregunta') or t.get('numero')}": t for t in sims_textos}

    falladas_cto = json.loads(FALLADAS_PATH.read_text(encoding="utf-8")) if FALLADAS_PATH.exists() else []

    lines = []
    lines.append(f"# 🌅 Hoja de Ruta Quirúrgica 3ª Vuelta — {target_date}")
    lines.append("")

    if not estudio_evs:
        lines.append("> Día sin bloque de Estudio estándar en calendario CTO:")
        for e in day_events:
            lines.append(f"- **{e.get('hora_inicio')} - {e.get('hora_fin') or ''}**: `{e.get('categoria')}` — **{e.get('nombre')}**")
        return "\n".join(lines)

    for est in estudio_evs:
        code = est.get("asignatura") or ""
        app_asig = CODIGO_TO_APP_ASIG.get(code, code)
        norm_asig = norm(app_asig)
        temas_bloque = est.get("temas") or []

        lines.append(f"## 📘 Bloque del Día: **{est.get('nombre')}** ({app_asig})")
        lines.append("")

        # Analizar cada tema del bloque
        topic_stats = []
        for idx, t in enumerate(temas_bloque, 1):
            titulo = t.get("titulo") or f"Tema {idx}"
            norm_t = norm(titulo)

            # 1. Peso MIR (2015-2025 y recientes 2022-2025)
            mir_all = [
                d
                for d in desgloses
                if norm(d.get("asignatura")) == norm_asig
                and (norm_t in norm(d.get("tema")) or norm(d.get("tema")) in norm_t)
                and (d.get("anualidad") or 0) >= 2015
            ]
            mir_rec = [d for d in mir_all if (d.get("anualidad") or 0) >= 2022]

            # 2. Simulacros fallados/blancos del tema
            sim_tema = []
            for p in sims_qs:
                if p.get("ignorar"):
                    continue
                clasif = p.get("clasificaciones") or []
                asig_p = CODIGO_TO_APP_ASIG.get(p.get("asignatura"), clasif[0] if clasif else "")
                tema_p = clasif[1] if len(clasif) > 1 else ""
                if norm(asig_p) == norm_asig and (norm_t in norm(tema_p) or norm(tema_p) in norm_t):
                    sim_tema.append(p)

            sim_fails = [p for p in sim_tema if not p.get("acertada")]
            subtemas_fallados = {}
            for p in sim_fails:
                clasif = p.get("clasificaciones") or []
                sub = clasif[2] if len(clasif) > 2 else "Concepto general"
                subtemas_fallados[sub] = subtemas_fallados.get(sub, 0) + 1

            # 3. Evaluaciones CTO falladas/blancas del tema
            eval_fails = [
                q
                for q in eval_qs
                if norm(q.get("asignatura")) == norm_asig
                and q.get("fallada_o_blanca")
                and q.get("pct_acierto_pob", 50) >= 35
                and (norm_t in norm(q.get("tema")) or norm(q.get("tema")) in norm_t)
            ]
            for q in eval_fails:
                sub = q.get("subtema") or q.get("tema") or "Evaluación CTO"
                subtemas_fallados[sub] = subtemas_fallados.get(sub, 0) + 1

            # Score combinado: Peso MIR + Fallos en Simulacros + Fallos en Evaluaciones
            priority_score = (len(mir_rec) * 3.0) + (len(mir_all) * 1.2) + (len(sim_fails) * 2.5) + (len(eval_fails) * 2.0)

            topic_stats.append(
                {
                    "orden": idx,
                    "titulo": titulo,
                    "mir_15_25": len(mir_all),
                    "mir_22_25": len(mir_rec),
                    "sim_total": len(sim_tema),
                    "sim_fails": len(sim_fails),
                    "eval_fails": len(eval_fails),
                    "score": round(priority_score, 1),
                    "subtemas_fallados": sorted(subtemas_fallados.items(), key=lambda x: -x[1])[:4],
                    "eval_fails_list": eval_fails,
                    "sim_fails_list": sim_fails,
                }
            )

        topic_stats.sort(key=lambda x: -x["score"])

        lines.append("### 🚦 Semáforo de Prioridad de Estudio (09:55 – 12:15)")
        lines.append("")
        lines.append("| Prioridad | Tema CTO | MIR 15-25 (22-25) | Fallos Sims | Fallos Eval CTO | Subtemas / Focos que más fallas |")
        lines.append("| :--- | :--- | :---: | :---: | :---: | :--- |")

        for rank_i, ts in enumerate(topic_stats, 1):
            if rank_i <= 3 and ts["score"] > 0:
                badge = "🔴 **P1 · QUIRÚRGICO**"
            elif rank_i <= 6 and ts["score"] > 0:
                badge = "🟠 **P2 · NOTEBOOKLM**"
            else:
                badge = "🟢 **P3 · SOLO TEST**"
            focos = ", ".join(f"{k} ({v})" for k, v in ts["subtemas_fallados"]) if ts["subtemas_fallados"] else "Sin fallos críticos"
            lines.append(
                f"| {badge} | **{ts['titulo']}** | {ts['mir_15_25']} ({ts['mir_22_25']}) | {ts['sim_fails']}/{ts['sim_total']} | {ts['eval_fails']} | {focos} |"
            )

        lines.append("")
        lines.append(generate_notebooklm_pack(target_date, code, app_asig, topic_stats, mapa_textos, est.get("bloque_num")))

        top3 = [t["titulo"] for t in topic_stats[:3]]
        lines.append(f"### 🎯 Plan de Acción Exacto para Hoy ({app_asig})")
        lines.append(f"1. **09:00 – 09:30 (30m):** Sprint 1 Anki (`MIR 2027`).")
        lines.append(f"2. **09:30 – 09:55 (25m):** Corrección exprés de la Evaluación CTO de anoche + 1ª baraja SmartCards.")
        lines.append(
            f"3. **09:55 – 12:15 (2h 20m):** Videoclase CTO + Navegación Quirúrgica en **NotebookLM** **SOLO** de tus temas P1/P2: **{', '.join(top3)}**."
        )
        lines.append(
            f"4. **12:15 – 13:30 (1h 15m):** En nuestra App (`Desgloses`), pulsa **🌅 Motor 1 · Mañana (45 preg)** con esos 3 temas seleccionados y corrígelo en el chat."
        )
        lines.append(f"5. **15:00 – 15:40 (40m):** Café + Sprint 2 Anki (30m) + SmartCards (10m). Prohibido Anki después de las 15:40.")
        lines.append(
            f"6. **15:40 – 17:20 (1h 40m):** En nuestra App, pulsa **📘 Motor 2 · Tarde 1 (60 preg · Barrido {app_asig})** + corrección rápida."
        )
        lines.append(
            f"7. **17:35 – 19:20 (1h 45m):** En nuestra App, pulsa **🌍 Motor 3 · Tarde 2 (60 preg · Mixto Adaptativo P80)** + corrección rápida."
        )
        lines.append(f"8. **19:30 – 20:00:** Misa y desconexión mental.")
        lines.append(
            f"9. **20:00 – 20:45 (45m):** En Campus CTO, haz la **Evaluación {code}** + **Mi evaluación** del tirón (sin pararte a corregir; mañana a las 09:30 tendrás la guía lista)."
        )
        lines.append("")

        if ESCUELA_MEDICA_PATH.exists():
            em_cat = json.loads(ESCUELA_MEDICA_PATH.read_text(encoding="utf-8"))
            em_asig = em_cat.get(app_asig)
            if em_asig and em_asig.get("videos"):
                lines.append(f"### 🎬 Vídeos de @EscuelaMedica Disponibles para {app_asig} (Modo Sustitución 09:55–12:15)")
                lines.append(
                    "> 💡 **Regla de Oro (0 minutos extra):** En los temas P1 que tengan vídeo aquí, **sustituye** la lectura del manual / videoclase de CTO por el vídeo de Escuela Médica a `1.5x` y haz captura (`Cmd+Shift+4`) de sus mejores diapositivas para tus Ankis."
                )
                for v in em_asig["videos"]:
                    lines.append(f"- [{v['title']}]({v['url']})")
                lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Preparador diario de 3ª Vuelta MIR 2027")
    parser.add_argument("--fecha", type=str, default=None, help="Fecha objetivo YYYY-MM-DD")
    parser.add_argument("--no-sync", action="store_true", help="Omitir sincronización en vivo con Campus CTO")
    args = parser.parse_args()

    if args.no_sync and EVAL_PATH.exists():
        eval_qs = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
    else:
        env = load_env()
        req_json = create_cto_client(
            env.get("CTO_EMAIL", "josepedro.garcia@mail.ucv.es"),
            env.get("CTO_PASSWORD", "cTo25c@Mpu$"),
        )
        print("Sincronizando Evaluaciones CTO en vivo...")
        eval_qs, newly_added = sync_and_audit_recent_evaluaciones(req_json)
        print(f"Total preguntas en evaluaciones_cto.json: {len(eval_qs)} (Nuevas detectadas hoy: {len(newly_added)})")

    plan_events = json.loads(PLAN_PATH.read_text(encoding="utf-8")) if PLAN_PATH.exists() else []
    target_date = find_target_date(plan_events, args.fecha)

    briefing_md = build_morning_briefing(target_date, plan_events, eval_qs)

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_file = EXPORTS_DIR / f"briefing_3v_{target_date}.md"
    out_file.write_text(briefing_md, encoding="utf-8")
    print(f"\nBriefing generado en: {out_file}\n")
    print(briefing_md)


if __name__ == "__main__":
    main()
