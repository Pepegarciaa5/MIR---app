#!/usr/bin/env python3
import os
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://materiales.s3.gra.io.cloud.ovh.net/campus/images/preguntas"
DEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../public/img/preguntas"))
FILES = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../src/data/simulacros_textos.json")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../src/data/desgloses_filtrables.json"))
]

def get_all_images():
    images = set()
    for fpath in FILES:
        if not os.path.exists(fpath):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                img = item.get("imagen_nombre")
                if img and isinstance(img, str) and img.strip():
                    images.add(img.strip())
    return sorted(list(images))

def download_image(img_name):
    dest_path = os.path.join(DEST_DIR, img_name)
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        return (img_name, True, "already_exists")
    
    url = f"{BASE_URL}/{img_name}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
    
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            with open(dest_path, "wb") as out_f:
                out_f.write(content)
        return (img_name, True, "downloaded")
    except Exception as e:
        return (img_name, False, str(e))

def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    images = get_all_images()
    total = len(images)
    print(f"📦 Total de imágenes encontradas: {total}")
    print(f"📁 Destino local: {DEST_DIR}")

    success_count = 0
    fail_count = 0
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download_image, img): img for img in images}
        done = 0
        for future in as_completed(futures):
            done += 1
            img_name, ok, reason = future.result()
            if ok:
                success_count += 1
            else:
                fail_count += 1
                print(f"⚠️ Error descargando {img_name}: {reason}")
            
            if done % 100 == 0 or done == total:
                elapsed = time.time() - start_time
                print(f"⏳ Progreso: {done}/{total} ({done*100//total}%) - {success_count} OK, {fail_count} errores - {elapsed:.1f}s")

    total_size_mb = sum(
        os.path.getsize(os.path.join(DEST_DIR, f))
        for f in os.listdir(DEST_DIR)
        if os.path.isfile(os.path.join(DEST_DIR, f))
    ) / (1024 * 1024)

    print(f"\n🎉 ¡Finalizado en {time.time() - start_time:.1f} segundos!")
    print(f"✅ {success_count} imágenes listas localmente.")
    print(f"💾 Tamaño total en disco: {total_size_mb:.2f} MB")

if __name__ == "__main__":
    main()
