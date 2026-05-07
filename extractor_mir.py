"""
Extractor de planificación de estudio - Campus CTO MIR
Requiere: pip install requests

CÓMO OBTENER LAS COOKIES:
1. Abre campus-app.grupocto.com en Chrome y haz login
2. F12 → Network → recarga la página → clic en cualquier petición a campus-app.grupocto.com
3. En "Request Headers" copia el valor completo de "Cookie"
4. Pégalo en la variable COOKIE_STRING de abajo
"""

import requests
import json
import csv
import re
import time
from datetime import date

# ── CONFIGURA ESTO ────────────────────────────────────────────────────────────
COOKIE_STRING = "PEGA_AQUÍ_TU_COOKIE_STRING"  # copiado de DevTools → Network → Headers
GRUPO_ID = "PEGA_AQUÍ_TU_GRUPO_ID"            # lo ves en localStorage campus_state > state > grupo > id
FECHA_INICIO = "2025-09-01"
FECHA_FIN = "2026-07-31"
DELAY_ENTRE_PETICIONES = 0.15  # segundos
# ──────────────────────────────────────────────────────────────────────────────

BASE = "https://campus-app.grupocto.com"

def build_session(cookie_string: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0",
        "Referer": BASE,
    })
    for part in cookie_string.split(";"):
        part = part.strip()
        if "=" in part:
            name, _, value = part.partition("=")
            session.cookies.set(name.strip(), value.strip(), domain="campus-app.grupocto.com")
    return session


def get_eventos(session: requests.Session, grupo_id: str, fecha_inicio: str, fecha_fin: str) -> list:
    resp = session.post(
        f"{BASE}/api/campus/eventos/intervalo",
        json={"grupo_id": grupo_id, "fecha_inicial": fecha_inicio, "fecha_final": fecha_fin}
    )
    resp.raise_for_status()
    return resp.json()


def get_bloque(session: requests.Session, bloque_id: str) -> dict | None:
    resp = session.get(f"{BASE}/api/campus/estudio/bloque/{bloque_id}")
    if not resp.ok or not resp.text.strip():
        return None
    return resp.json()


def extract_title(markdown: str | None) -> str | None:
    if not markdown:
        return None
    match = re.search(r'^#+\s+(.+)$', markdown, re.MULTILINE)
    return match.group(1).strip() if match else markdown[:80]


def extract_all(grupo_id: str, cookie_string: str, fecha_inicio: str, fecha_fin: str) -> list[dict]:
    session = build_session(cookie_string)

    print("Obteniendo todos los eventos del curso...")
    todos = get_eventos(session, grupo_id, fecha_inicio, fecha_fin)
    estudios = [e for e in todos if e.get("categoria") == "Estudio" and e.get("url")]
    print(f"Total eventos: {len(todos)} | Bloques de estudio a extraer: {len(estudios)}")

    # Obtener temas solo para Estudio (Desgloses comparte el mismo bloque)
    bloque_map: dict[str, list] = {}
    for i, evento in enumerate(estudios):
        fecha = evento["fecha_inicio"][:10]
        nombre = evento["asunto"]
        bloque_id = evento["url"]
        print(f"[{i+1}/{len(estudios)}] {fecha} - {nombre}")

        bloque = get_bloque(session, bloque_id)
        if bloque and bloque.get("temas"):
            bloque_map[bloque_id] = [
                {
                    "orden": t["orden"] + 1,
                    "titulo": extract_title(t.get("resumen")),
                    "resumen": t.get("resumen"),
                }
                for t in bloque["temas"]
            ]
        time.sleep(DELAY_ENTRE_PETICIONES)

    # Construir resultado completo para todos los eventos (sin más peticiones)
    resultado = []
    for evento in todos:
        if not evento.get("fecha_inicio"):
            continue
        resultado.append({
            "fecha": evento["fecha_inicio"][:10],
            "hora_inicio": evento["fecha_inicio"][11:16],
            "hora_fin": evento["fecha_fin"][11:16] if evento.get("fecha_fin") else None,
            "nombre": evento.get("asunto", ""),
            "categoria": evento.get("categoria", ""),
            "asignatura": evento.get("asignatura"),
            "vuelta": evento.get("vuelta"),
            "bloque_num": evento.get("numero"),
            "temas": bloque_map.get(evento.get("url", ""), []),
        })

    return resultado


def save_json(data: list, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON guardado: {path}")


def save_csv(data: list, path: str):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["fecha", "hora_inicio", "hora_fin", "nombre", "asignatura", "vuelta", "bloque_num", "temas"])
        for d in data:
            temas_str = " | ".join(f"{t['orden']}. {t['titulo']}" for t in d.get("temas", []))
            writer.writerow([
                d["fecha"], d.get("hora_inicio"), d.get("hora_fin"),
                d["nombre"], d.get("asignatura"), d.get("vuelta"),
                d.get("bloque_num"), temas_str
            ])
    print(f"CSV guardado: {path}")


if __name__ == "__main__":
    resultado = extract_all(GRUPO_ID, COOKIE_STRING, FECHA_INICIO, FECHA_FIN)
    today = date.today().isoformat()
    save_json(resultado, f"planificacion_estudio_MIR_{today}.json")
    save_csv(resultado, f"planificacion_estudio_MIR_{today}.csv")
    ok = sum(1 for r in resultado if r.get("temas"))
    print(f"\n✓ Extracción completa: {ok}/{len(resultado)} bloques con temas")
