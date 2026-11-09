#!/usr/bin/env python3
"""
Clasificador automático por tema oficial CTO para todas las preguntas del Test de 2ª Vuelta (PDF 2V)
en `src/data/bancoPreguntas.json`.
Entrena un modelo TF-IDF + Bigramas + Boost de Título por asignatura usando las >19.000 preguntas
ya etiquetadas en `desgloses_filtrables.json`, `bancoPreguntas.json` (1ª Vuelta) y `evaluaciones_cto.json`,
garantizando que los nombres de `tema` asignados coincidan al 100% con los filtros de `Desgloses.jsx`.
"""

import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DG_PATH = Path("src/data/desgloses_filtrables.json")
BP_PATH = Path("src/data/bancoPreguntas.json")
EV_PATH = Path("src/data/evaluaciones_cto.json")
SM_PATH = Path("src/data/simulacrosCTO.json")
SM_TXT_PATH = Path("src/data/simulacros_textos.json")
PLAN_PATH = Path("src/data/planificacionCTO.json")

STOP = {
    "para", "con", "por", "los", "las", "una", "uno", "del", "que", "como", "mas", "pero",
    "sus", "este", "esta", "estos", "estas", "entre", "sobre", "tras", "ante", "sin",
    "paciente", "anos", "mujer", "hombre", "varon", "acude", "consulta", "presenta", "cual",
    "siguientes", "senale", "correcta", "falsa", "incorrecta", "opcion", "respuesta",
    "tratamiento", "diagnostico", "clinica", "enfermedad", "caso", "respecto", "todas",
    "menos", "excepto", "pregunta", "opciones", "verdadera", "cierta", "indique", "afirmacion",
}


