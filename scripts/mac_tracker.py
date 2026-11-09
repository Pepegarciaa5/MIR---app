#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/mac_tracker.py
======================
Daemon de rastreo de actividad nativo de macOS para MIR 2027.
- Sin software de pago ni extensiones: utiliza AppleScript e IOHIDSystem de macOS.
- Mide actividad cada 3 segundos.
- Pausa automática tras 2 minutos (120s) de inactividad de teclado/ratón.
- Whitelist médica estricta en Chrome (Campus CTO, NotebookLM, App MIR, EscuelaMédica).
- Escribe el estado en tiempo real en `src/data/live_tracker.json`.
"""

import os
import sys
import time
import json
import subprocess
import re
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_FILE = ROOT_DIR / "src" / "data" / "live_tracker.json"
HISTORY_FILE = ROOT_DIR / "src" / "data" / "tracker_auto_sessions.json"

IDLE_THRESHOLD_SECONDS = 120  # 2 minutos sin teclado/ratón = pausa

# Whitelist de webs de estudio permitidas en Chrome
CHROME_STUDY_DOMAINS = [
    ("localhost", "Test en App / Desgloses MIR"),
    ("127.0.0.1", "Test en App / Desgloses MIR"),
    ("campus-app.grupocto.com", "Campus CTO (Evaluaciones / Clases)"),
    ("campus.grupocto.com", "Campus CTO (Evaluaciones / Clases)"),
    ("grupocto.com", "Campus CTO"),
    ("notebooklm.google.com", "Estudio Quirúrgico (NotebookLM)"),
    ("docs.google.com", "Apuntes / Perlas MIR"),
    ("youtube.com", "Vídeo de Estudio (YouTube)"),  # Verificado con título
    ("youtu.be", "Vídeo de Estudio (YouTube)")
]

APP_MAP = {
    "Anki": "Repaso Anki (MIR 2027)",
    "Preview": "Manual CTO / Esquemas (PDF)",
    "Vista Previa": "Manual CTO / Esquemas (PDF)",
    "Skim": "Manual CTO / Esquemas (PDF)",
    "Adobe Acrobat": "Manual CTO (Acrobat)",
    "Acrobat Reader": "Manual CTO (Acrobat)",
    "Goodnotes": "Apuntes Manuales (GoodNotes)",
    "Notability": "Apuntes Manuales (Notability)"
}


def get_hardware_idle_seconds():
    """Obtiene los segundos de inactividad global del Mac (teclado/ratón) vía IOHIDSystem."""
    try:
        out = subprocess.check_output(["ioreg", "-c", "IOHIDSystem"], timeout=1.5).decode("utf-8", errors="ignore")
        m = re.search(r'"HIDIdleTime"\s*=\s*([0-9]+)', out)
        if m:
            idle_ns = int(m.group(1))
            return idle_ns / 1_000_000_000.0
    except Exception:
        pass
    return 0.0


def get_frontmost_app():
    """Obtiene el nombre de la aplicación actualmente en primer plano."""
    cmd = 'tell application "System Events" to get name of first application process whose frontmost is true'
    try:
        res = subprocess.check_output(["osascript", "-e", cmd], timeout=1.5).decode("utf-8", errors="ignore").strip()
        return res
    except Exception:
        return ""


def get_chrome_active_tab():
    """Obtiene (title, url) de la pestaña activa en Google Chrome sin registrar navegación privada."""
    cmd = 'tell application "Google Chrome" to get {title, URL} of active tab of front window'
    try:
        res = subprocess.check_output(["osascript", "-e", cmd], timeout=1.5).decode("utf-8", errors="ignore").strip()
        parts = [p.strip() for p in res.split(", ")]
        if len(parts) >= 2:
            title = ", ".join(parts[:-1])
            url = parts[-1]
            return title, url
    except Exception:
        pass
    return "", ""


def classify_activity(app_name):
    """
    Determina si la ventana activa es de estudio y devuelve (es_estudio, categoria, descripcion).
    Si no es de estudio, devuelve (False, None, None).
    """
    if not app_name:
        return False, None, None

    # 1. Apps nativas de estudio
    for target_app, label in APP_MAP.items():
        if target_app.lower() in app_name.lower():
            return True, "Estudio Nativo", label

    # 2. Navegador Google Chrome
    if "chrome" in app_name.lower():
        title, url = get_chrome_active_tab()
        if not url:
            return False, None, None
        
        url_lower = url.lower()
        title_lower = title.lower()

        # Filtrar por whitelist estricta
        for domain, desc in CHROME_STUDY_DOMAINS:
            if domain in url_lower:
                # Caso especial YouTube: solo si contiene términos médicos/CTO/MIR/escuela médica
                if "youtube" in domain:
                    keywords = ["escuela medica", "mir", "cto", "medicina", "dr.", "digestivo", "reuma", "nefro", "cardio"]
                    if any(kw in title_lower for kw in keywords):
                        return True, "Campus / Clases", f"Vídeo Médico: {title[:40]}"
                    return False, None, None
                return True, "Web de Estudio", desc

    return False, None, None


def main():
    print("🚀 [MIR Mac Tracker] Iniciando daemon de rastreo automático...")
    print("   - Pausa automática tras 120s de inactividad de teclado/ratón.")
    print("   - Whitelist médica en Chrome activa.")
    
    current_session = None
    last_tick_time = time.time()

    # Asegurar que el directorio de salida existe
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    while True:
        try:
            now = time.time()
            dt_now = datetime.now()
            delta = now - last_tick_time
            last_tick_time = now

            idle_sec = get_hardware_idle_seconds()
            is_idle = idle_sec >= IDLE_THRESHOLD_SECONDS

            front_app = get_frontmost_app()
            is_study, cat, desc = classify_activity(front_app)

            status_payload = {
                "timestamp": dt_now.isoformat(),
                "frontmost_app": front_app,
                "is_studying": bool(is_study and not is_idle),
                "is_idle": is_idle,
                "idle_seconds": round(idle_sec, 1),
                "categoria": cat if is_study and not is_idle else None,
                "descripcion": desc if is_study and not is_idle else None,
                "session_active": False,
                "session_duration_seconds": 0
            }

            if is_study and not is_idle:
                if current_session is None or current_session.get("descripcion") != desc:
                    # Iniciar nueva sesión o cambiar de actividad
                    current_session = {
                        "id": f"auto_{int(now)}",
                        "inicio": int(now * 1000),
                        "categoria": cat,
                        "descripcion": desc,
                        "segundos": 0,
                        "fecha": dt_now.strftime("%Y-%m-%d")
                    }
                else:
                    # Sumar tiempo a la sesión activa
                    current_session["segundos"] += int(delta)

                status_payload["session_active"] = True
                status_payload["session_id"] = current_session["id"]
                status_payload["session_duration_seconds"] = current_session["segundos"]
                status_payload["session_start"] = current_session["inicio"]
            else:
                # Si paramos de estudiar o entramos en inactividad, cerramos sesión si tenía >15s
                if current_session and current_session["segundos"] >= 15:
                    save_completed_session(current_session)
                current_session = None

            # Escribir estado para que la App React lo lea en tiempo real
            OUTPUT_FILE.write_text(json.dumps(status_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        except KeyboardInterrupt:
            print("\n🛑 Tracker detenido por el usuario.")
            if current_session and current_session["segundos"] >= 15:
                save_completed_session(current_session)
            # Limpiar payload activo
            OUTPUT_FILE.write_text(json.dumps({"is_studying": False, "session_active": False}, indent=2))
            break
        except Exception as e:
            # Silenciar errores transitorios para robustez
            pass

        time.sleep(3)


def save_completed_session(session):
    """Guarda sesiones completadas en `src/data/tracker_auto_sessions.json`."""
    try:
        data = []
        if HISTORY_FILE.exists():
            try:
                data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            except Exception:
                data = []
        session["fin"] = int(time.time() * 1000)
        data.insert(0, session)
        HISTORY_FILE.write_text(json.dumps(data[:500], ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


if __name__ == "__main__":
    main()
