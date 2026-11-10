#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de Inyección y Sincronización de Smartcards Atómicas MIR
==============================================================
- Mantiene `src/data/smartcardsData.json` como almacén principal de Smartcards Atómicas.
- Sincroniza automáticamente cualquier tarjeta inyectada en `src/data/flashcardsData.json`
  (como `S20-Rev-01`..`S20-Rev-33` u otras correcciones de otros chats) convirtiendo el
  formato `"Pregunta → Respuesta (matiz)"` en `pregunta`, `respuesta` atómica y `perla`.
"""

import os
import re
import json
import time
import hashlib
import unicodedata

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SMARTCARDS_JSON_PATH = os.path.join(ROOT_DIR, "src", "data", "smartcardsData.json")
FLASHCARDS_LEGACY_PATH = os.path.join(ROOT_DIR, "src", "data", "flashcardsData.json")

SUBJECT_MAP = {
    "ginecologia y obstetricia": "Ginecología y Obstetricia",
    "fisiologia": "Fisiología",
    "reumatologia": "Reumatología",
    "traumatologia": "Traumatología",
    "cardiologia": "Cardiología",
    "endocrino": "Endocrinología",
    "endocrinologia": "Endocrinología",
    "infecciosas": "Infecciosas",
    "neumologia": "Neumología",
    "genetica": "Genética",
    "anestesia": "Anestesiología",
    "pediatria": "Pediatría",
    "psiquiatria": "Psiquiatría",
    "neurologia": "Neurología",
    "nefrologia": "Nefrología",
    "hematologia": "Hematología",
    "digestivo": "Digestivo",
    "urologia": "Urología",
    "oftalmologia": "Oftalmología",
    "orl": "ORL",
    "otorrinolaringologia": "ORL",
    "dermatologia": "Dermatología",
    "oncologia": "Oncología",
}


def normalize_subject(raw_asig):
    if not raw_asig:
        return "General"
    norm = unicodedata.normalize("NFKD", raw_asig).encode("ascii", "ignore").decode("ascii").lower().strip()
    return SUBJECT_MAP.get(norm, raw_asig.strip())


def parse_arrow_card_text(texto):
    """
    Convierte una cadena con formato:
      'Pregunta → Respuesta corta (matiz o explicación adicional).'
    en (pregunta, respuesta, perla).
    """
    if "→" in texto:
        parts = texto.split("→", 1)
        pregunta = parts[0].strip().rstrip(":")
        rhs = parts[1].strip()
    else:
        pregunta = texto.strip()
        rhs = ""

    perla = ""
    respuesta = rhs

    # Si hay un segundo '→' dentro de la respuesta (ej. tríada -> actitud), separarlo en respuesta + perla
    if "→" in rhs:
        subparts = rhs.split("→", 1)
        respuesta = subparts[0].strip()
        perla = subparts[1].strip()
    else:
        # Si termina en un paréntesis largo explicativo: "Útero septo (tabique interno...)."
        m = re.match(r"^([^()]{3,65}?)\s*\(([^()]{12,})\)\.?$", rhs)
        if m:
            respuesta = m.group(1).strip()
            perla = m.group(2).strip()
            if perla and not perla.endswith("."):
                perla += "."
        elif ". " in rhs and len(rhs) > 85:
            s_parts = rhs.split(". ", 1)
            respuesta = s_parts[0].strip()
            perla = s_parts[1].strip()

    return pregunta, respuesta, perla


def infer_origin_and_tag(card_id):
    cid = str(card_id)
    m_sim = re.match(r"^S(\d+)[-_](.+)$", cid, flags=re.IGNORECASE)
    if m_sim:
        sim_num = m_sim.group(1)
        ref = m_sim.group(2)
        return "simulacro", f"Simulacro {sim_num}", ref
    if cid.lower().startswith("tirada"):
        return "tirada", "Tirada Diaria", cid
    return "simulacro", "Corrección MIR", cid


def render_atomic_front_html(asignatura, pregunta):
    return (
        f"<div class='sc-atomic-front'>"
        f"<div class='sc-atomic-subject'>{asignatura}</div>"
        f"<div class='sc-atomic-question'>{pregunta}</div>"
        f"</div>"
    )


def render_atomic_back_html(respuesta, perla=""):
    perla_html = f"<div class='sc-atomic-pearl'>💡 {perla}</div>" if perla else ""
    return (
        f"<div class='sc-atomic-back'>"
        f"<div class='sc-atomic-answer-box'>"
        f"<div class='sc-atomic-answer-label'>RESPUESTA</div>"
        f"<div class='sc-atomic-answer-value'>{respuesta}</div>"
        f"</div>"
        f"{perla_html}"
        f"</div>"
    )


def load_smartcards():
    if not os.path.exists(SMARTCARDS_JSON_PATH):
        return []
    try:
        with open(SMARTCARDS_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_smartcards(cards):
    os.makedirs(os.path.dirname(SMARTCARDS_JSON_PATH), exist_ok=True)
    with open(SMARTCARDS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)


def upsert_smartcards(cards_input, origen="simulacro", fuente_tag="Simulacro CTO"):
    existing = load_smartcards()
    by_id = {c["id"]: c for c in existing}
    now_ms = int(time.time() * 1000)
    added, updated = 0, 0

    for idx, item in enumerate(cards_input):
        asignatura = normalize_subject(item.get("asignatura", "General"))
        pregunta = item.get("pregunta", "").strip()
        respuesta = item.get("respuesta", "").strip()
        perla = item.get("perla", "").strip()
        f_tag = item.get("fuenteTag") or fuente_tag
        orig = item.get("origen") or origen
        ref = item.get("preguntaRef")

        q_hash = hashlib.sha1(pregunta.encode("utf-8")).hexdigest()[:10]
        card_id = item.get("id") or f"sc_{f_tag.lower().replace(' ', '_')}_{q_hash}"

        card_obj = {
            "id": str(card_id),
            "asignatura": asignatura,
            "titulo": pregunta,
            "pregunta": pregunta,
            "respuesta": respuesta,
            "perla": perla,
            "frontHtml": render_atomic_front_html(asignatura, pregunta),
            "backHtml": render_atomic_back_html(respuesta, perla),
            "origen": orig,
            "fuenteTag": f_tag,
            "preguntaRef": ref,
            "createdAt": by_id.get(str(card_id), {}).get("createdAt", now_ms + idx),
            "initialWeight": 1.0,
        }

        if str(card_id) in by_id:
            by_id[str(card_id)].update(card_obj)
            updated += 1
        else:
            by_id[str(card_id)] = card_obj
            added += 1

    final_list = list(by_id.values())
    save_smartcards(final_list)
    return {"added": added, "updated": updated, "total": len(final_list)}


def sync_from_legacy_flashcards():
    """
    Detecta cualquier tarjeta de corrección inyectada en `src/data/flashcardsData.json`
    (ej. `S20-Rev-01`..`S20-Rev-33`) y la incorpora como Smartcard Atómica.
    """
    if not os.path.exists(FLASHCARDS_LEGACY_PATH):
        return 0
    with open(FLASHCARDS_LEGACY_PATH, "r", encoding="utf-8") as f:
        legacy = json.load(f)

    injected = []
    for item in legacy:
        cid = str(item.get("id", ""))
        imp = item.get("importancia", "normal")
        texto = item.get("texto", "")
        if imp != "normal" or re.match(r"^(S\d+|T\d+|Sim|Tirada)", cid, flags=re.IGNORECASE):
            pregunta, respuesta, perla = parse_arrow_card_text(texto)
            origen, f_tag, ref = infer_origin_and_tag(cid)
            injected.append({
                "id": cid,
                "asignatura": normalize_subject(item.get("asignatura", "General")),
                "pregunta": pregunta,
                "respuesta": respuesta,
                "perla": perla,
                "origen": origen,
                "fuenteTag": f_tag,
                "preguntaRef": ref,
            })

    if injected:
        res = upsert_smartcards(injected)
        return len(injected)
    return 0


if __name__ == "__main__":
    n = sync_from_legacy_flashcards()
    total = len(load_smartcards())
    print(f"✅ Sincronizadas {n} tarjetas desde flashcardsData.json (Simulacro 20). Total en Smartcards: {total}")
