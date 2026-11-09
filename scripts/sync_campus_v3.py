#!/usr/bin/env python3
"""
Sincroniza desde el Campus CTO (MIR.14.2627):
1. El calendario completo de 2ª y 3ª Vuelta (2026-06-15 a 2027-01-31) con sus bloques de Estudio y resúmenes Markdown en src/data/planificacionCTO.json.
2. Las preguntas de Evaluaciones CTO realizadas (revision_preguntas_evaluacion) con porcentaje poblacional e imágenes en src/data/evaluaciones_cto.json.
3. El ranking de temas/clasificaciones falladas en Campus CTO en src/data/cto_clasificaciones_falladas.json.
"""

import os
import re
import json
import urllib.request
import urllib.parse
import http.cookiejar
from pathlib import Path

ENV_PATH = Path(".env")
PLAN_PATH = Path("src/data/planificacionCTO.json")
EVAL_PATH = Path("src/data/evaluaciones_cto.json")
FALLADAS_PATH = Path("src/data/cto_clasificaciones_falladas.json")
IMG_DIR = Path("public/img")

BASE_API = "https://campus-app.grupocto.com"
OVH_IMG_BASE = "https://materiales.s3.gra.io.cloud.ovh.net/campus/images/preguntas"

EXPEDIENTE_ID = "c5b75a71-f844-4fdc-84da-0fce2924bf63"
GRUPO_ID = "ef391c35-54e2-4013-9c65-623be7bb6446"
EDICION_ID = "bf38133d-d2f7-4139-bf18-28a69c52bad8"

# Mapeo de nombres de asignaturas en API CTO -> Asignaturas de nuestra App
CTO_ASIG_TO_APP = {
    "Alergología": "Alergología",
    "Anatomía": "Anatomía",
    "Anatomía patológica": "Anatomía Patológica",
    "Anatomía Patológica": "Anatomía Patológica",
    "Anestesiología": "Anestesiología",
    "Bioética y medicina legal": "Miscelánea",
    "Bioética y Medicina Legal": "Miscelánea",
    "Bioquímica": "Bioquímica",
    "Cardiología": "Cardiología",
    "Cirugía general": "Cirugía General",
    "Cirugía General": "Cirugía General",
    "Dermatología": "Dermatología",
    "Digestivo": "Digestivo",
    "Endocrinología": "Endocrinología",
    "Endocrinología y metabolismo": "Endocrinología",
    "Endocrinología y Metabolismo": "Endocrinología",
    "Estadística y epidemiología": "Estadística y Epidemiología",
    "Estadística y Epidemiología": "Estadística y Epidemiología",
    "Farmacología": "Farmacología",
    "Fisiología": "Fisiología",
    "Genética": "Genética",
    "Geriatría": "Geriatría",
    "Ginecología y obstetricia": "Ginecología y Obstetricia",
    "Ginecología y Obstetricia": "Ginecología y Obstetricia",
    "Hematología": "Hematología",
    "Infecciosas": "Infecciosas",
    "Enfermedades infecciosas": "Infecciosas",
    "Inmunología": "Inmunología",
    "Medicina familiar y comunitaria": "Medicina Familiar y Comunitaria",
    "Medicina Familiar y Comunitaria": "Medicina Familiar y Comunitaria",
    "Medicina preventiva": "Medicina Preventiva",
    "Medicina Preventiva": "Medicina Preventiva",
    "Nefrología": "Nefrología",
    "Neumología": "Neumología",
    "Neurología": "Neurología",
    "Oftalmología": "Oftalmología",
    "Oncología": "Oncología",
    "Oncología médica y Paciente terminal": "Oncología",
    "Otorrinolaringología": "Otorrinolaringología",
    "Pediatría": "Pediatría",
    "Psiquiatría": "Psiquiatría",
    "Radiología": "Radiología",
    "Reumatología": "Reumatología",
    "Traumatología": "Traumatología",
    "Urgencias": "Urgencias",
    "Urología": "Urología",
}


