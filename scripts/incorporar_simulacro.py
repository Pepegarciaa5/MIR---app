#!/usr/bin/env python3
"""
scripts/incorporar_simulacro.py
================================
Detecta automáticamente los archivos recién descargados de CTO en ~/Downloads:
  - simulacrosCTO.json (Stats completas)
  - simulacros_textos.json (Textos de las preguntas nuevas)
Fusiona los textos sin sobreescribir los anteriores, actualiza la base de datos de la app,
descarga las nuevas imágenes a public/img/preguntas/ y deja todo listo para auditar.
"""

import os
import sys
import glob
import json
import shutil
import subprocess

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOWNLOADS_DIR = os.path.expanduser("~/Downloads")

SRC_DATA = os.path.join(PROJECT_ROOT, "src/data")
CTO_TARGET = os.path.join(SRC_DATA, "simulacrosCTO.json")
TEXTOS_TARGET = os.path.join(SRC_DATA, "simulacros_textos.json")

def find_latest_file(pattern):
    matches = glob.glob(os.path.join(DOWNLOADS_DIR, pattern))
    if not matches:
        return None
    matches.sort(key=os.path.getmtime, reverse=True)
    return matches[0]

def main():
    print("🔍 Buscando descargas recientes en ~/Downloads...")
    
    cto_file = find_latest_file("simulacrosCTO*.json")
    textos_file = find_latest_file("simulacros_textos*.json")

    if not cto_file:
        print("❌ No se encontró ningún 'simulacrosCTO*.json' en ~/Downloads.")
        print("   Por favor ejecuta el script extractor en la consola del Campus CTO primero.")
        sys.exit(1)

    print(f"📄 Archivo de estadísticas detectado: {os.path.basename(cto_file)}")

    # 1. Leer simulacrosCTO nuevo
    with open(cto_file, "r", encoding="utf-8") as f:
        new_cto_data = json.load(f)

    sims = new_cto_data.get("simulacros", []) if isinstance(new_cto_data, dict) else []
    sim_nums = [s["numero"] for s in sims if "numero" in s]
    max_sim = max(sim_nums) if sim_nums else "desconocido"
    print(f"📊 Simulacros presentes en el archivo: {sim_nums} (Último: S{max_sim})")

    # 2. Hacer backup y copiar simulacrosCTO.json
    if os.path.exists(CTO_TARGET):
        shutil.copyfile(CTO_TARGET, os.path.join(SRC_DATA, "simulacrosCTO_backup.json"))
    shutil.copyfile(cto_file, CTO_TARGET)
    print(f"✅ src/data/simulacrosCTO.json actualizado (Total preguntas: {len(new_cto_data.get('preguntas', []))})")

    # 3. Procesar simulacros_textos.json
    if textos_file:
        print(f"📄 Archivo de textos detectado: {os.path.basename(textos_file)}")
        with open(textos_file, "r", encoding="utf-8") as f:
            new_textos = json.load(f)
        
        # Cargar existentes
        existing_textos = []
        if os.path.exists(TEXTOS_TARGET):
            shutil.copyfile(TEXTOS_TARGET, os.path.join(SRC_DATA, "simulacros_textos_backup.json"))
            with open(TEXTOS_TARGET, "r", encoding="utf-8") as f:
                try:
                    existing_textos = json.load(f)
                except Exception:
                    existing_textos = []

        # Crear mapa para fusionar sin duplicar
        mapa = {}
        for t in existing_textos:
            key = f"{t.get('simulacro')}-{t.get('numero_pregunta') or t.get('numero')}"
            mapa[key] = t

        agregados = 0
        actualizados = 0
        for t in new_textos:
            key = f"{t.get('simulacro')}-{t.get('numero_pregunta') or t.get('numero')}"
            if key in mapa:
                actualizados += 1
            else:
                agregados += 1
            mapa[key] = t

        merged_list = sorted(list(mapa.values()), key=lambda x: (x.get('simulacro', 0), x.get('numero_pregunta', 0)))

        with open(TEXTOS_TARGET, "w", encoding="utf-8") as f:
            json.dump(merged_list, f, ensure_ascii=False, indent=2)

        print(f"✅ src/data/simulacros_textos.json actualizado: {agregados} textos nuevos añadidos, {actualizados} actualizados (Total acumulado: {len(merged_list)})")
    else:
        print("⚠️ No se encontró 'simulacros_textos*.json'. Manteniendo textos existentes.")

    # 4. Descargar imágenes nuevas
    print("\n🖼️ Comprobando y descargando imágenes clínicas nuevas a public/img/preguntas/...")
    dl_script = os.path.join(PROJECT_ROOT, "scripts/download_images.py")
    if os.path.exists(dl_script):
        subprocess.run([sys.executable, dl_script])

    print("\n🎉 ¡Incorporación completada con éxito!")
    print(f"👉 Ahora puedes auditar el simulacro con: python3 scripts/auditar_simulacro.py --sim {max_sim}")

if __name__ == "__main__":
    main()