def norm_str(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode("utf-8").lower()
    s = re.sub(r"<[^>]+>", " ", s)
    return s


def tokenize(text):
    s = norm_str(text)
    words = [w for w in re.findall(r"[a-z0-9]{3,}", s) if w not in STOP]
    bigrams = [f"{words[i]}_{words[i + 1]}" for i in range(len(words) - 1)]
    return words + bigrams


def main():
    dg = json.loads(DG_PATH.read_text(encoding="utf-8"))
    bp = json.loads(BP_PATH.read_text(encoding="utf-8"))
    ev = json.loads(EV_PATH.read_text(encoding="utf-8")) if EV_PATH.exists() else []

    docs_by_asig_tema = defaultdict(lambda: defaultdict(list))
    canonical_temas = defaultdict(set)

    # 1. Desgloses MIR (prioridad de nombres de temas que usa Desgloses.jsx)
    for q in dg:
        a = q.get("asignatura")
        t = q.get("tema")
        if a and t and t not in ("General", "Otros"):
            canonical_temas[a].add(t)
            resp_txt = " ".join(r.get("enunciado", "") for r in (q.get("respuestas") or []))
            enun = q.get("enunciado", "")
            com = q.get("comentario", "")
            docs_by_asig_tema[a][t].append(f"{t} {t} {enun} {resp_txt} {com}")

    # 2. Test 1ª Vuelta en bancoPreguntas.json
    for q in bp:
        if q.get("vuelta") != 2:
            a = q.get("asignatura")
            t = q.get("tema")
            if a and t and t not in ("General", "Otros"):
                # Si la asignatura ya tiene temas canónicos en Desgloses, preferir esos o añadir si no existe
                canonical_temas[a].add(t)
                opt_txt = " ".join(o.get("texto", "") for o in (q.get("opciones") or []))
                enun = q.get("enunciado", "")
                exp = q.get("explicacion", "")
                docs_by_asig_tema[a][t].append(f"{t} {t} {enun} {opt_txt} {exp}")

    # 3. Evaluaciones CTO
    for q in ev:
        a = q.get("asignatura")
        t = q.get("tema")
        if a and t and t in canonical_temas.get(a, set()):
            opt_txt = " ".join(o.get("texto", "") for o in (q.get("opciones") or []))
            enun = q.get("enunciado", "")
            exp = q.get("explicacion", "")
            sub = q.get("subtema", "")
            docs_by_asig_tema[a][t].append(f"{t} {sub} {sub} {enun} {opt_txt} {exp}")

    # 4. Simulacros CTO (incluye subtemas como "Artritis séptica" dentro de "Infecciones osteoarticulares")
    if SM_PATH.exists() and SM_TXT_PATH.exists():
        sm_raw = json.loads(SM_PATH.read_text(encoding="utf-8"))
        sm_qs = sm_raw if isinstance(sm_raw, list) else sm_raw.get("preguntas", [])
        sm_txt = {
            f"{t.get('simulacro')}-{t.get('numero_pregunta') or t.get('numero')}": t
            for t in json.loads(SM_TXT_PATH.read_text(encoding="utf-8"))
        }
        for p in sm_qs:
            cl = p.get("clasificaciones") or []
            if len(cl) >= 2:
                raw_t = cl[1]
                sub_t = cl[2] if len(cl) > 2 else ""
                key = f"{p.get('simulacro')}-{p.get('numero')}"
                t_obj = sm_txt.get(key, {})
                enun = t_obj.get("enunciado") or ""
                com = t_obj.get("comentario") or ""
                # Match raw_t against canonical_temas across subjects
                for cand_a, t_set in canonical_temas.items():
                    for can_t in t_set:
                        if norm_str(can_t) == norm_str(raw_t):
                            docs_by_asig_tema[cand_a][can_t].append(f"{can_t} {sub_t} {sub_t} { sub_t} {enun} {com}")

    # 5. Resúmenes oficiales de CTO en planificacionCTO.json
    if PLAN_PATH.exists():
        plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
        for ev_p in plan:
            for tm in ev_p.get("temas") or []:
                tit = tm.get("titulo") or ""
                res = tm.get("resumen") or ""
                if tit and res:
                    for cand_a, t_set in canonical_temas.items():
                        for can_t in t_set:
                            if norm_str(can_t) in norm_str(tit) or norm_str(tit) in norm_str(can_t):
                                docs_by_asig_tema[cand_a][can_t].append(f"{can_t} {tit} {res}")

    # Construir clasificadores TF-IDF normalizados por asignatura
    classifiers = {}
    for a, tema_dict in docs_by_asig_tema.items():
        df = Counter()
        tf_by_tema = {}
        title_tokens_by_tema = {}
        num_temas = len(tema_dict)
        for t, texts in tema_dict.items():
            combined = " ".join(texts)
            toks = tokenize(combined)
            c = Counter(toks)
            tf_by_tema[t] = c
            for tok in set(toks):
                df[tok] += 1
            title_tokens_by_tema[t] = set(tokenize(t))

        weights_by_tema = {}
        for t, c in tf_by_tema.items():
            w = {}
            norm_sq = 0.0
            for tok, count in c.items():
                idf = math.log((num_temas + 1) / (df[tok] + 0.5)) + 1.0
                val = (1.0 + math.log(count)) * idf
                if tok in title_tokens_by_tema[t]:
                    val *= 2.8  # Fuerte boost a términos del título del tema
                w[tok] = val
                norm_sq += val * val
            denom = math.sqrt(norm_sq) or 1.0
            for tok in w:
                w[tok] /= denom
            weights_by_tema[t] = w
        classifiers[a] = weights_by_tema

    def classify_q(a, text):
        w_map = classifiers.get(a)
        if not w_map:
            return "General"
        q_toks = Counter(tokenize(text))
        best_t, best_s = "General", -1.0
        for t, w in w_map.items():
            s = sum(q_cnt * w.get(tok, 0.0) for tok, q_cnt in q_toks.items())
            if s > best_s:
                best_s = s
                best_t = t
        return best_t

    ASIG_MAP_2V = {
        "Endocrinología": "Endocrinología y Metabolismo",
        "Medicina Preventiva": "Estadística y Epidemiología",
        "Neurología": "Neurología y Neurocirugía",
    }
    MISC_CANDIDATE_ASIGS = [
        "Farmacología", "Genética", "Geriatría", "Bioética y Medicina Legal",
        "Anatomía Patológica", "Anestesiología", "Oncología", "Urgencias",
        "Fisiología", "Anatomía", "Bioquímica", "Rehabilitación",
    ]

    def classify_misc(text):
        q_toks = Counter(tokenize(text))
        best_a, best_t, best_s = "Farmacología", "General", -1.0
        for cand_a in MISC_CANDIDATE_ASIGS:
            w_map = classifiers.get(cand_a, {})
            for t, w in w_map.items():
                s = sum(q_cnt * w.get(tok, 0.0) for tok, q_cnt in q_toks.items())
                if s > best_s:
                    best_s = s
                    best_a = cand_a
                    best_t = t
        return best_a, best_t

    # Clasificar todas las preguntas 2V (y cualquier 1V que estuviera en "General")
    updated_2v = 0
    dist_rm = Counter()
    dist_dg = Counter()
    dist_fc = Counter()

    for q in bp:
        a = q.get("asignatura")
        if a in ASIG_MAP_2V:
            a = ASIG_MAP_2V[a]
            q["asignatura"] = a

        if q.get("vuelta") == 2 or q.get("tema") in (None, "", "General"):
            opciones = q.get("opciones") or []
            corr_id = q.get("correcta")
            corr_txt = " ".join(o.get("texto", "") for o in opciones if o.get("id") == corr_id)
            opt_txt = " ".join(o.get("texto", "") for o in opciones)
            enun = q.get("enunciado", "")
            exp = q.get("explicacion", "")
            exp_head = exp[:320]
            # Triple peso al enunciado, opción correcta y primera frase de la explicación frente a distractores
            full_text = f"{enun} {enun} {enun} {corr_txt} {corr_txt} {exp_head} {exp_head} {opt_txt} {exp}"
            if a == "Miscelánea" or q.get("codigo_cto") == "MC":
                pred_a, pred_tema = classify_misc(full_text)
                q["asignatura"] = pred_a
                q["tema"] = pred_tema
            else:
                pred_tema = classify_q(a, full_text)
                q["tema"] = pred_tema

            if q.get("vuelta") == 2:
                updated_2v += 1
                if q["asignatura"] == "Reumatología":
                    dist_rm[q["tema"]] += 1
                elif q["asignatura"] == "Digestivo":
                    dist_dg[q["tema"]] += 1
                elif q["asignatura"] == "Medicina Familiar y Comunitaria":
                    dist_fc[q["tema"]] += 1

    BP_PATH.write_text(json.dumps(bp, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Total preguntas 2V clasificadas por tema en bancoPreguntas.json: {updated_2v}")
    print("\nDistribución 2V Reumatología (57p):")
    for k, v in dist_rm.most_common():
        print(f"  - {k}: {v}")
    print("\nDistribución 2V Digestivo (top 10 de 80p):")
    for k, v in dist_dg.most_common(10):
        print(f"  - {k}: {v}")
    print("\nDistribución 2V Medicina Familiar (30p):")
    for k, v in dist_fc.most_common():
        print(f"  - {k}: {v}")


if __name__ == "__main__":
    main()
