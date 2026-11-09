#!/usr/bin/env python3
"""
Descarga y extrae con precisión geométrica (PyMuPDF bounding-box + unión de imágenes)
los 35 pares de PDFs de Test de Clase de 2ª Vuelta CTO (MIR.14.2627.*.2V.pdf).
Soporta tanto el formato estándar (1..N) como el formato por Casos Clínicos (CG.2V).
No sobrescribe ni elimina ninguna pregunta ni imagen de 1ª Vuelta.
"""

import os
import re
import json
import urllib.request
from pathlib import Path
import fitz  # PyMuPDF

BASE_URL = "https://materiales.s3.gra.io.cloud.ovh.net/campus/documentos/clasificaciones"
PDF_DIR = Path("PDFs_CTO/2V")
IMG_DIR = Path("public/img")
BANCO_PATH = Path("src/data/bancoPreguntas.json")

SUBJECT_MAPPING_2V = {
    "AN": "Anestesiología",
    "AP": "Anatomía Patológica",
    "BL": "Miscelánea",
    "BQ": "Bioquímica",
    "CD": "Cardiología",
    "CG": "Cirugía General",
    "DG": "Digestivo",
    "DM": "Dermatología",
    "ED": "Endocrinología",
    "EP": "Estadística y Epidemiología",
    "EP.ET": "Estadística y Epidemiología",
    "EP.MP": "Medicina Preventiva",
    "FC": "Medicina Familiar y Comunitaria",
    "FM": "Farmacología",
    "FS": "Fisiología",
    "GC": "Ginecología y Obstetricia",
    "GR": "Geriatría",
    "GT": "Genética",
    "HM": "Hematología",
    "IF": "Infecciosas",
    "IG": "Inmunología",
    "MP": "Medicina Preventiva",
    "NF": "Nefrología",
    "NM": "Neumología",
    "NR": "Neurología",
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

# Respuestas de preguntas adicionales al final del cuadernillo que quedaron fuera de la plantilla impresa de CTO
MANUAL_ANSWERS_FALLBACK = {
    ("DM", 67): 4,  # Remibrutinib en urticaria crónica espontánea refractaria a omalizumab
}


def join_lines_clean(lines):
    """Une líneas de una columna PDF eliminando guiones blandos (\\xad) y cortes de palabra."""
    if not lines:
        return ""
    out = ""
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if not out:
            out = s
            continue
        if out.endswith("\xad"):
            out = out[:-1] + s
        elif out.endswith("-") and len(out) >= 2 and out[-2].isalpha() and s[0].islower():
            out = out[:-1] + s
        else:
            out = out + " " + s
    return re.sub(r"\s+", " ", out.replace("\xad", "")).strip()


def extract_answers_spatial(a_pdf_path):
    """Extrae el mapa {qnum: opcion_correcta} emparejando coordenadas (x, y) en la plantilla de respuestas."""
    doc = fitz.open(a_pdf_path)
    answers = {}
    for page in doc:
        blocks = [b for b in page.get_text("blocks") if b[6] == 0 and 275 <= b[1] <= 785]
        q_blocks = []
        a_blocks = []
        for b in blocks:
            txt = b[4].strip()
            x0, y0 = b[0], b[1]
            dist_to_ans = min(abs(x0 - (60.5 + k * 55.3)) for k in range(10))
            if dist_to_ans < 8.5:
                # Acepta "3" o "3z" (errata tipográfica en FC.2V Q20)
                m_ans = re.match(r"^([1-4])[a-zA-Z]?$", txt)
                if m_ans:
                    a_blocks.append((x0, y0, int(m_ans.group(1))))
            elif txt.isdigit():
                q_blocks.append((x0, y0, int(txt)))
        for ax, ay, aval in a_blocks:
            cands = [
                (abs(ay - qy) + abs((ax - qx) - 22.0) * 0.1, qnum)
                for qx, qy, qnum in q_blocks
                if 10 <= (ax - qx) <= 40 and abs(ay - qy) <= 4.5
            ]
            if cands:
                cands.sort()
                answers[cands[0][1]] = aval
    doc.close()
    return answers


def extract_cg_casos(q_pdf_path, a_pdf_path):
    """Extrae las preguntas por Casos Clínicos de Cirugía General (CG.2V) con su contexto clínico."""
    adoc = fitz.open(a_pdf_path)
    blocks = [b for b in adoc[0].get_text("blocks") if b[6] == 0 and 300 <= b[1] <= 785]
    casos_hdr = []
    q_cells = []
    a_cells = []
    for b in blocks:
        txt = b[4].strip()
        x0, y0 = b[0], b[1]
        m_c = re.match(r"^Caso\s+(\d+)$", txt, re.I)
        if m_c:
            casos_hdr.append((x0, y0, int(m_c.group(1))))
        elif txt.isdigit():
            dist_a = min(abs(x0 - (72.0 + k * 118.8)) for k in range(5))
            if dist_a < 8.5:
                a_cells.append((x0, y0, int(txt)))
            else:
                q_cells.append((x0, y0, int(txt)))
    adoc.close()

    ans_by_caso = {}
    for ax, ay, aval in a_cells:
        qcands = [
            (abs(ay - qy) + abs((ax - qx) - 22) * 0.1, qnum, qx, qy)
            for qx, qy, qnum in q_cells
            if 10 <= (ax - qx) <= 35 and abs(ay - qy) <= 4.5
        ]
        if not qcands:
            continue
        qcands.sort()
        _, subq, qx, qy = qcands[0]
        ccands = [
            (qy - cy, cnum)
            for cx, cy, cnum in casos_hdr
            if abs(qx - cx) < 25 and 0 < (qy - cy) < 160
        ]
        if ccands:
            ccands.sort()
            cnum = ccands[0][1]
            ans_by_caso.setdefault(cnum, []).append((subq, aval))

    for cnum in ans_by_caso:
        ans_by_caso[cnum] = [aval for _, aval in sorted(ans_by_caso[cnum])]

    # Ahora recorrer PREGUNTASTESTDECLASE.CG.2V.pdf
    qdoc = fitz.open(q_pdf_path)
    events = []
    for pno, page in enumerate(qdoc):
        for b in page.get_text("blocks"):
            if b[6] != 0:
                continue
            x0, y0, x1, y1, txt = b[0], b[1], b[2], b[3], b[4]
            if x1 < 42 or x0 > 555 or y1 < 68 or y0 > 800:
                continue
            if pno == 0 and y0 < 260:
                continue
            col = 0 if x0 < 298 else 1
            events.append((pno, col, y0, x0, "TEXT", txt))
        seen_rects = []
        for img in page.get_images(full=True):
            xref = img[0]
            for r in page.get_image_rects(xref):
                if r.x0 < 35 or r.x0 > 555 or r.y0 < 65 or r.y0 > 800:
                    continue
                if pno == 0 and r.y0 < 260:
                    continue
                if r.width < 45 or r.height < 35:
                    continue
                if any(abs(r.x0 - sr.x0) < 2 and abs(r.y0 - sr.y0) < 2 for sr in seen_rects):
                    continue
                seen_rects.append(r)
                col = 0 if r.x0 < 298 else 1
                events.append((pno, col, r.y0, r.x0, "IMAGE", r))

    events.sort(key=lambda e: (e[0], e[1], round(e[2], 1), round(e[3], 1)))

    casos_data = {}
    cur_caso = None
    cur_q_obj = None
    cur_state = "intro"

    for pno, col, y0, x0, etype, payload in events:
        if etype == "IMAGE":
            if cur_q_obj is not None:
                cur_q_obj["images"].append((pno, col, payload, cur_state))
            continue
        for raw_line in payload.split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            m_caso = re.match(r"^CASO\s+CL[IÍ]NICO(?:\s+N[º°])?\s+(\d+)$", line, re.I)
            if m_caso:
                cur_caso = int(m_caso.group(1))
                casos_data[cur_caso] = {"intro": [], "qs": []}
                cur_q_obj = None
                cur_state = "intro"
                continue
            if cur_caso is None:
                continue

            m_q = re.match(r"^(\d{1,2})\.(?:\s+(.*))?$", line)
            if m_q and (x0 < 60 or (298 <= x0 < 325)):
                rem = (m_q.group(2) or "").strip()
                cur_q_obj = {
                    "caso": cur_caso,
                    "raw_num": int(m_q.group(1)),
                    "stem": [rem] if rem else [],
                    "opts": {1: [], 2: [], 3: [], 4: []},
                    "images": [],
                }
                casos_data[cur_caso]["qs"].append(cur_q_obj)
                cur_state = "stem"
                continue

            m_opt = re.match(r"^([1-4])\)(?:\s+(.*))?$", line)
            if m_opt and (55 <= x0 < 88 or (315 <= x0 < 350)) and cur_q_obj is not None:
                opt_num = int(m_opt.group(1))
                cur_state = f"opt_{opt_num}"
                rem = (m_opt.group(2) or "").strip()
                if rem:
                    cur_q_obj["opts"][opt_num].append(rem)
                continue

            if cur_state == "intro":
                # Evitar encabezados de sección como "EEI", "POLITRAUMATISMO", "CIRUGÍA PLÁSTICA"
                if not line.isupper() or len(line) > 30:
                    casos_data[cur_caso]["intro"].append(line)
            elif cur_state == "stem" and cur_q_obj is not None:
                if not line.isupper() or len(line) > 30:
                    cur_q_obj["stem"].append(line)
            elif cur_state and cur_state.startswith("opt_") and cur_q_obj is not None:
                onum = int(cur_state.split("_")[1])
                if not line.isupper() or len(line) > 30:
                    cur_q_obj["opts"][onum].append(line)

    # Consolidar preguntas reales (aquellas que tienen las 4 opciones; si un bloque "2." era narrativo, se une al intro/siguiente pregunta)
    final_questions = {}
    final_answers = {}
    global_qnum = 0

    for cnum in sorted(casos_data.keys()):
        cdata = casos_data[cnum]
        intro_lines = list(cdata["intro"])
        valid_qs_in_caso = []
        pending_narrative = []
        for qobj in cdata["qs"]:
            has_all_opts = all(len(qobj["opts"][i]) > 0 for i in [1, 2, 3, 4])
            if not has_all_opts:
                # Era un párrafo narrativo intermedio del caso (ej. Caso 2 párrafo "2.")
                pending_narrative.extend(qobj["stem"])
            else:
                if pending_narrative:
                    qobj["stem"] = pending_narrative + qobj["stem"]
                    pending_narrative = []
                valid_qs_in_caso.append(qobj)

        caso_ans_list = ans_by_caso.get(cnum, [])
        intro_text = join_lines_clean(intro_lines)

        for idx_in_caso, qobj in enumerate(valid_qs_in_caso):
            global_qnum += 1
            stem_body = join_lines_clean(qobj["stem"])
            if intro_text:
                full_stem = f"[Caso Clínico {cnum}] {intro_text} — {stem_body}"
            else:
                full_stem = f"[Caso Clínico {cnum}] {stem_body}"

            qobj["qnum"] = global_qnum
            qobj["stem"] = [full_stem]
            if qobj["images"]:
                img_filename = f"pdf2v_cg_{global_qnum}.png"
                save_question_image(qdoc, qobj["images"], IMG_DIR / img_filename)
                qobj["imagen_file"] = img_filename
            else:
                qobj["imagen_file"] = None

            final_questions[global_qnum] = qobj
            if idx_in_caso < len(caso_ans_list):
                final_answers[global_qnum] = caso_ans_list[idx_in_caso]
            else:
                # Caso 11 Q8 (órgano más frecuentemente lesionado en trauma abdominal cerrado -> Bazo = 2)
                final_answers[global_qnum] = 2

    qdoc.close()
    return final_questions, final_answers


def save_question_image(qdoc, img_entries, out_path):
    """
    Renderiza el área exacta de la imagen desde la página PDF a 200 DPI
    para conservar anotaciones vectoriales, flechas y paneles compuestos.
    """
    by_page_col = {}
    for pno, col, rect, _ in img_entries:
        if (pno, col) not in by_page_col:
            by_page_col[(pno, col)] = fitz.Rect(rect)
        else:
            by_page_col[(pno, col)] |= fitz.Rect(rect)

    best_key = max(
        by_page_col.keys(),
        key=lambda k: by_page_col[k].width * by_page_col[k].height,
    )
    pno, _ = best_key
    clip_rect = by_page_col[best_key]
    page = qdoc[pno]
    clip_rect = fitz.Rect(
        max(0, clip_rect.x0 - 2),
        max(0, clip_rect.y0 - 2),
        min(page.rect.width, clip_rect.x1 + 2),
        min(page.rect.height, clip_rect.y1 + 2),
    )
    pix = page.get_pixmap(clip=clip_rect, dpi=200)
    pix.save(str(out_path))


def extract_questions_spatial(q_pdf_path, code):
    """Extrae preguntas, opciones e imágenes usando filtrado estricto de coordenadas de columna."""
    qdoc = fitz.open(q_pdf_path)
    events = []
    for pno, page in enumerate(qdoc):
        for b in page.get_text("blocks"):
            if b[6] != 0:
                continue
            x0, y0, x1, y1, txt = b[0], b[1], b[2], b[3], b[4]
            if x1 < 42 or x0 > 555 or y1 < 68 or y0 > 800:
                continue
            if pno == 0 and y0 < 260:
                continue
            col = 0 if x0 < 298 else 1
            events.append((pno, col, y0, x0, "TEXT", txt))

        seen_rects = []
        for img in page.get_images(full=True):
            xref = img[0]
            for r in page.get_image_rects(xref):
                if r.x0 < 35 or r.x0 > 555 or r.y0 < 65 or r.y0 > 800:
                    continue
                if pno == 0 and r.y0 < 260:
                    continue
                if r.width < 45 or r.height < 35:
                    continue
                if any(
                    abs(r.x0 - sr.x0) < 2 and abs(r.y0 - sr.y0) < 2 and abs(r.width - sr.width) < 2
                    for sr in seen_rects
                ):
                    continue
                seen_rects.append(r)
                col = 0 if r.x0 < 298 else 1
                events.append((pno, col, r.y0, r.x0, "IMAGE", r))

    events.sort(key=lambda e: (e[0], e[1], round(e[2], 1), round(e[3], 1)))

    questions = {}
    cur_q = None
    cur_state = None
    for pno, col, y0, x0, etype, payload in events:
        if etype == "IMAGE":
            if cur_q is not None:
                questions[cur_q]["images"].append((pno, col, payload, cur_state))
            continue

        for raw_line in payload.split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            m_q = re.match(r"^(\d{1,3})\.(?:\s+(.*))?$", line)
            if m_q and (x0 < 60 or (298 <= x0 < 325)):
                qnum = int(m_q.group(1))
                if cur_q is None or qnum == cur_q + 1:
                    cur_q = qnum
                    cur_state = "stem"
                    questions[cur_q] = {
                        "qnum": cur_q,
                        "stem": [],
                        "opts": {1: [], 2: [], 3: [], 4: []},
                        "images": [],
                    }
                    rem = (m_q.group(2) or "").strip()
                    if rem:
                        questions[cur_q]["stem"].append(rem)
                    continue
            if cur_q is None:
                continue
            m_opt = re.match(r"^([1-4])\)(?:\s+(.*))?$", line)
            if m_opt and (55 <= x0 < 88 or (315 <= x0 < 350)):
                opt_num = int(m_opt.group(1))
                cur_state = f"opt_{opt_num}"
                rem = (m_opt.group(2) or "").strip()
                if rem:
                    questions[cur_q]["opts"][opt_num].append(rem)
                continue

            if cur_state == "stem":
                questions[cur_q]["stem"].append(line)
            elif cur_state and cur_state.startswith("opt_"):
                onum = int(cur_state.split("_")[1])
                questions[cur_q]["opts"][onum].append(line)

    code_slug = code.lower().replace(".", "_")
    for qnum, q in questions.items():
        if q["images"]:
            img_filename = f"pdf2v_{code_slug}_{qnum}.png"
            out_path = IMG_DIR / img_filename
            save_question_image(qdoc, q["images"], out_path)
            q["imagen_file"] = img_filename
        else:
            q["imagen_file"] = None

    qdoc.close()
    return questions


def download_if_needed(filename, dest_path):
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        return True
    url = f"{BASE_URL}/{filename}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        dest_path.write_bytes(data)
        return True
    except Exception as e:
        print(f"  [ERROR] Fallo descargando {url}: {e}")
        return False


def main():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    existing_questions = []
    if BANCO_PATH.exists():
        with open(BANCO_PATH, "r", encoding="utf-8") as f:
            existing_questions = json.load(f)

    preserved_questions = [
        q for q in existing_questions if not str(q.get("id", "")).startswith("PDF2V_")
    ]
    print(f"Preguntas 1V preservadas en bancoPreguntas.json: {len(preserved_questions)}")

    extracted_2v = []
    audit_rows = []

    for code, subject_name in sorted(SUBJECT_MAPPING_2V.items()):
        q_fname = f"MIR.14.2627.PREGUNTASTESTDECLASE.{code}.2V.pdf"
        a_fname = f"MIR.14.2627.RESPUESTASTESTDECLASE.{code}.2V.pdf"
        q_path = PDF_DIR / q_fname
        a_path = PDF_DIR / a_fname

        ok_q = download_if_needed(q_fname, q_path)
        ok_a = download_if_needed(a_fname, a_path)
        if not (ok_q and ok_a):
            print(f"Saltando {code} por error de descarga.")
            continue

        if code == "CG":
            questions, answers = extract_cg_casos(q_path, a_path)
        else:
            answers = extract_answers_spatial(a_path)
            questions = extract_questions_spatial(q_path, code)

        incomplete = []
        missing_ans = []
        img_count = 0

        code_slug = code.upper().replace(".", "_")
        for qnum in sorted(questions.keys()):
            q = questions[qnum]
            stem_text = join_lines_clean(q["stem"])
            opts_list = []
            for opt_idx in [1, 2, 3, 4]:
                opt_text = join_lines_clean(q["opts"][opt_idx])
                if not opt_text:
                    incomplete.append(qnum)
                opts_list.append(
                    {
                        "id": opt_idx,
                        "texto": opt_text,
                        "porcentaje": None,
                    }
                )
            if not stem_text:
                incomplete.append(qnum)
            ans_val = answers.get(qnum) or MANUAL_ANSWERS_FALLBACK.get((code, qnum))
            if ans_val not in (1, 2, 3, 4):
                missing_ans.append(qnum)
                ans_val = 1

            if q["imagen_file"]:
                img_count += 1

            extracted_2v.append(
                {
                    "id": f"PDF2V_{code_slug}_{qnum}",
                    "numero": qnum,
                    "year": 2027,
                    "vuelta": 2,
                    "origen": "Test 2ª Vuelta CTO",
                    "asignatura": subject_name,
                    "codigo_cto": code,
                    "tema": "General",
                    "enunciado": stem_text,
                    "opciones": opts_list,
                    "correcta": ans_val,
                    "explicacion": "",
                    "imagen": q["imagen_file"],
                    "MIR_concept": "",
                }
            )

        audit_rows.append(
            (code, subject_name, len(questions), len(answers), img_count, len(incomplete), len(missing_ans))
        )
        print(
            f"[{code:5s}] {subject_name:32s} | Qs: {len(questions):3d} | Ans: {len(answers):3d} | Imgs: {img_count:2d} | Incomp: {len(incomplete)} | SinResp: {len(missing_ans)}"
        )

    total_final = preserved_questions + extracted_2v
    with open(BANCO_PATH, "w", encoding="utf-8") as f:
        json.dump(total_final, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 75)
    print(f"RESUMEN EXTRACCIÓN 2ª VUELTA CTO:")
    print(f"  - PDFs procesados: {len(audit_rows)} / {len(SUBJECT_MAPPING_2V)}")
    print(f"  - Preguntas 2ª Vuelta extraídas: {len(extracted_2v)}")
    print(f"  - Imágenes 2ª Vuelta generadas:  {sum(r[4] for r in audit_rows)}")
    print(f"  - Preguntas incompletas:         {sum(r[5] for r in audit_rows)}")
    print(f"  - Preguntas sin respuesta:       {sum(r[6] for r in audit_rows)}")
    print(f"  - Total en bancoPreguntas.json:  {len(total_final)} (1V: {len(preserved_questions)} + 2V: {len(extracted_2v)})")
    print("=" * 75)


if __name__ == "__main__":
    main()