def load_env():
    env = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def create_cto_client(email, password):
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    def request_json(method, path, body=None):
        url = f"{BASE_API}{path}"
        headers = {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with opener.open(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None

    request_json("POST", "/auth/login?useCookies=true", {"email": email, "password": password})
    request_json("POST", "/auth/session", {"expedienteId": EXPEDIENTE_ID})
    return request_json


def extract_title_from_resumen(resumen_md, fallback_idx=1):
    if not resumen_md:
        return f"Tema {fallback_idx}"
    cleaned = re.sub(r"<br\s*/?>", "\n", resumen_md, flags=re.IGNORECASE)
    for line in cleaned.splitlines():
        s = line.strip()
        if s.startswith("# "):
            return s[2:].strip()
    return f"Tema {fallback_idx}"


def parse_event_fields(ev):
    """Convierte un evento crudo del calendario CTO al esquema de planificacionCTO.json."""
    fecha_inicio_raw = ev.get("fecha_inicio") or ""
    fecha_fin_raw = ev.get("fecha_fin") or ""
    fecha = fecha_inicio_raw[:10] if len(fecha_inicio_raw) >= 10 else None
    hora_inicio = fecha_inicio_raw[11:16] if len(fecha_inicio_raw) >= 16 else "08:00"
    hora_fin = fecha_fin_raw[11:16] if len(fecha_fin_raw) >= 16 else None

    nombre = (ev.get("asunto") or ev.get("nombre") or ev.get("descripcion") or "").strip()
    raw_cat = (ev.get("categoria") or ev.get("tipo") or "").strip()

    if raw_cat == "Tarjetas personalizadas" or "SmartCards" in nombre:
        categoria = "SmartCards"
    elif raw_cat:
        categoria = raw_cat
    else:
        categoria = "Estudio"

    asignatura = ev.get("asignatura")
    if not asignatura:
        m_asig = re.search(
            r"\b(AL|AT|AP|AN|BL|BQ|CD|CG|DM|DG|ED|EP|FC|FM|FS|GC|GR|GT|HM|IF|IG|MP|NF|NM|NR|OF|ON|OR|PD|PQ|RH|RM|RX|TM|UG|UR)\b",
            nombre,
        )
        if m_asig:
            asignatura = m_asig.group(1)
    if asignatura == "MP":
        asignatura = "EP"

    bloque_num = ev.get("numero")
    if not bloque_num:
        m_blq = re.search(r"\(B(\d+)\)", nombre)
        bloque_num = int(m_blq.group(1)) if m_blq else None

    vuelta = ev.get("vuelta") or (3 if (fecha and fecha >= "2026-11-05") else 2)

    return {
        "fecha": fecha,
        "hora_inicio": hora_inicio,
        "hora_fin": hora_fin,
        "nombre": nombre,
        "categoria": categoria,
        "asignatura": asignatura,
        "vuelta": vuelta,
        "bloque_num": bloque_num,
        "temas": [],
        "_url": ev.get("url"),
        "_visible": ev.get("visible_en_calendario", True),
    }


def sync_calendar(request_json):
    print("1) Descargando calendario CTO (2026-06-15 a 2027-01-31)...")
    res = request_json(
        "POST",
        "/api/campus/eventos/intervalo",
        {
            "grupo_id": GRUPO_ID,
            "fecha_inicial": "2026-06-15",
            "fecha_final": "2027-01-31",
        },
    )
    eventos = res if isinstance(res, list) else (res.get("eventos", []) if isinstance(res, dict) else [])
    print(f"   Eventos recibidos del Campus CTO: {len(eventos)}")

    parsed_events = [parse_event_fields(ev) for ev in eventos]
    parsed_events = [e for e in parsed_events if e["fecha"] and e["_visible"] is not False]

    # Descargar detalles de bloques de Estudio de 3ª Vuelta (y desde octubre 2026)
    estudio_urls = sorted(
        {
            e["_url"]
            for e in parsed_events
            if e["_url"] and len(str(e["_url"])) > 10 and e["categoria"] == "Estudio" and e["fecha"] >= "2026-10-15"
        }
    )
    print(f"   Descargando detalles de {len(estudio_urls)} bloques de Estudio (resúmenes, esquemas, temas)...")

    bloque_cache = {}
    for idx, url_id in enumerate(estudio_urls, 1):
        try:
            detail = request_json("GET", f"/api/campus/estudio/bloque/{url_id}")
            raw_temas = detail.get("temas", []) if isinstance(detail, dict) else []
            temas_list = []
            for t_idx, est in enumerate(raw_temas, 1):
                resumen_md = est.get("resumen") or None
                titulo = extract_title_from_resumen(resumen_md, t_idx)
                temas_list.append(
                    {
                        "orden": int(est.get("orden") or t_idx),
                        "titulo": titulo,
                        "tiene_video": bool(est.get("video") or est.get("videoclase")),
                        "resumen": resumen_md,
                        "esquema_file": est.get("esquema") or None,
                        "adenda_file": est.get("adenda") or None,
                        "mindmap": est.get("mindmap") or None,
                    }
                )
            bloque_cache[url_id] = temas_list
        except Exception as ex:
            print(f"   [WARN] Error en bloque {url_id}: {ex}")

    temas_by_day_asig = {}
    for e in parsed_events:
        url_id = e.pop("_url", None)
        e.pop("_visible", None)
        if url_id and url_id in bloque_cache:
            e["temas"] = bloque_cache[url_id]
            if e["asignatura"]:
                temas_by_day_asig[(e["fecha"], e["asignatura"])] = bloque_cache[url_id]

    for e in parsed_events:
        if not e["temas"] and e["categoria"] in ("Desgloses", "SmartCards") and e["asignatura"]:
            key = (e["fecha"], e["asignatura"])
            if key in temas_by_day_asig:
                e["temas"] = temas_by_day_asig[key]

    existing = []
    if PLAN_PATH.exists():
        existing = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    preserved = [item for item in existing if (item.get("fecha") or "") < "2026-06-15"]
    merged = preserved + parsed_events

    PLAN_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    v3_count = sum(1 for e in parsed_events if e["vuelta"] == 3)
    print(f"   Guardado planificacionCTO.json: {len(merged)} eventos totales ({v3_count} eventos de 3ª Vuelta).")


def sync_evaluaciones(request_json):
    print("2) Descargando banco de preguntas de Evaluaciones CTO realizadas...")
    path = (
        f"/api/campus/preguntas/filtros?tipoPregunta=revision_preguntas_evaluacion"
        f"&edicionId={EDICION_ID}&grupoId={GRUPO_ID}&expedienteId={EXPEDIENTE_ID}"
        f"&simulacros=&convocatorias=&asignaturas=&temas=&soloImagen=false"
    )
    res = request_json("GET", path)
    raw_qs = res if isinstance(res, list) else (res.get("preguntas", []) if isinstance(res, dict) else [])
    print(f"   Preguntas de Evaluación recibidas: {len(raw_qs)}")

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    formatted_qs = []
    failed_or_blank = 0
    imgs_downloaded = 0

    for idx, rq in enumerate(raw_qs, 1):
        qid = rq.get("id")
        correcta = int(rq.get("correcta") or 1)
        user_resp = rq.get("respuesta")
        resultado = int(rq.get("resultado") or 0)  # 1=acierto, -1=fallo, 0=blanco
        if resultado != 1:
            failed_or_blank += 1

        opciones_elegidas = rq.get("opciones_elegidas") or []
        total_votes = sum(int(o.get("cuenta") or 0) for o in opciones_elegidas)
        votes_by_opt = {int(o.get("respuesta") or 0): int(o.get("cuenta") or 0) for o in opciones_elegidas}
        pct_correcta = round((votes_by_opt.get(correcta, 0) / total_votes) * 100) if total_votes > 0 else 50

        opts_list = []
        raw_resps = rq.get("respuestas") or []
        for opt_i, r_opt in enumerate(raw_resps, 1):
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
                    imgs_downloaded += 1
                except Exception as ex:
                    print(f"   [WARN] No se pudo descargar imagen {img_url}: {ex}")
            if dest_img.exists():
                local_img = safe_name

        raw_asig = (rq.get("asignatura") or "Miscelánea").strip()
        app_asig = CTO_ASIG_TO_APP.get(raw_asig, raw_asig)

        formatted_qs.append(
            {
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
        )

    EVAL_PATH.write_text(json.dumps(formatted_qs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"   Guardado evaluaciones_cto.json: {len(formatted_qs)} preguntas ({failed_or_blank} falladas/blancas, {imgs_downloaded} imágenes nuevas descargadas)."
    )


def sync_clasificaciones_falladas(request_json):
    print("3) Descargando estadísticas de clasificaciones falladas en Campus CTO...")
    res = request_json("GET", f"/api/campus/autoevaluaciones/clasificaciones/falladas/{EXPEDIENTE_ID}")
    clasif = res if isinstance(res, list) else (res.get("clasificaciones", []) if isinstance(res, dict) else [])
    FALLADAS_PATH.write_text(json.dumps(clasif, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"   Guardado cto_clasificaciones_falladas.json: {len(clasif)} registros.")


def main():
    env = load_env()
    email = env.get("CTO_EMAIL", "josepedro.garcia@mail.ucv.es")
    password = env.get("CTO_PASSWORD", "cTo25c@Mpu$")
    req_json = create_cto_client(email, password)
    sync_calendar(req_json)
    sync_evaluaciones(req_json)
    sync_clasificaciones_falladas(req_json)
    print("\n¡Sincronización con Campus CTO completada con éxito!")


if __name__ == "__main__":
    main()
