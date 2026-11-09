#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de Generación de Tarjetas Visuales Anki para el MIR (MIR 2027)
====================================================================
Diseñado para construir tarjetas de alto impacto visual en <2 segundos de lectura:
1. Cabecera con Badge de Asignatura + Categoría (⚖️ VERSUS | 🧭 ALGORITMO | 🎯 CLAVE MIR | 🔢 MATRIZ 2x2)
2. Componentes visuales:
   - pill(texto, color): Etiquetas resaltadas para palabras gatillo.
   - versus(col1, col2): Tabla comparativa a 2 columnas lado a lado.
   - steps(lista): Escalones / Semáforo (Verde / Ámbar / Rojo / Azul).
   - matrix2x2(...): Tabla de 4 esquinas.
   - callout(tipo, texto): Caja inferior de «💡 Por qué fisiopatológico» o «⚠️ Trampa MIR».
"""

import os
import sys
import time
import json
import shutil
import sqlite3
import hashlib

ANKI_DB_PATH = os.path.expanduser("~/Library/Application Support/Anki2/Usuario 1/collection.anki2")
MIR_DECK_ID = 1780386205296
BASIC_MODEL_ID = 1600653710837
CLOZE_MODEL_ID = 1600653710833

def is_anki_running():
    """Comprueba si Anki está abierto para prevenir colisiones y bloqueos SQLite."""
    import subprocess, re
    try:
        out = subprocess.check_output(["ps", "aux"], text=True, stderr=subprocess.DEVNULL)
        return bool(re.search(r"/[A]nki\.app/Contents/MacOS/Anki", out))
    except Exception:
        return False

PALETTE = {
    "blue":   {"bg": "#eff6ff", "border": "#bfdbfe", "text": "#1d4ed8", "pill_bg": "#dbeafe"},
    "green":  {"bg": "#f0fdf4", "border": "#bbf7d0", "text": "#15803d", "pill_bg": "#dcfce7"},
    "red":    {"bg": "#fef2f2", "border": "#fecaca", "text": "#b91c1c", "pill_bg": "#fee2e2"},
    "amber":  {"bg": "#fffbeb", "border": "#fde68a", "text": "#b45309", "pill_bg": "#fef3c7"},
    "purple": {"bg": "#faf5ff", "border": "#e9d5ff", "text": "#6d28d9", "pill_bg": "#f3e8ff"},
    "teal":   {"bg": "#f0fdfa", "border": "#99f6e4", "text": "#0f766e", "pill_bg": "#ccfbf1"},
    "slate":  {"bg": "#f8fafc", "border": "#e2e8f0", "text": "#334155", "pill_bg": "#e2e8f0"},
}


def pill(text, color="blue"):
    c = PALETTE.get(color, PALETTE["blue"])
    return (
        f"<span style='display:inline-block;padding:1px 7px;margin:1px 2px;border-radius:6px;"
        f"background:{c['pill_bg']};color:{c['text']};border:1px solid {c['border']};"
        f"font-weight:700;font-size:13.5px;line-height:1.35;'>{text}</span>"
    )


def front_card(subject, badge_color, kind_label, title_html, subtitle_html=""):
    """
    REGLA ATÓMICA MIR (1 PREGUNTA = 1 DATO DE 3 SEGUNDOS):
    - `title_html` o `subtitle_html` debe formular UNA ÚNICA pregunta cerrada que se responda
      en <=3 segundos con 1-4 palabras (PROHIBIDO pedir listas o comparar 5 cosas a la vez).
    """
    c = PALETTE.get(badge_color, PALETTE["blue"])
    sub = (
        f"<div style='margin-top:8px;padding:8px 11px;border-radius:8px;background:#f8fafc;"
        f"border-left:3.5px solid {c['text']};font-size:15px;color:#0f172a;font-weight:650;line-height:1.4;'>"
        f"🎯 {subtitle_html}</div>"
        if subtitle_html else ""
    )
    return (
        f"<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;"
        f"text-align:left;max-width:680px;margin:0 auto;padding:14px 18px;border-radius:12px;"
        f"background:#ffffff;border:1.5px solid #e2e8f0;box-shadow:0 2px 6px rgba(15,23,42,0.04);'>"
        f"<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;'>"
        f"<span style='display:inline-block;padding:3px 9px;border-radius:999px;background:{c['pill_bg']};"
        f"color:{c['text']};border:1px solid {c['border']};font-size:11.5px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;'>{subject}</span>"
        f"<span style='display:inline-block;padding:2px 8px;border-radius:6px;background:#dcfce7;"
        f"color:#15803d;border:1px solid #bbf7d0;font-size:11px;font-weight:800;'>⚡ 1 DATO (3s) · {kind_label}</span>"
        f"</div>"
        f"<div style='font-size:17px;font-weight:750;color:#0f172a;line-height:1.4;'>{title_html}</div>"
        f"{sub}"
        f"</div>"
    )


def atomic_answer(answer_html):
    """Caja superior del reverso con el ÚNICO dato atómico necesario para darle a 'Bien (Espacio)' en 3 segundos."""
    return (
        f"<div style='margin-bottom:10px;padding:10px 14px;border-radius:10px;background:#f0fdf4;"
        f"border:2px solid #86efac;color:#14532d;font-size:15.5px;line-height:1.4;'>"
        f"<div style='font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#15803d;margin-bottom:3px;'>"
        f"✅ RESPUESTA ATÓMICA (Si acertaste esto → pulsa BIEN)</div>"
        f"<div style='font-weight:750;color:#0f172a;'>{answer_html}</div>"
        f"</div>"
    )


def back_wrapper(inner_html, callout_html="", atomic_html=""):
    top_atomic = atomic_answer(atomic_html) if atomic_html else ""
    context_header = (
        "<div style='font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;"
        "letter-spacing:0.4px;margin:6px 0 4px 2px;'>"
        "📎 Contexto visual de apoyo (escanear 2s · NO recitar de memoria)</div>"
        if inner_html else ""
    )
    return (
        f"<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;"
        f"text-align:left;max-width:680px;margin:0 auto;font-size:15px;color:#1e293b;line-height:1.5;'>"
        f"{top_atomic}"
        f"{context_header}"
        f"{inner_html}"
        f"{callout_html}"
        f"</div>"
    )


def versus(left_title, left_color, left_bullets, right_title, right_color, right_bullets):
    cl = PALETTE.get(left_color, PALETTE["blue"])
    cr = PALETTE.get(right_color, PALETTE["amber"])
    l_items = "".join(f"<li style='margin-bottom:5px;'>{b}</li>" for b in left_bullets)
    r_items = "".join(f"<li style='margin-bottom:5px;'>{b}</li>" for b in right_bullets)
    return (
        f"<table style='width:100%;border-collapse:separate;border-spacing:8px 0;margin:4px -8px;'>"
        f"<tr>"
        f"<td style='width:50%;vertical-align:top;background:{cl['bg']};border:1.5px solid {cl['border']};"
        f"border-top:4px solid {cl['text']};border-radius:10px;padding:10px 12px;'>"
        f"<div style='font-weight:800;font-size:14.5px;color:{cl['text']};margin-bottom:6px;'>{left_title}</div>"
        f"<ul style='margin:0;padding-left:16px;font-size:14px;color:#1e293b;'>{l_items}</ul>"
        f"</td>"
        f"<td style='width:50%;vertical-align:top;background:{cr['bg']};border:1.5px solid {cr['border']};"
        f"border-top:4px solid {cr['text']};border-radius:10px;padding:10px 12px;'>"
        f"<div style='font-weight:800;font-size:14.5px;color:{cr['text']};margin-bottom:6px;'>{right_title}</div>"
        f"<ul style='margin:0;padding-left:16px;font-size:14px;color:#1e293b;'>{r_items}</ul>"
        f"</td>"
        f"</tr></table>"
    )


def steps(rows):
    """rows: list of (color, label_html, body_html)"""
    out = []
    for color, label_html, body_html in rows:
        c = PALETTE.get(color, PALETTE["slate"])
        out.append(
            f"<div style='background:{c['bg']};border:1px solid {c['border']};"
            f"border-left:4px solid {c['text']};border-radius:8px;padding:8px 12px;margin-bottom:7px;'>"
            f"<div style='font-weight:800;font-size:14px;color:{c['text']};margin-bottom:2px;'>{label_html}</div>"
            f"<div style='font-size:14px;color:#1e293b;'>{body_html}</div>"
            f"</div>"
        )
    return "".join(out)


def callout(kind, text_html):
    if kind == "trap":
        bg, border, title_color, icon, label = "#fff1f2", "#fecdd3", "#be123c", "⚠️", "TRAMPA MIR"
    else:
        bg, border, title_color, icon, label = "#eef2ff", "#c7d2fe", "#3730a3", "💡", "POR QUÉ FISIOPATOLÓGICO / REGLA"
    return (
        f"<div style='margin-top:9px;padding:8px 12px;border-radius:8px;background:{bg};"
        f"border:1px solid {border};font-size:13.5px;color:#1e293b;'>"
        f"<b style='color:{title_color};'>{icon} {label}:</b> {text_html}"
        f"</div>"
    )


def matrix_2x2(col1_header, col2_header, row1_label, r1c1, r1c2, row2_label, r2c1, r2c2):
    return (
        f"<table style='width:100%;border-collapse:collapse;font-size:13.8px;border:1.5px solid #cbd5e1;border-radius:8px;overflow:hidden;'>"
        f"<tr style='background:#f1f5f9;color:#0f172a;font-weight:800;'>"
        f"<th style='padding:8px;border:1px solid #cbd5e1;width:18%;'>Patrón</th>"
        f"<th style='padding:8px;border:1px solid #cbd5e1;width:41%;color:#15803d;'>{col1_header}</th>"
        f"<th style='padding:8px;border:1px solid #cbd5e1;width:41%;color:#b91c1c;'>{col2_header}</th>"
        f"</tr>"
        f"<tr>"
        f"<td style='padding:8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:800;color:#1d4ed8;'>{row1_label}</td>"
        f"<td style='padding:8px;border:1px solid #cbd5e1;background:#f0fdf4;'>{r1c1}</td>"
        f"<td style='padding:8px;border:1px solid #cbd5e1;background:#fef2f2;'>{r1c2}</td>"
        f"</tr>"
        f"<tr>"
        f"<td style='padding:8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:800;color:#6d28d9;'>{row2_label}</td>"
        f"<td style='padding:8px;border:1px solid #cbd5e1;background:#faf5ff;'>{r2c1}</td>"
        f"<td style='padding:8px;border:1px solid #cbd5e1;background:#fffbeb;'>{r2c2}</td>"
        f"</tr>"
        f"</table>"
    )


def retrato_robot(causa_vector, clinica_triada, signo_estrella, dx_tto):
    """
    Plantilla '🪪 RETRATO ROBOT MIR (4 Cajones Fijos)' para enfermedades que al alumno
    le suenan vacías (ej. Borreliosis, Leptospirosis, Brucelosis, FMF, Fabry).
    Estructura siempre la memoria en los mismos 4 cajones visuales fijos:
      1. 🦠 CAUSA / VECTOR / GEN
      2. 🤒 CLÍNICA / TRÍADA CARDINAL
      3. ⚡ SIGNO PATOGNOMÓNICO / COMPLICACIÓN ESTRELLA
      4. 💊 DIAGNÓSTICO & TRATAMIENTO DE ELECCIÓN
    """
    return steps([
        ("blue", "1️⃣ CAUSA · VECTOR · GENÉTICA", causa_vector),
        ("amber", "2️⃣ CLÍNICA · TRÍADA CARDINAL", clinica_triada),
        ("purple", "3️⃣ SIGNO PATOGNOMÓNICO / COMPLICACIÓN ESTRELLA MIR", signo_estrella),
        ("green", "4️⃣ DIAGNÓSTICO & TRATAMIENTO DE ELECCIÓN", dx_tto),
    ])


def get_sim18_visual_cards():
    """Returns dict mapping nid -> (front_html, back_html) for all 52 Simulacro 18 cards."""
    cards = {}

    # [01] 1780586510291 - Calcioantagonistas no dihidropiridínicos
    cards[1780586510291] = (
        front_card("🫀 Cardiología · Farmacología", "red", "🚨 CONTRAINDICACIONES",
                   f"Calcioantagonistas NO dihidropiridínicos ({pill('Verapamilo', 'blue')} y {pill('Diltiazem', 'blue')})",
                   "¿Cuáles son sus efectos adversos típicos y sus 3 contraindicaciones absolutas?"),
        back_wrapper(
            steps([
                ("blue", "⚙️ Mecanismo y Efectos Adversos",
                 f"Frenan el <b>nodo AV</b> y son <b>inotrópicos negativos</b>. EA #1: {pill('Estreñimiento', 'amber')}, bradicardia, edemas."),
                ("red", "🚫 3 CONTRAINDICACIONES ABSOLUTAS",
                 f"1) {pill('Bradicardia / Bloqueo AV', 'red')} y uso junto a β-bloqueantes.<br>"
                 f"2) {pill('Insuficiencia Cardíaca con FEVI reducida', 'red')} (disfunción sistólica).<br>"
                 f"3) {pill('Taquicardia Ventricular (QRS ancho)', 'red')} y {pill('FA preexcitada (WPW)', 'red')}."),
            ]),
            callout("trap", "Si pones Verapamilo a una TV o a un WPW pensando que es una TSV normal, provocas <b>shock cardiogénico y Fibrilación Ventricular</b>.")
        )
    )

    # [02] 1783348478122 - Reiter vs Gonocócica
    cards[1783348478122] = (
        front_card("🦴 Reumatología · Infecciosas", "purple", "⚖️ VERSUS",
                   f"Diagnóstico diferencial: {pill('Síndrome de Reiter (Reactiva)', 'amber')} vs. {pill('Artritis Gonocócica', 'blue')}"),
        back_wrapper(
            versus(
                "🔄 Síndrome de Reiter (Reactiva)", "amber",
                [
                    f"<b>Causa:</b> Autoinmune {pill('ASÉPTICA (HLA-B27)', 'amber')} 1–4 sem tras uretritis (<i>Chlamydia</i>) o diarrea (<i>Salmonella, Shigella, Yersinia, Campylobacter</i>).",
                    f"<b>Perfil:</b> {pill('Varón joven', 'amber')}.",
                    f"<b>Articulación:</b> Oligoartritis asimétrica aditiva MMII + {pill('Dactilitis', 'amber')} + Entesitis.",
                    f"<b>Piel/Ojos:</b> {pill('Queratodermia blenorrágica', 'amber')} (palmas/plantas), {pill('Balanitis circinada', 'amber')}, Conjuntivitis/Uveítis.",
                    f"<b>Tto:</b> {pill('AINEs', 'green')} (los ATB no curan la artritis)."
                ],
                "🦠 Artritis Gonocócica Diseminada", "blue",
                [
                    f"<b>Causa:</b> Infección bacteriana {pill('ACTIVA', 'blue')} por <i>N. gonorrhoeae</i>.",
                    f"<b>Perfil:</b> {pill('Mujer joven', 'blue')} (favorecida por menstruación).",
                    f"<b>2 Fases:</b> 1º Poliartritis {pill('migratoria', 'blue')} + tenosinovitis + fiebre → 2º Se fija en {pill('1 sola articulación', 'blue')}.",
                    f"<b>Piel:</b> {pill('Vesiculopústulas', 'blue')} en tronco/MMSS que desaparecen al fijarse la monoartritis.",
                    f"<b>Dx y Tto:</b> Cultivo {pill('Thayer-Martin / PCR cervical', 'green')} · Tto: {pill('Ceftriaxona', 'green')}."
                ]
            ),
            callout("physio", "En la gonocócica el líquido sinovial suele salir negativo (<50%); por eso el diagnóstico se hace frotando la puerta de entrada (<b>exudado endocervical/uretral</b>).")
        )
    )

    # [03] 1786054219741 - Sarcoidosis estadios y tratamiento
    cards[1786054219741] = (
        front_card("🫁 Neumología", "teal", "🧭 ESTADIOS Y MANEJO",
                   "4 Estadios Radiológicos de la Sarcoidosis y ¿cuándo se trata con corticoides?",
                   f"Diferencia terapéutica entre {pill('Estadio I / Síndrome de Löfgren', 'green')} y {pill('Estadio II-III / Heerfordt', 'red')}"),
        back_wrapper(
            steps([
                ("slate", "📊 4 Estadios Radiológicos (Scadding)",
                 f"<b>I:</b> {pill('Solo adenopatías hiliares bilaterales', 'blue')} · "
                 f"<b>II:</b> {pill('Adenopatías + Infiltrado intersticial', 'amber')} · "
                 f"<b>III:</b> {pill('Infiltrado SIN adenopatías', 'purple')} · "
                 f"<b>IV:</b> {pill('Fibrosis pulmonar', 'red')}."),
                ("green", "✅ NO TRATAR CON CORTICOIDES (Observación ± AINEs)",
                 f"{pill('Estadio I asintomático', 'green')} y {pill('Síndrome de Löfgren', 'green')} (fiebre + eritema nodoso + adenopatías hiliares + artralgias de tobillos) → <b>Remiten solos en >80–90%</b>."),
                ("red", "💊 SÍ TRATAR CON CORTICOIDES ORALES",
                 f"{pill('Estadio II–III sintomático o progresivo', 'red')} o afectación grave extrapulmonar: ocular (uveítis), cardíaca, neurológica ({pill('Síndrome de Heerfordt', 'red')}: uveítis + parotiditis + parálisis facial VII) o hipercalcemia."),
            ])
        )
    )

    # [04] 1786613664187 - Porfiria Cutánea Tarda y Quelantes del hierro
    cards[1786613664187] = (
        front_card("🧴 Dermatología · Hematología", "purple", "🎯 TRATAMIENTO",
                   "Tratamiento de la Porfiria Cutánea Tarda (PCT) y vías de los Quelantes del Hierro"),
        back_wrapper(
            steps([
                ("green", "1️⃣ Tratamiento de 1.ª elección en la PCT",
                 f"{pill('Flebotomías (= Sangrías) periódicas', 'green')} (vacían el hierro hepático que inhibe la <i>uroporfirinógeno descarboxilasa</i>) + suprimir alcohol/estrógenos y curar VHC."),
                ("blue", "2️⃣ Alternativa farmacológica en la PCT",
                 f"{pill('Cloroquina / Hidroxicloroquina', 'blue')} oral a dosis bajas (forma complejos hidrosolubles con las porfirinas que se eliminan por la orina)."),
                ("amber", "3️⃣ Vía de administración de los Quelantes del Hierro",
                 f"• {pill('Desferrioxamina', 'red')} = Exclusivamente <b>PARENTERAL (perfusión SC o IV)</b> (NO se absorbe vía oral).<br>"
                 f"• {pill('Deferasirox', 'green')} = Quelante por <b>VÍA ORAL</b> (<i>Defer-ASI-r-O-x = Oral</i>)."),
            ]),
            callout("trap", "¡Sangría = Flebotomía! Y nunca confundas la <b>Hidroxicloroquina</b> (PCT/Lupus) con la <b>Hidroxiurea</b> (citorreductor de la Policitemia Vera).")
        )
    )

    # [05] 1786989244788 - Tumores óseos de la epífisis
    cards[1786989244788] = (
        front_card("🦴 Traumatología · Tumores Óseos", "blue", "⚖️ VERSUS",
                   f"Los 2 tumores óseos de la {pill('EPÍFISIS', 'blue')}: {pill('Condroblastoma', 'blue')} vs. {pill('Tumor de Células Gigantes', 'amber')}"),
        back_wrapper(
            versus(
                "🍿 Condroblastoma", "blue",
                [
                    f"<b>Edad:</b> Adolescente / joven ({pill('< 20–25 años', 'blue')}).",
                    f"<b>Localización:</b> Epífisis proximal de <b>húmero, fémur o tibia</b>.",
                    f"<b>Radiología clave:</b> Lesión lítica bien delimitada {pill('CON calcificaciones en su interior', 'green')} («en palomitas de maíz» / algodonosas) e intenso edema óseo."
                ],
                "🫧 Tumor de Células Gigantes (Osteoclastoma)", "amber",
                [
                    f"<b>Edad y sexo:</b> Adulto joven ({pill('20–40 años', 'amber')}, predominio {pill('Mujeres', 'amber')}).",
                    f"<b>Localización:</b> Epífisis/metáfisis alrededor de la <b>rodilla</b> o radio distal.",
                    f"<b>Radiología clave:</b> Imagen lítica multiloculada en {pill('«pompas de jabón»', 'amber')} {pill('SIN calcificaciones', 'red')}. (Tto: curetaje + adyuvante o <i>Denosumab</i>)."
                ]
            ),
            callout("trap", "Ambos están en la epífisis: si el caso dice <b>«calcificaciones en su interior»</b> en un joven → marca directo <b>Condroblastoma</b>.")
        )
    )

    # [06] 1792518598175 - Litiasis renal según pH
    cards[1792518598175] = (
        front_card("🫘 Urología · Nefrología", "teal", "⚖️ VERSUS",
                   f"Litiasis renal según el pH urinario: {pill('pH Ácido (<5,5)', 'amber')} vs. {pill('pH Alcalino (>7)', 'blue')}"),
        back_wrapper(
            versus(
                "🍋 Precipitan en pH ÁCIDO (< 5,5)", "amber",
                [
                    f"{pill('Ácido Úrico', 'red')}: <b>Radiotransparente</b> en Rx simple (sí se ve en TC). Se trata alcalinizando la orina (citrato potásico / bicarbonato).",
                    f"{pill('Cistina', 'amber')}: <b>Débilmente radiopaca</b> (por el azufre), cristales <b>hexagonales</b> en orina."
                ],
                "🧪 Precipitan en pH ALCALINO (> 7)", "blue",
                [
                    f"{pill('Estruvita (Fosfato amónico magnésico)', 'blue')}: Infección por bacterias <b>ureasa+ (<i>Proteus</i>)</b>, cálculos <b>coraliformes</b> y cristales en «tapa de ataúd».",
                    f"{pill('Fosfato Cálcico', 'purple')}: Muy radiopaca (asociada a Acidosis Tubular Renal distal tipo I e hiperparatiroidismo)."
                ]
            ),
            callout("physio", "El <b>Oxalato cálcico</b> (la litiasis más frecuente globalmente) es muy radiopaco y apenas se modifica con los cambios de pH urinario.")
        )
    )

    # [07] 1792518598185 - Aminoacidopatías PKU vs Tirosinemia
    cards[1792518598185] = (
        front_card("👶 Pediatría · Metabolismo", "purple", "⚖️ VERSUS",
                   f"Errores congénitos del metabolismo: {pill('Fenilcetonuria (PKU)', 'blue')} vs. {pill('Tirosinemia tipo I', 'amber')}"),
        back_wrapper(
            versus(
                "🧬 Fenilcetonuria (PKU)", "blue",
                [
                    f"<b>Enzima deficitaria:</b> {pill('Fenilalanina hidroxilasa', 'blue')} (o cofactor BH4).",
                    f"<b>Clínica sin tto:</b> Discapacidad intelectual grave, microcefalia, eccema, olor a ratón/moho, fenotipo rubio.",
                    f"<b>Tratamiento:</b> Dieta {pill('SIN proteínas de alto valor biológico', 'red')} (prohibidos carne, pescado, huevos, lácteos y <b>aspartamo</b>)."
                ],
                "🧪 Tirosinemia Tipo I", "amber",
                [
                    f"<b>Enzima deficitaria:</b> <i>Fumarilacetoacetato hidrolasa</i>.",
                    f"<b>Clínica:</b> Fallo hepático agudo, cirrosis/hepatocarcinoma y síndrome de Fanconi renal.",
                    f"<b>Tratamiento específico:</b> {pill('Nitisinona (NTBC)', 'green')}."
                ]
            )
        )
    )

    # [08] 1792518598195 - Tumores intrarraquídeos Schwannoma vs Meningioma
    cards[1792518598195] = (
        front_card("🧠 Neurocirugía", "blue", "⚖️ VERSUS",
                   f"Tumores Intrarraquídeos (Intradurales Extramedulares): {pill('1.º Schwannoma', 'blue')} vs. {pill('2.º Meningioma', 'purple')}"),
        back_wrapper(
            versus(
                "🥇 1.º Más frecuente: Schwannoma (Neurinoma)", "blue",
                [
                    f"Es el tumor primario intrarraquídeo {pill('MÁS frecuente globalmente', 'blue')}.",
                    "Nace de la <b>raíz dorsal sensitiva</b> (dolor radicular).",
                    f"Sale por el agujero de conjunción dando imagen en {pill('«reloj de arena»', 'blue')}."
                ],
                "🥈 2.º Más frecuente: Meningioma espinal", "purple",
                [
                    f"Es el {pill('2.º más frecuente', 'purple')}, pero el #1 en <b>mujeres de mediana edad en región dorsal</b>.",
                    f"Localización típica: {pill('Columna dorsal/torácica', 'purple')} en mujeres.",
                    f"Intensa captación homogénea con {pill('cola dural', 'purple')}. La <b>cirugía completa es curativa</b>."
                ]
            ),
            callout("trap", "A nivel intracraneal el #1 primario es el Meningioma, pero en el <b>canal raquídeo</b> el #1 global es el <b>Schwannoma</b> y el #2 es el <b>Meningioma</b> (salvo en región torácica de mujeres).")
        )
    )

    # [09] 1792518598205 - Epónimos fracturas antebrazo
    cards[1792518598205] = (
        front_card("🦴 Traumatología", "blue", "🔢 4 EPÓNIMOS CLAVE",
                   f"Fracturas-luxaciones del antebrazo y muñeca: {pill('Essex-Lopresti', 'red')} · {pill('Rhea-Barton', 'amber')} · {pill('Monteggia', 'blue')} · {pill('Galeazzi', 'purple')}"),
        back_wrapper(
            steps([
                ("red", "💥 Essex-Lopresti (Inestabilidad longitudinal completa)",
                 f"Fractura de la {pill('cabeza del radio', 'red')} + rotura de toda la {pill('membrana interósea', 'red')} + luxación radiocubital distal."),
                ("amber", "🖐️ Rhea-Barton (Muñeca)",
                 f"Fractura-luxación {pill('marginal intraarticular del radio distal', 'amber')} (dorsal o volar) donde el carpo se desplaza con el fragmento."),
                ("blue", "💪 Monteggia (Proximal) vs. Galeazzi (Distal)",
                 f"• <b>Monteggia:</b> Fx diáfisis {pill('cúbito proximal', 'blue')} + luxación {pill('cabeza del radio', 'blue')} (lesión N. interóseo posterior).<br>"
                 f"• <b>Galeazzi:</b> Fx diáfisis {pill('radio distal', 'purple')} + luxación {pill('radiocubital distal', 'purple')}."),
            ])
        )
    )

    # [10] 1792518598215 - Referente paciente crónico complejo
    cards[1792518598215] = (
        front_card("🩺 Medicina de Familia · Gestión", "green", "🎯 REGLA DE ORO MIR",
                   "¿Quién es SIEMPRE el referente principal del paciente crónico complejo / pluripatológico?",
                   "¿Cambia aunque sea derivado a una Unidad de Pacientes Pluripatológicos hospitalaria?"),
        back_wrapper(
            steps([
                ("green", "👨‍⚕️ Referente Principal Permanente",
                 f"El {pill('Médico de Familia y Enfermera de Atención Primaria', 'green')} (garantizan la longitudinalidad y coordinación comunitaria)."),
                ("blue", "🏥 Rol del Médico Internista en la Unidad Hospitalaria",
                 "Actúa como <b>consultor de apoyo</b> y coordina las múltiples especialidades <i>dentro del hospital</i> para evitar visitas fragmentadas, pero NO sustituye al médico de familia."),
                ("amber", "⚠️ Únicas excepciones temporales",
                 "Mientras el paciente está <b>ingresado en planta de agudos</b>, en <b>Hospitalización a Domicilio (HAD)</b> o en unidades específicas de Cuidados Paliativos terminales."),
            ])
        )
    )

    # [11] 1792518598225 - Hipertiroidismo apático
    cards[1792518598225] = (
        front_card("🩺 Geriatría · Endocrinología", "amber", "🚨 PRESENTACIÓN ATÍPICA",
                   f"Anciano con {pill('pérdida de peso', 'red')} + {pill('insuficiencia cardíaca / FA', 'red')} + {pill('apatía, lentitud y aspecto depresivo', 'amber')}",
                   "¿Qué patología endocrina oculta debes descartar solicitando TSH?"),
        back_wrapper(
            steps([
                ("red", "🦋 Diagnóstico: Hipertiroidismo Apático del Anciano",
                 f"En el anciano el hipertiroidismo NO suele dar nerviosismo ni exoftalmos, sino {pill('apatía / letargia', 'amber')} (parece depresión o hipotiroidismo) combinada con {pill('adelgazamiento', 'red')} y {pill('clínica cardiovascular (FA, IC refractaria)', 'red')}.")
            ]),
            callout("trap", "Si te dejas llevar por la apatía y lentitud marcarás hipotiroidismo o depresión; fíjate siempre en que <b>pierde peso</b> (el hipotiroideo gana peso) y debuta con <b>FA/IC</b>.")
        )
    )

    # [12] 1792518598235 - Hemotórax masivo
    cards[1792518598235] = (
        front_card("🫁 Cirugía Torácica · Politrauma", "red", "🚨 URGENCIA VITAL",
                   "Manejo del Hemotórax Traumático: ¿Cuándo está indicada la Toracotomía Urgente?"),
        back_wrapper(
            steps([
                ("blue", "1️⃣ Hemotórax simple (Estable y < 1.500 mL)",
                 f"Drenaje pleural con {pill('tubo de tórax grueso', 'blue')} (5.º espacio intercostal, línea axilar media)."),
                ("red", "2️⃣ Hemotórax MASIVO → TORACOTOMÍA URGENTE",
                 f"• Salida inmediata por el tubo de {pill('≥ 1.500 mL de sangre', 'red')} de golpe.<br>"
                 f"• Drenaje continuo de {pill('> 200 mL/hora durante 3–4 h', 'red')} seguidas.<br>"
                 f"• {pill('Inestabilidad hemodinámica (shock)', 'red')} que no responde a volumen/transfusión."),
            ]),
            callout("trap", "Un politraumatizado <b>INESTABLE (ej. TA 70/45) NUNCA se mete en el escáner (TC)</b>: el TC es el «túnel de la muerte» en pacientes inestables.")
        )
    )

    # [13] 1792518598245 - Nervios laríngeos
    cards[1792518598245] = (
        front_card("🗣️ ORL · Cirugía Endocrina", "blue", "⚖️ VERSUS",
                   f"Lesión de nervios laríngeos pos-tiroidectomía: {pill('Laríngeo Superior', 'blue')} vs. {pill('Laríngeo Inferior (Recurrente)', 'red')}"),
        back_wrapper(
            versus(
                "🎵 N. Laríngeo Superior", "blue",
                [
                    f"<b>Laringoscopia:</b> {pill('Movilidad de cuerdas NORMAL', 'green')}.",
                    f"<b>Rama Externa (motora → m. cricotiroideo):</b> Tensor de la cuerda → {pill('fatiga vocal', 'blue')} y {pill('no alcanza notas agudas', 'blue')} (tono monótono/grave).",
                    f"<b>Rama Interna (sensitiva):</b> Anestesia del vestíbulo laríngeo → {pill('atragantamiento / aspiración', 'amber')} y retención de saliva en senos piriformes."
                ],
                "🗣️ N. Laríngeo Inferior (Recurrente)", "red",
                [
                    "Inerva TODOS los demás músculos intrínsecos de la laringe.",
                    f"<b>Lesión UNILATERAL:</b> Cuerda inmóvil en posición paramediana → {pill('Disfonía / voz bitonal', 'red')}.",
                    f"<b>Lesión BILATERAL:</b> Ambas cuerdas cerradas en línea media → {pill('Disnea y estridor agudo', 'red')} (requiere <b>traqueotomía</b>)."
                ]
            ),
            callout("trap", "Si en la pregunta te dicen que en la laringoscopia <b>las cuerdas se mueven bien</b> pero la paciente se cansa al hablar y no llega a los agudos → es el <b>Laríngeo Superior</b>.")
        )
    )

    # [14] 1792518598255 - Alergia a vegetales LTP vs Profilinas
    cards[1792518598255] = (
        front_card("🔬 Alergología · Inmunología", "amber", "⚖️ VERSUS",
                   f"Alergia a frutas/vegetales: {pill('LTP (Pru p 3, melocotón)', 'red')} vs. {pill('Profilinas / PR-10', 'green')}"),
        back_wrapper(
            versus(
                "🍑 LTP (Proteínas Transportadoras de Lípidos · Pru p 3)", "red",
                [
                    f"Alérgeno mayor del {pill('melocotón / rosáceas', 'red')} en el área mediterránea (concentrado en la piel).",
                    f"Son {pill('TERMOESTABLES y resistentes al ácido/pepsina', 'red')}.",
                    f"Pasan intactas a sangre → producen {pill('ANAFILAXIA y reacciones sistémicas graves', 'red')}."
                ],
                "🍏 Profilinas y PR-10 (Bet v 1)", "green",
                [
                    "Panalérgenos responsables de reactividad cruzada polen-frutas.",
                    f"Son {pill('TERMOLÁBILES y se destruyen con la digestión', 'green')}.",
                    f"Solo dan picor local en boca ({pill('Síndrome de Alergia Oral', 'green')}) y se toleran si la fruta está cocinada."
                ]
            ),
            callout("trap", "<b>Regla de oro en Alergología:</b> Si un paciente tiene prick o IgE positiva a un alimento (ej. nuez/manzana) pero <b>lo come sin síntomas, NUNCA se le retira de la dieta</b> (es sensibilización subclínica y retirarlo puede hacer que pierda la tolerancia).")
        )
    )

    # [15] 1792518598265 - Riesgo Atribuible
    cards[1792518598265] = (
        front_card("📊 Epidemiología", "purple", "🎯 MEDIDAS DE IMPACTO",
                   "Definición e interpretación clínica del Riesgo Atribuible (RA / Diferencia de Incidencias)",
                   "Ej: «El Riesgo Atribuible entre sedentarismo y diabetes es del 13%»"),
        back_wrapper(
            steps([
                ("purple", "📐 Fórmula matemática",
                 f"{pill('RA = Incidencia en Expuestos (Ie) − Incidencia en No Expuestos (I0)', 'purple')}"),
                ("green", "🗣️ Cómo se lee en una frase de examen",
                 f"«De todas las personas expuestas (sedentarias), el {pill('13% desarrollarán diabetes debido EN EXCLUSIVA al sedentarismo', 'green')}» (es el exceso absoluto de riesgo que eliminaríamos en los expuestos si quitáramos el factor)."),
            ]),
            callout("trap", "No lo confundas con el <b>Riesgo Relativo (RR = Ie / I0)</b> («cuántas veces más probable es») ni con la <b>Fracción Atribuible en Expuestos (FAE = RA / Ie)</b> («qué porcentaje de los enfermos expuestos se debe al factor»).")
        )
    )

    # [16] 1792518598275 - Demencia por Cuerpos de Lewy
    cards[1792518598275] = (
        front_card("🧠 Neurología", "purple", "🎯 TRÍADA CLÁSICA",
                   "Demencia por Cuerpos de Lewy (α-sinucleinopatía): Criterios diagnósticos clave"),
        back_wrapper(
            steps([
                ("blue", "1️⃣ Deterioro cognitivo FLUCTUANTE",
                 f"Grandes variaciones de un día a otro (o en horas) en la {pill('atención, alerta y funciones ejecutivas', 'blue')}."),
                ("purple", "2️⃣ Alucinaciones VISUALES estructuradas",
                 f"Ven personas, niños o animales bien formados de forma precoz y recurrente."),
                ("red", "3️⃣ Parkinsonismo + Hipersensibilidad letal a NEUROLÉPTICOS",
                 f"Rigidez/bradicinesia + {pill('empeoramiento brusco y grave al darle un antipsicótico', 'red')} (haloperidol/risperidona). Asocia también trastorno de conducta del sueño REM."),
            ]),
            callout("trap", "Regla del año: en la <b>Demencia por Cuerpos de Lewy</b> la demencia aparece <b>antes o en el 1.er año</b> del parkinsonismo; en la <b>Demencia asociada a Parkinson</b> aparece tras muchos años de Parkinson.")
        )
    )

    # [17] 1792518598285 - Síndrome de dolor miofascial
    cards[1792518598285] = (
        front_card("🦴 Rehabilitación · Reumatología", "teal", "⚖️ SÍ TIENE vs. NO TIENE",
                   "Síndrome de Dolor Miofascial: ¿Cuáles son sus 3 componentes y qué hallazgo lo descarta?"),
        back_wrapper(
            versus(
                "✅ SÍ presenta (Tríada diagnóstica)", "green",
                [
                    f"1) {pill('Banda tensa palpable', 'green')} dentro del músculo esquelético.",
                    f"2) {pill('Punto gatillo (trigger point)', 'green')}: nódulo hipersensible que al presionarlo da respuesta de espasmo local.",
                    f"3) {pill('Dolor referido regional', 'green')} reproducible al presionar el punto gatillo."
                ],
                "❌ NUNCA presenta", "red",
                [
                    f"{pill('NO produce pérdida de fuerza muscular real (paresia)', 'red')} (el balance muscular de Daniels es normal, 5/5; solo hay inhibición antiálgica).",
                    "NO produce hiporreflexia ni atrofia neurógena (si los hay → buscar radiculopatía)."
                ]
            )
        )
    )

    # [18] 1792518598295 - Clasificación de Seddon
    cards[1792518598295] = (
        front_card("🦴 Traumatología · Nervio Periférico", "blue", "🧭 CLASIFICACIÓN DE SEDDON",
                   f"Lesiones nerviosas periféricas: {pill('Neurapraxia', 'green')} · {pill('Axonotmesis', 'amber')} · {pill('Neurotmesis', 'red')}"),
        back_wrapper(
            steps([
                ("green", "🟢 1. Neurapraxia (Compresión leve / «parálisis del sábado noche»)",
                 f"Desmielinización focal con <b>axón íntegro</b> → {pill('NO hay degeneración Walleriana', 'green')}. Se recupera sola por completo en días/semanas."),
                ("amber", "🟡 2. Axonotmesis (Rotura del axón con envolturas conjuntivas íntegras)",
                 f"El axón se corta pero el <b>endoneuro/perineuro siguen intactos</b> como un tubo guía → {pill('Degeneración Walleriana DISTAL', 'amber')} (desde la lesión hacia la periferia) y {pill('regeneración espontánea completa a 1 mm/día', 'green')}."),
                ("red", "🔴 3. Neurotmesis (Sección completa del nervio)",
                 f"Rotura de axón y envolturas (endoneuro/perineuro/epineuro) → {pill('No recupera sola: requiere sutura quirúrgica', 'red')}."),
            ]),
            callout("trap", "La <b>degeneración Walleriana</b> va siempre en sentido <b>DISTAL (del corte hacia la mano/pie)</b>, NUNCA hacia el soma neuronal.")
        )
    )

    # [19] 1792518598305 - Escala de Glasgow
    cards[1792518598305] = (
        front_card("🧠 Neurología · Urgencias", "blue", "🔢 ESCALA DE GLASGOW (3 a 15)",
                   f"Puntuación de la Escala de Coma de Glasgow: {pill('Ojos (4)', 'blue')} · {pill('Verbal (5)', 'purple')} · {pill('Motora (6)', 'green')}"),
        back_wrapper(
            steps([
                ("blue", "👁️ Apertura Ocular (1 a 4 puntos)",
                 f"<b>4:</b> Espontánea · <b>3:</b> A la orden verbal · {pill('2: Al estímulo doloroso', 'blue')} · <b>1:</b> Ninguna."),
                ("purple", "🗣️ Respuesta Verbal (1 a 5 puntos)",
                 f"<b>5:</b> Orientado · <b>4:</b> Confuso · <b>3:</b> Palabras inapropiadas/sueltas · {pill('2: Sonidos incomprensibles (quejidos)', 'purple')} · <b>1:</b> Ninguna."),
                ("green", "💪 Respuesta Motora (1 a 6 puntos — la de mayor valor pronóstico)",
                 f"<b>6:</b> Obedece órdenes · {pill('5: Localiza el dolor', 'green')} · <b>4:</b> Retira al dolor · {pill('3: Flexión anormal (Decorticación)', 'amber')} · {pill('2: Extensión anormal (Descerebración)', 'red')} · <b>1:</b> Ninguna."),
            ]),
            callout("physio", "TCE Leve: 14–15 · TCE Moderado: 9–13 · <b>TCE Grave / Coma (indicación de intubar): ≤ 8 puntos</b>.")
        )
    )

    # [20] 1792518598315 - Manejo de la Ascitis
    cards[1792518598315] = (
        front_card("🍽️ Digestivo · Hepatología", "amber", "🧭 ALGORITMO POR GRADOS",
                   "Manejo de la Ascitis no complicada en el paciente cirrótico"),
        back_wrapper(
            steps([
                ("blue", "🔎 Regla Inicial Obligatoria (Debut o Ingreso)",
                 f"En todo <b>1.er episodio de ascitis (debut)</b> o cirrótico que ingresa: hacer siempre {pill('Paracentesis diagnóstica', 'blue')} (gradiente GASA ≥1,1 g/dL y descartar PBE con PMN <250/mm³)."),
                ("green", "🟢 Grado 1 (Leve: solo visible en ecografía)",
                 f"Restricción moderada de sal ({pill('dieta hiposódica', 'green')}) y seguimiento."),
                ("amber", "🟡 Grado 2 (Moderada: distensión simétrica sin tensión)",
                 f"Manejo {pill('AMBULATORIO (NO requiere ingreso)', 'amber')} con dieta hiposódica + diuréticos: {pill('Espironolactona 100 mg ± Furosemida 40 mg', 'amber')} (relación 100:40)."),
                ("red", "🔴 Grado 3 (A tensión / Masiva)",
                 f"{pill('Paracentesis evacuadora total', 'red')} + infusión de {pill('Albúmina IV (8 g por litro extraído si se sacan > 5 L)', 'red')} para prevenir la disfunción circulatoria posparacentesis."),
            ])
        )
    )

    # [21] 1792518598325 - Obesidad e indicaciones de Cirugía Bariátrica
    cards[1792518598325] = (
        front_card("🍽️ Endocrinología · Cirugía", "teal", "🧭 CRITERIOS QUIRÚRGICOS",
                   "Grados de Obesidad por IMC e Indicaciones / Contraindicaciones de Cirugía Bariátrica"),
        back_wrapper(
            steps([
                ("slate", "📏 Clasificación de Obesidad por IMC (kg/m²)",
                 f"Sobrepeso: 25–29,9 · <b>Grado I:</b> 30–34,9 · {pill('Grado II: 35–39,9', 'amber')} · {pill('Grado III (Mórbida): ≥ 40', 'red')} · <b>Grado IV (Extrema):</b> ≥ 50."),
                ("green", "✅ Indicaciones de Cirugía Bariátrica",
                 f"Edad {pill('18 a 60–65 años', 'green')} tras fracaso de dieta/ejercicio con:<br>"
                 f"• {pill('IMC ≥ 40 kg/m²', 'green')} (con o sin comorbilidades), O<br>"
                 f"• {pill('IMC ≥ 35 kg/m² (Grado II) + Comorbilidad mayor', 'green')} (DM2, HTA, SAOS, artropatía de carga)."),
                ("red", "🚫 Contraindicaciones / Criterios de Exclusión",
                 f"• {pill('Mal cumplimiento higienicodietético previo', 'red')} o rechazo al seguimiento.<br>"
                 f"• {pill('Trastorno psiquiátrico o adicción ACTIVA/NO controlada', 'red')} (si está <b>estable</b> con medicación, <b>NO contraindica</b>).<br>"
                 f"• Edad avanzada (>65–70 años, donde el riesgo supera el beneficio)."),
            ])
        )
    )

    # [22] 1792518598335 - SOP
    cards[1792518598335] = (
        front_card("🤰 Ginecología", "purple", "🎯 CLAVES BIOQUÍMICAS",
                   "Síndrome de Ovario Poliquístico (SOP): Marcador más sensible y trampa del cociente LH/FSH"),
        back_wrapper(
            steps([
                ("purple", "🧪 Marcador bioquímico MÁS sensible de hiperandrogenismo",
                 f"El {pill('Índice de Testosterona Libre', 'purple')} (porque la resistencia a la insulina baja la SHBG hepática, dejando mucha testosterona libre activa aunque la total sea normal)."),
                ("amber", "⚖️ Cociente LH / FSH > 2–3: Delgadas vs. Obesas",
                 f"• En pacientes con SOP {pill('DELGADAS', 'blue')}: Es muy típico encontrar el cociente {pill('LH/FSH elevado (> 2–3)', 'blue')}.<br>"
                 f"• En pacientes con SOP {pill('OBESAS', 'amber')}: El cociente {pill('LH/FSH suele ser NORMAL', 'amber')} (la hiperinsulinemia y la leptina amortiguan la amplitud de los pulsos de LH)."),
            ])
        )
    )

    # [23] 1792518621605 - Tiempos de ATB en Sepsis
    cards[1792518621605] = (
        front_card("🦠 Infecciosas · Urgencias", "red", "⏱️ SURVIVING SEPSIS CAMPAIGN",
                   f"Tiempo máximo para iniciar Antibioterapia Empírica IV: {pill('< 1 Hora', 'red')} vs. {pill('< 3 Horas', 'amber')}"),
        back_wrapper(
            versus(
                "🚨 En < 1 HORA (Inmediato)", "red",
                [
                    f"Pacientes con {pill('SHOCK SÉPTICO', 'red')} (hipotensión que requiere vasopresores y lactato >2 mmol/L).",
                    f"Pacientes con {pill('alta probabilidad / certeza de Sepsis', 'red')}.",
                    "Extraer hemocultivos (sin retrasar el inicio >45 min) y poner ATB IV de inmediato."
                ],
                "⏳ En < 3 HORAS (Evaluación rápida)", "amber",
                [
                    f"Pacientes con {pill('posible sepsis SIN shock', 'amber')} en los que aún {pill('dudas de si la causa es infecciosa o no', 'amber')}.",
                    "Tienes hasta <b>3 horas</b> para hacer pruebas urgentes (analítica/imagen) y, si persiste la sospecha infecciosa, iniciar ATB antes de las 3h."
                ]
            ),
            callout("trap", "¡El plazo de «6 horas» es FALSO! En la guía actual de sepsis solo existen los escalones de <b>1 hora</b> (con shock o sepsis clara) y <b>3 horas</b> (posible sepsis sin shock).")
        )
    )

    # [24] 1792518621615 - Quinolonas Norfloxacino vs Ciprofloxacino
    cards[1792518621615] = (
        front_card("💊 Farmacología · Infecciosas", "blue", "⚖️ VERSUS",
                   f"Quinolonas en el MIR: {pill('Norfloxacino', 'amber')} vs. {pill('Ciprofloxacino / Levofloxacino', 'green')}"),
        back_wrapper(
            versus(
                "🚽 Norfloxacino (No sistémica)", "amber",
                [
                    f"Baja biodisponibilidad: {pill('NO alcanza niveles terapéuticos en sangre/tejidos', 'red')}.",
                    f"Solo concentra en la {pill('orina (cistitis / ITU baja)', 'amber')} y en la {pill('luz intestinal', 'amber')}.",
                    "En la PBE del cirrótico se usa como <b>descontaminación digestiva selectiva</b> (mata bacterias en la tripa antes de que trasloquen)."
                ],
                "🩸 Ciprofloxacino y Levofloxacino (Sistémicas)", "green",
                [
                    f"Excelente absorción oral y penetración tisular: {pill('SÍ sirven para infecciones sistémicas', 'green')} (pielonefritis, prostatitis, osteomielitis, neumonía).",
                    f"<b>Ciprofloxacino:</b> La quinolona más potente frente a {pill('Pseudomonas aeruginosa', 'blue')}.",
                    f"<b>Levofloxacino/Moxifloxacino:</b> Quinolonas respiratorias (cubren <i>Neumococo</i>)."
                ]
            )
        )
    )

    # [25] 1792518621625 - Adrenalina en RCP avanzada
    cards[1792518621625] = (
        front_card("🫀 Urgencias · RCP Avanzada", "red", "⚖️ VERSUS",
                   f"¿Cuándo se administra la 1.ª dosis de {pill('Adrenalina 1 mg IV', 'red')} en una Parada Cardiorrespiratoria?"),
        back_wrapper(
            versus(
                "📉 Ritmo NO Desfibrilable (Asistolia / AESP)", "blue",
                [
                    f"Administrar Adrenalina 1 mg IV {pill('DE INMEDIATO', 'green')} en cuanto se canalice acceso venoso/intraóseo.",
                    "Repetir 1 mg cada <b>3 a 5 minutos</b> (en ciclos alternos de RCP)."
                ],
                "⚡ Ritmo Desfibrilable (FV / TV sin pulso)", "red",
                [
                    f"Administrar la 1.ª dosis de Adrenalina 1 mg IV {pill('TRAS LA 3.ª DESCARGA', 'red')}.",
                    f"Tras la 3.ª descarga también se administra el bolo de {pill('Amiodarona 300 mg IV', 'amber')} (o Lidocaína 100 mg)."
                ]
            ),
            callout("physio", "Si la PCR es en víctima de un <b>incendio con hollín en boca</b>, sospechar intoxicación por <b>Cianuro</b> → administrar el antídoto <b>Hidroxocobalamina IV</b> y prolongar la RCP.")
        )
    )

    # [26] 1792520939257 - Enterocolitis necrotizante
    cards[1792520939257] = (
        front_card("👶 Pediatría · Neonatología", "red", "🎯 CASO CLÍNICO TÍPICO",
                   f"Recién nacido {pill('prematuro', 'blue')} con distensión abdominal, sangre en heces y Rx con {pill('neumatosis intestinal y gas portal', 'red')}",
                   "Diagnóstico, tratamiento inicial e indicación absoluta de cirugía"),
        back_wrapper(
            steps([
                ("blue", "🩺 Diagnóstico: Enterocolitis Necrotizante (ECN)",
                 f"Isquemia-necrosis mucosa intestinal del prematuro (la lactancia materna es protectora). Rx patognomónica: {pill('Neumatosis intestinal', 'blue')} (burbujas de gas intramural) ± {pill('gas en la vena porta', 'blue')}."),
                ("green", "🏥 Tratamiento Inicial (Médico / Conservador)",
                 f"{pill('Dieta absoluta', 'green')} + <b>Sonda nasogástrica descompresiva</b> + <b>Antibioterapia empírica IV</b> y soporte hemodinámico."),
                ("red", "🔪 Indicación ABSOLUTA de Cirugía",
                 f"{pill('Neumoperitoneo (perforación libre)', 'red')} o peritonitis/sepsis refractaria al tratamiento médico."),
            ])
        )
    )

    # [27] 1792520939267 - Tromboflebitis pélvica séptica vs Absceso pélvico
    cards[1792520939267] = (
        front_card("🤰 Obstetricia · Puerperio", "purple", "⚖️ VERSUS",
                   "Puérpera con endometritis que tras >72h de triple ATB IV (Ampi+Genta+Clinda) sigue con fiebre en picos/agujas",
                   f"¿Cómo distingues {pill('Tromboflebitis pélvica séptica', 'purple')} de {pill('Absceso pélvico', 'amber')}?"),
        back_wrapper(
            versus(
                "🩸 Tromboflebitis Pélvica Séptica", "purple",
                [
                    f"Picos febriles altos en agujas y escalofríos, pero {pill('buen estado general entre picos', 'green')}.",
                    f"<b>Ecografía pélvica:</b> {pill('NORMAL (sin absceso ni restos)', 'purple')}.",
                    f"Afecta sobre todo a la {pill('vena ovárica derecha', 'purple')} (diagnóstico por angio-TC/RM).",
                    f"<b>Tratamiento:</b> Añadir {pill('Heparina a dosis anticoagulantes', 'green')} a los antibióticos."
                ],
                "🦠 Absceso Pélvico", "amber",
                [
                    f"{pill('Mal estado general continuo', 'red')}, dolor intenso y signos de irritación peritoneal.",
                    f"<b>Exploración y Ecografía:</b> Se palpa y visualiza una {pill('MASA fluctuante', 'amber')} anexial o en fondo de saco de Douglas.",
                    f"<b>Tratamiento:</b> Requiere {pill('drenaje quirúrgico o percutáneo', 'red')}."
                ]
            )
        )
    )

    # [28] 1792520939277 - Síndrome de Reye
    cards[1792520939277] = (
        front_card("👶 Pediatría", "amber", "🎯 RETRATO ROBOT MIR",
                   "Síndrome de Reye: Antecedente desencadenante, clínica y trampa analítica (¿Hipoglucemia o Ictericia?)"),
        back_wrapper(
            steps([
                ("amber", "💊 Antecedente Desencadenante",
                 f"Niño con infección viral ({pill('Varicela o Gripe', 'amber')}) tratado con {pill('Ácido Acetilsalicílico (Aspirina)', 'red')} → daño mitocondrial agudo con <b>esteatosis hepática microvesicular</b>."),
                ("blue", "🧠 Clínica Bifásica",
                 "A los 5–7 días del cuadro viral inicia <b>vómitos bruscos incoercibles</b> seguidos de <b>encefalopatía aguda</b> (letargia, convulsiones, coma por edema cerebral) y hepatomegalia."),
                ("green", "🧪 Analítica Clave (¡Pregunta clásica!)",
                 f"↑↑ Transaminasas (GOT/GPT), ↑↑ Amonio, alargamiento de tiempos de coagulación y {pill('SÍ da HIPOGLUCEMIA grave', 'green')}, pero {pill('NO da ICTERICIA (Bilirrubina normal)', 'red')}."),
            ])
        )
    )

    # [29] 1792520939287 - Dosis de ISRS
    cards[1792520939287] = (
        front_card("🧠 Psiquiatría · Farmacología", "purple", "⚖️ VERSUS",
                   f"Dosificación de los ISRS: ¿En qué trastornos se usan {pill('Dosis MUY ALTAS', 'red')} vs. {pill('Dosis muy bajas al inicio', 'blue')}?"),
        back_wrapper(
            versus(
                "⬆️ Dosis MUY ALTAS (Ej. Fluoxetina 60–80 mg/día)", "red",
                [
                    f"1) {pill('Bulimia nerviosa', 'red')} (efecto antiimpulsivo/antiatracón).",
                    f"2) {pill('Trastorno Obsesivo-Compulsivo (TOC)', 'red')} (efecto antiobsesivo).",
                    "Requieren el doble o triple de la dosis antidepresiva estándar (20 mg)."
                ],
                "⬇️ Dosis MUY BAJAS al inicio", "blue",
                [
                    f"{pill('Trastorno de Angustia (Pánico)', 'blue')}.",
                    "Se empieza a mitad de dosis porque los primeros días los ISRS pueden dar un pico paradójico de ansiedad.",
                    f"<i>(La crisis de pánico <b>aguda</b> se corta con {pill('Benzodiacepinas', 'green')}, ya que el ISRS tarda 2–4 sem en actuar).</i>"
                ]
            )
        )
    )

    # [30] 1792520939297 - Metástasis cerebral única
    cards[1792520939297] = (
        front_card("🧠 Neurocirugía · Oncología", "blue", "⚖️ VERSUS",
                   "Tratamiento de Metástasis Cerebral Única (u oligometástasis) con tumor primario controlado",
                   f"¿Cuándo elegir {pill('Cirugía de resección + RT', 'red')} vs. {pill('Radiocirugía estereotáxica', 'blue')}?"),
        back_wrapper(
            versus(
                "🔪 Cirugía de Resección + Radioterapia", "red",
                [
                    f"Lesión en zona {pill('accesible', 'green')}.",
                    f"Tamaño {pill('grande (> 3 cm)', 'red')}.",
                    f"Produce importante {pill('efecto masa, edema vasogénico o focalidad neurológica aguda', 'red')} (la cirugía descomprime de inmediato)."
                ],
                "🎯 Radiocirugía Estereotáxica (SRS)", "blue",
                [
                    f"Lesión {pill('pequeña (< 3 cm)', 'blue')} con escaso efecto masa.",
                    f"Localización {pill('profunda o elocuente/inaccesible', 'blue')} (ganglios basales, tálamo, tronco encéfalo).",
                    "También de elección en tumores radioresistentes (melanoma, renal, sarcoma) pequeños."
                ]
            ),
            callout("physio", "Si el tumor primario <b>NO está controlado</b> y hay metástasis sistémicas diseminadas con mal pronóstico → solo <b>Corticoides (Dexametasona) ± RT holocraneal paliativa</b>.")
        )
    )

    # [31] 1792520939307 - AMS vs PSP
    cards[1792520939307] = (
        front_card("🧠 Neurología", "purple", "⚖️ VERSUS",
                   f"Parkinsonismos Plus: {pill('Atrofia Multisistémica (AMS)', 'blue')} vs. {pill('Parálisis Supranuclear Progresiva (PSP)', 'amber')}"),
        back_wrapper(
            versus(
                "🧬 AMS (Atrofia Multisistémica · α-Sinucleína)", "blue",
                [
                    "Parkinsonismo rígido-acinético simétrico con mala respuesta a L-Dopa.",
                    f"<b>1)</b> {pill('Disautonomía precoz', 'blue')} (hipotensión ortostática, incontinencia/impotencia).",
                    f"<b>2)</b> {pill('Clínica Cerebelosa (AMS-C)', 'blue')} (ataxia, dismetría).",
                    f"<b>3)</b> {pill('Piramidalismo (Signo de Babinski +)', 'blue')}."
                ],
                "👁️ PSP (Enf. de Steele-Richardson · Tauopatía)", "amber",
                [
                    "Parkinsonismo axial con hipertonía en extensión del cuello.",
                    f"<b>1)</b> {pill('Caídas precoces e inexplicables hacia atrás', 'amber')} (en el 1.er año).",
                    f"<b>2)</b> {pill('Parálisis de la mirada conjugada VERTICAL (hacia abajo)', 'amber')}.",
                    "<b>3)</b> Disfunción frontal / apatía precoz."
                ]
            )
        )
    )

    # [32] 1792520939317 - Perthes pronóstico
    cards[1792520939317] = (
        front_card("🦴 Traumatología Infantil", "green", "⚖️ BUEN vs. MAL PRONÓSTICO",
                   "Factores pronósticos en la Enfermedad de Perthes (necrosis avascular idiopática de cabeza femoral)"),
        back_wrapper(
            versus(
                "✅ BUEN Pronóstico", "green",
                [
                    f"Edad de inicio {pill('≤ 6 años', 'green')} (el factor pronóstico más importante: gran potencial de remodelación esférica del acetábulo y cabeza femoral).",
                    "Sexo masculino (los niños tienen maduración ósea más lenta y más margen para remodelar).",
                    "Conservación del rango de movilidad articular y pilar lateral íntegro (Herring A)."
                ],
                "❌ MAL Pronóstico", "red",
                [
                    f"Edad de inicio tardía ({pill('> 8 años', 'red')}).",
                    f"{pill('Sexo femenino', 'red')} (cierran antes la fisis).",
                    f"{pill('Pérdida de movilidad / contractura en flexo-aducción', 'red')} de cadera.",
                    f"Obesidad y colapso de >50% del pilar lateral ({pill('Herring C', 'red')})."
                ]
            )
        )
    )

    # [33] 1792520939327 - Taquicardia QRS ancho con IAM previo
    cards[1792520939327] = (
        front_card("🫀 Cardiología · Arritmias", "red", "🚨 REGLA DE ORO MIR",
                   f"Paciente con {pill('IAM previo', 'red')} que acude con taquicardia regular de {pill('QRS ancho (> 0,12 s)', 'red')}",
                   "Diagnóstico inmediato, fármacos de elección y fármaco PROHIBIDO"),
        back_wrapper(
            steps([
                ("red", "🩺 Diagnóstico: Taquicardia Ventricular (TV) Monomorfa Sostenida",
                 "Toda taquicardia regular de QRS ancho es una TV hasta que se demuestre lo contrario (y con antecedente de IAM previo lo es en >90% de los casos)."),
                ("green", "✅ Tratamiento si está hemodinámicamente ESTABLE",
                 f"1.ª elección: {pill('Procainamida IV', 'green')} (o <b>Amiodarona IV</b> o {pill('Lidocaína IV', 'blue')}). <i>Si está inestable → Cardioversión eléctrica sincronizada.</i>"),
                ("amber", "🚫 Fármaco ABSOLUTAMENTE PROHIBIDO",
                 f"{pill('Verapamilo / Diltiazem', 'red')} (y adenosina/betabloqueantes como prueba): producen hipotensión severa, shock cardiogénico y degeneración a Fibrilación Ventricular."),
            ]),
            callout("physio", "<b>¿Por qué la Lidocaína sirve en la TV si es un anestésico local?</b> Porque es un antiarrítmico <b>Clase Ib</b>: bloquea los <b>canales de Sodio (Na⁺)</b> del miocardio ventricular isquémico exactamente igual que bloquea los canales de Na⁺ del nervio periférico.")
        )
    )

    # [34] 1792574776626 - Ventilación mecánica en SDRA
    cards[1792574776626] = (
        front_card("🫁 Neumología · UCI", "blue", "🎯 VENTILACIÓN PROTECTORA",
                   f"Paciente con {pill('SDRA (Distrés Respiratorio Agudo)', 'blue')} que llega de quirófano {pill('intubado y relajado', 'purple')}",
                   "¿Qué modalidad y parámetros de ventilación mecánica reducen la mortalidad?"),
        back_wrapper(
            steps([
                ("green", "✅ Estrategia de Elección: Control de Volumen + Ventilación Protectora",
                 f"• <b>Modalidad:</b> {pill('Control de Volumen (CMV)', 'green')} (permite garantizar el volumen exacto en un paciente paralizado).<br>"
                 f"• <b>Volumen corriente BAJO:</b> {pill('6 mL/kg de peso ideal', 'green')} (evita el <i>volutrauma</i> en el «baby lung»).<br>"
                 f"• <b>Presiones:</b> {pill('PEEP moderada-alta', 'blue')} (evita el colapso alveolar) y <b>Presión meseta (plateau) < 30 cmH₂O</b>."),
                ("red", "❌ Por qué NO se pone «Presión Soporte (PSV)» en este paciente",
                 f"La {pill('Presión Soporte', 'red')} es una modalidad espontánea (para el destete: el paciente tiene que iniciar cada respiración). Un paciente <b>relajado (paralizado)</b> no inicia respiraciones y haría apnea."),
            ]),
            callout("physio", "Las 2 únicas medidas ventilatorias que han demostrado reducir mortalidad en el SDRA grave son: <b>1) Volumen corriente bajo (6 mL/kg)</b> y <b>2) Decúbito prono</b> (si PaO₂/FiO₂ < 150).")
        )
    )

    # [35] 1792574776636 - Clasificación de Forrest
    cards[1792574776636] = (
        front_card("🍽️ Digestivo · Endoscopia", "red", "⚖️ ALTO vs. BAJO RIESGO",
                   "Clasificación de Forrest en Hemorragia por Úlcera Péptica y actitud en cada grupo"),
        back_wrapper(
            versus(
                "🔴 ALTO RIESGO (Forrest Ia, Ib, IIa, IIb)", "red",
                [
                    "• <b>Ia:</b> Sangrado a chorro (arterial).",
                    "• <b>Ib:</b> Sangrado en sábana / babeo.",
                    "• <b>IIa:</b> Vaso visible no sangrante.",
                    f"• <b>IIb:</b> {pill('Coágulo adherido', 'red')}.",
                    f"<b>Actitud:</b> {pill('Doble terapia endoscópica (Adrenalina + Clip/Termo)', 'red')} + {pill('IBP IV en perfusión', 'red')} e ingreso 72h."
                ],
                "🟢 BAJO RIESGO (Forrest IIc y III)", "green",
                [
                    f"• <b>IIc:</b> {pill('Fondo con puntos de hematina', 'green')} (manchas oscuras planas).",
                    f"• <b>III:</b> {pill('Base de fibrina limpia', 'green')}.",
                    f"<b>Actitud:</b> {pill('NO hacer hemostasia endoscópica', 'green')} + <b>IBP oral</b> + dieta precoz.",
                    f"<i>(Si es úlcera <b>gástrica</b>: {pill('biopsiar siempre los bordes', 'blue')} para descartar adenocarcinoma).</i>"
                ]
            )
        )
    )

    # [36] 1792574776646 - Cáncer de páncreas Borderline
    cards[1792574776646] = (
        front_card("🍽️ Cirugía General · Páncreas", "amber", "🧭 SEMÁFORO DE RESECABILIDAD",
                   "Criterios de Resecabilidad en el Cáncer de Páncreas: Resecable vs. Borderline vs. Irresecable"),
        back_wrapper(
            steps([
                ("green", "🟢 1. Directamente RESECABLE → Cirugía de entrada",
                 f"{pill('Cero contacto arterial', 'green')} (AMS, tronco celíaco, arteria hepática) y eje venoso mesentérico-portal libre (o contacto <180° sin deformar la luz)."),
                ("amber", "🟡 2. BORDERLINE Resectable → Quimioterapia NEOADYUVANTE y reevaluar cirugía",
                 f"• <b>Arterias (AMS o Tronco Celíaco):</b> Contacto limitado {pill('< 180°', 'amber')}.<br>"
                 f"• <b>Venas (Porta o Mesentérica Superior):</b> Contacto {pill('> 180°', 'amber')}, o {pill('< 180° CON trombosis/irregularidad', 'amber')}, siempre que tenga cabos sanos para ser <b>reconstruible</b>."),
                ("red", "🔴 3. Directamente IRRESECABLE → Quimioterapia paliativa / sistémica",
                 f"• Contacto arterial {pill('> 180°', 'red')} con AMS o Tronco Celíaco.<br>"
                 f"• Trombosis venosa extensa <b>no reconstruible</b>.<br>"
                 f"• Metástasis a distancia (M1) o {pill('adenopatías macroscópicas fuera del campo de resección', 'red')}."),
            ])
        )
    )

    # [37] 1792574776656 - Hepatocarcinoma BCLC
    cards[1792574776656] = (
        front_card("🍽️ Digestivo · Hepatología", "blue", "🧭 ALGORITMO BCLC",
                   "Algoritmo de tratamiento del Hepatocarcinoma (Clasificación BCLC en cirróticos)"),
        back_wrapper(
            steps([
                ("green", "🟢 BCLC 0 y A (Inicial · Child A–B · ECOG 0)",
                 f"• <b>Nódulo único sin HTP y bilirrubina normal:</b> {pill('Resección quirúrgica', 'green')}.<br>"
                 f"• <b>Cumple Criterios de Milán (1 nódulo ≤5 cm o ≤3 nódulos de ≤3 cm) con HTP:</b> {pill('Trasplante hepático', 'green')} (o <b>Ablación por radiofrecuencia</b> si <2–3 cm / no candidato)."),
                ("amber", "🟡 BCLC B (Intermedio · Multinodular fuera de Milán · Child A–B · ECOG 0 · SIN invasión portal)",
                 f"Tratamiento locorregional con {pill('Quimioembolización transarterial (TACE)', 'amber')}."),
                ("red", "🔴 BCLC C (Avanzado · INVASIÓN/TROMBOSIS PORTAL, Metástasis o ECOG 1–2 · Child A)",
                 f"Tratamiento sistémico: {pill('Atezolizumab + Bevacizumab', 'red')} (1.ª línea actual) o {pill('Sorafenib / Lenvatinib', 'red')}."),
                ("slate", "⚫ BCLC D (Terminal · Child C no trasplantable o ECOG 3–4)",
                 "Tratamiento sintomático / Cuidados paliativos."),
            ]),
            callout("physio", "<b>¿Por qué la trombosis portal contraindica la TACE y obliga a dar Sorafenib/Sistémico?</b> Porque el hígado recibe el 75% de su riego por la porta y el 25% por la arteria hepática: si la porta ya está trombosada y embolizas la arteria hepática (TACE), provocas una <b>necrosis hepática isquémica aguda</b>.")
        )
    )

    # [38] 1792574776666 - GN extracapilar inmunofluorescencia
    cards[1792574776666] = (
        front_card("🫘 Nefrología", "blue", "🧭 INMUNOFLUORESCENCIA EN 3 SEGUNDOS",
                   f"Biopsia renal con depósitos {pill('LINEALES de IgG y C3', 'blue')} en la inmunofluorescencia",
                   "Diagnóstico de certeza y clasificación de las 3 Glomerulonefritis Extracapilares (con semilunas)"),
        back_wrapper(
            steps([
                ("blue", "📏 Tipo I (Enf. por anticuerpos anti-MBG / Goodpasture) → Patrón LINEAL",
                 f"Es la {pill('ÚNICA glomerulonefritis con patrón LINEAL', 'blue')} de todo el MIR (el anticuerpo IgG pinta como una línea continua el colágeno IV de la membrana basal glomerular)."),
                ("amber", "⠿ Tipo II (Por Inmunocomplejos: Postestreptocócica, Lupus, IgA, Crioglobulinemia) → Patrón GRANULAR",
                 f"Depósito discontinuo de grumos de inmunocomplejos ({pill('Patrón GRANULAR', 'amber')}) con hipocomplementemia según la causa."),
                ("purple", "⭕ Tipo III (Vasculitis asociadas a ANCA: PAM, Wegener, Churg-Strauss) → PAUCIINMUNE",
                 f"Inmunofluorescencia {pill('NEGATIVA / sin depósitos (Pauciinmune)', 'purple')}."),
            ])
        )
    )

    # [39] 1792574776676 - Potencia de las Estatinas
    cards[1792574776676] = (
        front_card("💊 Farmacología · Riesgo CV", "green", "🧭 ESCALONES DE POTENCIA",
                   "Clasificación de las Estatinas según su potencia hipolipemiante (reducción de LDL)"),
        back_wrapper(
            steps([
                ("red", "🔥 Potencia ALTA (Bajan el LDL > 50% — las 2 que debes memorizar)",
                 f"{pill('Rosuvastatina (20–40 mg)', 'red')} y {pill('Atorvastatina (40–80 mg)', 'red')}."),
                ("amber", "🟡 Potencia MEDIA (Bajan el LDL 30–50%)",
                 f"<b>Simvastatina, Pravastatina, Lovastatina, Fluvastatina</b> (y dosis bajas de Atorvastatina 10–20 mg o Rosuvastatina 5–10 mg)."),
                ("blue", "🔵 Potencia BAJA (Bajan el LDL < 30%)",
                 f"{pill('Pitavastatina', 'blue')} (según clasificación CTO) y dosis bajas de las de potencia media."),
            ])
        )
    )

    # [40] 1792574776686 - Terapias dirigidas en tumores cutáneos y BRAF
    cards[1792574776686] = (
        front_card("🧴 Dermatología · Oncología", "purple", "🧭 TERAPIAS DIRIGIDAS",
                   "Fármacos sistémicos en Tumores Cutáneos Avanzados (Melanoma vs. Epidermoide vs. Basocelular)"),
        back_wrapper(
            steps([
                ("purple", "🖤 1. Melanoma metastásico con mutación BRAF V600E",
                 f"{pill('Inhibidor BRAF (Vemurafenib / Dabrafenib)', 'purple')} + {pill('Inhibidor MEK (Trametinib / Cobimetinib)', 'purple')} (o inmunoterapia con Anti-PD1 [Nivolumab/Pembrolizumab] ± Anti-CTLA4 [Ipilimumab])."),
                ("amber", "🟠 2. Carcinoma Epidermoide (Escamoso) cutáneo avanzado",
                 f"Inmunoterapia anti-PD1: {pill('Cemiplimab', 'amber')} (NUNCA inhibidores BRAF)."),
                ("blue", "🔵 3. Carcinoma Basocelular localmente avanzado / irresecable",
                 f"Inhibidores de la vía <i>Hedgehog</i>: {pill('Vismodegib / Sonidegib', 'blue')}."),
            ]),
            callout("trap", "Los <b>inhibidores de BRAF en monoterapia</b> activan paradójicamente la vía MAPK en los queratinocitos sanos y <b>provocan Carcinomas Epidermoides cutáneos (queratoacantomas) como efecto adverso</b>. <i>(Otros tumores MIR con mutación BRAF V600E: <b>Tricoleucemia 100%</b>, Ca. papilar de tiroides y Astrocitoma pilocítico).</i>")
        )
    )

    # [41] 1792574776696 - TB Primaria vs Posprimaria
    cards[1792574776696] = (
        front_card("🫁 Neumología · Radiología", "blue", "⚖️ VERSUS",
                   f"Fases de la Tuberculosis Pulmonar: {pill('TB Primaria', 'blue')} vs. {pill('TB Posprimaria (Secundaria)', 'red')}"),
        back_wrapper(
            versus(
                "👶 Tuberculosis Primaria (Primoinfección)", "blue",
                [
                    "Típica de <b>niños</b> e inmunodeprimidos.",
                    f"<b>Localización:</b> {pill('Lóbulos medios e inferiores', 'blue')} (zonas mejor ventiladas).",
                    f"<b>Hallazgos clave:</b> {pill('Adenopatías hiliares/paratraqueales', 'blue')} + infiltrado alveolar ({pill('Complejo de Ghon / Ranke', 'blue')}) + derrame pleural. Rara vez cavita."
                ],
                "🧑 Tuberculosis Posprimaria (Reactivación)", "red",
                [
                    "Típica del <b>adulto inmunocompetente</b>.",
                    f"<b>Localización:</b> {pill('Segmentos apicales y posteriores de lóbulos superiores', 'red')} (y superior del lóbulo inferior, donde hay mayor PO₂).",
                    f"<b>Hallazgos clave:</b> {pill('CAVITACIÓN', 'red')} + nódulos centrolobulillares en {pill('«árbol en brote»', 'red')} (sin adenopatías)."
                ]
            ),
            callout("trap", "¡El término «Tuberculosis terciaria» NO existe! (La sífilis o el hiperparatiroidismo tienen fase terciaria; la TB solo es primaria, latente o posprimaria/secundaria).")
        )
    )

    # [42] 1792574776706 - Cribado prenatal y Biopsia Corial vs Amniocentesis
    cards[1792574776706] = (
        front_card("🤰 Obstetricia · Diagnóstico Prenatal", "purple", "🧭 ALGORITMO + VERSUS",
                   "Cribado Combinado del 1.er Trimestre: ¿Cuándo pedir ADN fetal libre vs. Biopsia Corial vs. Amniocentesis?"),
        back_wrapper(
            steps([
                ("blue", "1️⃣ Escalones según el Riesgo del Cribado Combinado (11–13+6 sem)",
                 f"• <b>Riesgo intermedio (1/50 a 1/250–1.000):</b> Pedir {pill('ADN fetal libre en sangre materna (TPNI)', 'blue')} (desde sem 10; si sale positivo, confirmar siempre con técnica invasiva).<br>"
                 f"• <b>Riesgo MUY ALTO (> 1/50, ej. 1/35) o TN ≥ 3,5 mm / malformación ecográfica:</b> Ir directo a {pill('Prueba Invasiva', 'red')}."),
                ("purple", "2️⃣ Elección de la Prueba Invasiva según las Semanas de Gestación",
                 f"• <b>1.er Trimestre (10–13 sem):</b> {pill('Biopsia Corial', 'green')} (la más precoz; de elección tras cribado de alto riesgo en sem 12).<br>"
                 f"• <b>2.º Trimestre (≥ 15 sem):</b> {pill('Amniocentesis', 'amber')} (la de menor riesgo de aborto global, pero su cultivo tarda 2–3 sem).<br>"
                 f"• <b>≥ 18 sem:</b> {pill('Funiculocentesis / Cordocentesis', 'purple')}."),
            ]),
            callout("physio", "<b>¿Por qué está PROHIBIDA la Amniocentesis antes de la semana 15?</b> Porque en el 1.er trimestre el amnios aún no se ha fusionado con el corion y hay muy poco líquido: pinchar antes de la semana 15 produce oligoamnios precoz, bridas amnióticas y <b>Pie Zambo (equinovaro)</b> fetal.")
        )
    )

    # [43] 1792574776716 - Pie plano infantil
    cards[1792574776716] = (
        front_card("🦴 Traumatología Infantil", "teal", "🧭 ALGORITMO EXPLORATORIO",
                   "Diagnóstico y manejo del Pie Plano Infantil: ¿Cuándo es flexible, Aquiles corto o rígido?"),
        back_wrapper(
            steps([
                ("blue", "🔎 Maniobras de Flexibilidad: Ponerse de puntillas (Rodríguez-Fonseca) y extender 1.er dedo (Test de Jack)",
                 "Si al hacerlas <b>aparece el arco plantar y el talón pasa de valgo a varo</b> → el pie es <b>FLEXIBLE</b>."),
                ("green", "🟢 1. Pie Plano Flexible puro (Fisiológico)",
                 f"Es normal por laxitud infantil y corrige solo con el crecimiento → {pill('NO poner plantillas ni calzado ortopédico', 'green')}."),
                ("amber", "🟡 2. Pie Plano Flexible + Flexión dorsal del tobillo limitada (< 10–15°) y dolor en pantorrillas",
                 f"Es un {pill('Pie plano asociado a Tendón de Aquiles corto', 'amber')} → Tratamiento: {pill('Ejercicios de estiramiento del Aquiles', 'amber')}."),
                ("red", "🔴 3. Pie Plano RÍGIDO (NO aparece el arco de puntillas ni con el test de Jack)",
                 f"• En lactante: {pill('Astrágalo vertical congénito', 'red')} («pie en mecedora»).<br>"
                 f"• En niño/adolescente (10–14 años) con dolor y esguinces de repetición: {pill('Coalición tarsiana', 'red')} (fusión calcáneo-escafoidea o astrágalo-calcánea)."),
            ])
        )
    )

    # [44] 1792574776726 - Silicosis
    cards[1792574776726] = (
        front_card("🫁 Neumología", "teal", "🎯 CLÍNICA Y PREVENCIÓN",
                   "Silicosis Crónica: Radiología típica, tratamiento y medida preventiva obligatoria"),
        back_wrapper(
            steps([
                ("blue", "🩻 Radiología característica",
                 f"Nódulos silicóticos en {pill('lóbulos superiores', 'blue')} + adenopatías hiliares calcificadas en {pill('«cáscara de huevo»', 'blue')} (en canteros, mineros, chorro de arena)."),
                ("amber", "🚫 Tratamiento de la Silicosis",
                 f"{pill('NO existe tratamiento farmacológico curativo', 'red')} (los corticoides NO sirven). Solo evitar exposición, soporte con broncodilatadores/O₂ y trasplante pulmonar si fibrosis masiva."),
                ("green", "💉 Medida Obligatoria en TODO paciente con Silicosis",
                 f"Realizar siempre {pill('Prueba de la Tuberculina (Mantoux) / IGRA', 'green')} y dar profilaxis con <b>Isoniazida</b> si es positivo (≥10 mm)."),
            ]),
            callout("physio", "<b>¿Por qué tanta Tuberculosis en la silicosis?</b> Porque los cristales de sílice son fagocitados por los <b>macrófagos alveolares y los destruyen</b>, multiplicando por 30 el riesgo de que el bacilo tuberculoso se reactive.")
        )
    )

    # [45] 1792574776736 - Cirugía en Crohn
    cards[1792574776736] = (
        front_card("🍽️ Digestivo · Cirugía", "amber", "🧭 URGENTE vs. NO URGENTE",
                   "Manejo de las complicaciones en la Enfermedad de Crohn: ¿Cuándo se opera de urgencia?"),
        back_wrapper(
            steps([
                ("red", "🔴 Cirugía URGENTE Inmediata",
                 f"Solo en {pill('Perforación LIBRE (neumoperitoneo / peritonitis difusa)', 'red')}, {pill('Hemorragia masiva', 'red')} refractaria o {pill('Megacolon tóxico', 'red')} que no responde en 24–48h."),
                ("amber", "🟡 Perforación Contenida / Absceso Intraabdominal (NO operar de urgencia)",
                 f"Manejo conservador con {pill('Antibióticos IV + Drenaje percutáneo guiado por Eco/TC', 'amber')} (operar en agudo obligaría a resecar muchísimo intestino sano)."),
                ("blue", "🔵 Fístulas Enterovesicales y Estenosis Fibrosas (NO urgentes)",
                 f"Se tratan primero con {pill('Biológicos anti-TNF (Infliximab)', 'blue')} o dilatación endoscópica; si fracasan, se hace {pill('Cirugía PROGRAMADA', 'blue')} ahorrando intestino."),
            ])
        )
    )

    # [46] 1792574776746 - Hiperparatiroidismo primario asintomático
    cards[1792574776746] = (
        front_card("🦋 Endocrinología · Cirugía", "blue", "🎯 CRITERIOS QUIRÚRGICOS",
                   "Criterios de Cirugía en el Hiperparatiroidismo Primario Asintomático (incluido el normocalcémico)",
                   "¿Qué hacer si la Gammagrafía MIBI y la Ecografía cervical salen negativas?"),
        back_wrapper(
            steps([
                ("green", "✅ Basta cumplir 1 SOLO de estos 4 criterios para indicar Cirugía",
                 f"1) {pill('Edad < 50 años', 'green')} (se opera siempre aunque esté asintomático y con calcio/DMO/riñón normales).<br>"
                 f"2) {pill('Calcio sérico > 1 mg/dL', 'green')} por encima del límite superior de la normalidad.<br>"
                 f"3) <b>Riñón:</b> {pill('FG < 60 mL/min', 'green')}, litiasis/nefrocalcinosis o {pill('calciuria > 400 mg/24h', 'green')}.<br>"
                 f"4) <b>Hueso:</b> {pill('Osteoporosis (T-score ≤ −2,5)', 'green')} en cualquier localización o fractura vertebral previa."),
                ("red", "🚨 Regla de Oro sobre la Gammagrafía Sestamibi (MIBI) y la Ecografía",
                 f"Las pruebas de imagen (Eco + MIBI) solo sirven para planificar una cirugía mínimamente invasiva. Si el paciente cumple criterio (ej. tiene 48 años) y la MIBI/Eco son negativas: {pill('NUNCA se deja en vigilancia → SE OPERA IGUAL', 'red')} (exploración quirúrgica de las 4 glándulas)."),
            ])
        )
    )

    # [47] 1792574776756 - Antieméticos en quimioterapia
    cards[1792574776756] = (
        front_card("💊 Oncología · Farmacología", "purple", "🧭 ESCALONES ANTIEMÉTICOS",
                   "Profilaxis antiemética en Quimioterapia: ¿Qué fármaco se añade en ALTO riesgo emetógeno?"),
        back_wrapper(
            steps([
                ("amber", "🟡 Riesgo Emetógeno MODERADO → Doble Terapia (2 fármacos)",
                 f"{pill('Ondansetrón / Palonosetrón (Anti-5HT₃)', 'amber')} + {pill('Dexametasona', 'amber')}."),
                ("red", "🔴 Riesgo Emetógeno ALTO (Cisplatino, Dacarbazina, o Antraciclina + Ciclofosfamida) → Triple Terapia",
                 f"Se añade específicamente {pill('APREPITANT / Fosaprepitant (Antagonista del receptor NK1 de la sustancia P)', 'red')} a Ondansetrón + Dexametasona."),
            ]),
            callout("trap", "Si en el examen te preguntan qué fármaco está <b>especialmente indicado en alto riesgo emetógeno</b> y entre las opciones están Ondansetrón, Dexametasona y Aprepitant → marca siempre <b>Aprepitant</b> (porque es el que distingue el alto riesgo del moderado).")
        )
    )

    # [48] 1792574776766 - Vacunas Neumococo
    cards[1792574776766] = (
        front_card("💉 Medicina Preventiva · Vacunas", "blue", "⚖️ CONJUGADA vs. POLISACÁRIDA",
                   f"Vacunas Antineumocócicas: {pill('Conjugadas (VNC13 / VNC20)', 'green')} vs. {pill('Polisacárida (VNP23)', 'amber')} y pauta actual"),
        back_wrapper(
            versus(
                "🏆 Conjugadas (VNC13, VNC15, VNC20 · Letra C)", "green",
                [
                    "Polisacárido unido a proteína transportadora → respuesta <b>T-dependiente</b>.",
                    f"{pill('SÍ generan memoria inmunológica', 'green')} y erradican portadores.",
                    f"{pill('SÍ funcionan en niños < 2 años', 'green')}.",
                    f"<b>La mejor hoy:</b> {pill('VNC20 (20-valente)', 'green')} → 1 sola dosis cubre 20 serotipos sin necesitar la VNP23 después."
                ],
                "⏳ Polisacárida Pura (VNP23 · Letra P)", "amber",
                [
                    "Solo polisacáridos capsulares sueltos → respuesta <b>T-independiente</b>.",
                    f"{pill('NO genera memoria inmunológica', 'red')} (baja a los 5 años).",
                    f"{pill('NO funciona en niños < 2 años', 'red')}.",
                    "Queda desplazada por la llegada de la VNC20."
                ]
            ),
            callout("physio", "<b>Regla de revacunación con VNC20 si el paciente ya tenía puesta la VNC13:</b><br>• Adulto <b>≥ 65 años SANO (sin patología crónica): NO hace falta revacunar con VNC20</b>.<br>• Paciente de <b>ALTO RIESGO</b> (inmunodeprimido, asplenia, fístula LCR, implante coclear): <b>SÍ revacunar con 1 dosis de VNC20</b> (separada ≥ 1 año de la VNC13).")
        )
    )

    # [49] 1792574776776 - Tabla 4 esquinas Paniculitis
    cards[1792574776776] = (
        front_card("🧴 Dermatología", "purple", "🔢 TABLA DE LAS 4 ESQUINAS",
                   "Clasificación Histológica y Clínica de las Paniculitis (Septal vs. Lobulillar / Con vs. Sin Vasculitis)"),
        back_wrapper(
            matrix_2x2(
                "🟢 SIN Vasculitis", "🔴 CON Vasculitis",
                "SEPTAL",
                f"<b>Eritema Nodoso</b> (la + frecuente)<br>• Cara {pill('ANTERIOR', 'green')} de piernas (espinillas).<br>• {pill('NO se ulcera', 'green')} y cura sin cicatriz.<br>• Causas: Idiopático, Estreptococo, <b>Sarcoidosis (Löfgren)</b>, EII, TB.",
                f"<b>Panarteritis Nodosa (PAN) cutánea</b><br>• Nódulos dolorosos que siguen el trayecto arterial, <i>livedo reticularis</i>.<br>• También: <b>Tromboflebitis migratoria</b>.",
                "LOBULILLAR",
                f"<b>Paniculitis Pancreática</b> (pancreatitis / Ca. páncreas)<br>• Lipasas digieren la grasa → necrosis con {pill('«células fantasma»', 'purple')}.<br>• {pill('SÍ se ulcera', 'red')} (suelta líquido oleoso).<br>• También: Lúpica, Déficit α₁-AT.",
                f"<b>Eritema Indurado de Bazin</b><br>• Asociado a {pill('TUBERCULOSIS', 'amber')} (reacción de hipersensibilidad).<br>• Cara {pill('POSTERIOR (pantorrillas)', 'amber')} de mujeres.<br>• {pill('SÍ se ulcera', 'red')} y deja cicatriz atrófica."
            )
        )
    )

    # EXTRA 1: 1781854705695 - Fragilidad Fried vs Rockwood
    cards[1781854705695] = (
        front_card("🩺 Geriatría", "blue", "⚖️ VERSUS",
                   f"Escalas de Fragilidad en el Anciano: {pill('Fenotipo de Fried', 'blue')} vs. {pill('Índice de Rockwood', 'purple')} vs. {pill('FRAIL', 'green')}"),
        back_wrapper(
            steps([
                ("blue", "🏃 1. Fenotipo de Fried (Modelo Físico / Biológico)",
                 f"Evalúa {pill('SOLO fragilidad FÍSICA', 'blue')} mediante 5 criterios objetivos (pérdida de peso, baja energía, lentitud de la marcha, debilidad prensora y baja actividad física). <b>≥ 3 = Frágil</b> (1–2 = Prefrágil)."),
                ("purple", "🧩 2. Índice de Fragilidad de Rockwood (Modelo Multidimensional)",
                 f"Es {pill('MULTIDIMENSIONAL', 'purple')}: cuantifica la acumulación global de déficits incluyendo <b>comorbilidades médicas, deterioro cognitivo, estado psicológico, social y discapacidad funcional</b>."),
                ("green", "📋 3. Escala FRAIL (Cribado rápido)",
                 "Cuestionario autorreferido de 5 preguntas (Fatiga, Resistencia, Deambulación, Enfermedades, Pérdida de peso) sin necesidad de dinamómetro."),
            ]),
            callout("trap", "Si la pregunta dice que el Fenotipo de Fried «es multidimensional e incluye comorbilidades y cognición» → es <b>FALSA</b> (ese es Rockwood; Fried es exclusivamente físico).")
        )
    )

    # EXTRA 2: 1782195517074 - Linfocitos NK CD16 y CD56
    cards[1782195517074] = (
        front_card("🔬 Inmunología", "purple", "🎯 MARCADORES Y FUNCIÓN",
                   "Marcadores de membrana de las células NK (Natural Killer) y cómo median la citotoxicidad por anticuerpos (ADCC)"),
        back_wrapper(
            steps([
                ("purple", "🏷️ Marcadores fenotípicos de superficie de los Linfocitos NK",
                 f"{pill('CD16 +', 'purple')} y {pill('CD56 +', 'purple')} (con {pill('CD3 −', 'red')}, porque no son linfocitos T)."),
                ("blue", "🎯 Función del receptor CD16 (FcγRIII)",
                 f"El <b>CD16</b> se une a la {pill('región Fc de las IgG', 'blue')} que ya están pegadas a una célula infectada o tumoral → ejecuta la {pill('Citotoxicidad Celular Dependiente de Anticuerpos (ADCC)', 'green')}."),
            ]),
            callout("physio", "Recuerda sus dos receptores de vigilancia: <b>KIR (inhibidor)</b> reconoce el MHC-I propio sano para NO matar; si el virus/tumor borra el MHC-I, actúa el receptor <b>KAR (activador)</b> y la célula NK la destruye.")
        )
    )

    # EXTRA 3: 1784014615860 - Blastos 20% Leucemia Aguda vs SMD
    cards[1784014615860] = (
        front_card("🩸 Hematología", "red", "🧭 PUNTOS DE CORTE DE BLASTOS",
                   "Porcentaje de blastos (en Médula Ósea o Sangre Periférica) para diagnosticar Leucemia Aguda vs. Síndrome Mielodisplásico"),
        back_wrapper(
            steps([
                ("red", "🔴 ≥ 20% de Blastos (en Médula Ósea O en Sangre Periférica)",
                 f"Diagnóstico directo de {pill('LEUCEMIA AGUDA', 'red')} (el punto de corte del 20% es idéntico en MO y en SP)."),
                ("amber", "🟡 5% a 19% de Blastos en Médula Ósea (o 2–19% en SP) con citopenias y displasia",
                 f"Diagnóstico de {pill('Síndrome Mielodisplásico con exceso de blastos (SMD-EB)', 'amber')} (antigua Citopenia Refractaria con Exceso de Blastos)."),
                ("green", "🟢 < 5% de Blastos en Médula Ósea (< 1% en SP)",
                 "Recuento normal de blastos (o SMD de bajo riesgo sin exceso de blastos si hay displasia)."),
            ])
        )
    )

    return cards


def checksum(text):
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest()[:8], 16)


def generate_html_preview(cards_dict, output_path):
    items_html = []
    for idx, (nid, (front, back)) in enumerate(cards_dict.items(), 1):
        items_html.append(
            f"<div style='background:#f8fafc;border:1px solid #cbd5e1;border-radius:14px;padding:18px;margin-bottom:22px;'>"
            f"<div style='font-size:12px;color:#64748b;font-weight:700;margin-bottom:8px;'>TARJETA #{idx:02d} · Note ID: {nid}</div>"
            f"{front}"
            f"<hr style='border:0;border-top:1px dashed #cbd5e1;margin:14px 0;'>"
            f"{back}"
            f"</div>"
        )
    html = (
        "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>"
        "<title>Vista Previa · 52 Tarjetas Visuales Simulacro 18 (MIR 2027)</title></head>"
        "<body style='background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;'>"
        "<div style='max-width:740px;margin:0 auto;'>"
        "<h1 style='color:#0f172a;margin-bottom:4px;'>🃏 Tarjetas Visuales MIR 2027 · Simulacro 18</h1>"
        "<p style='color:#475569;margin-top:0;margin-bottom:24px;'>52 tarjetas maquetadas con diseño visual rápido (&lt;2s de lectura): cabeceras por asignatura, tablas Versus a 2 columnas, píldoras de color y cajas de fisiopatología/trampas MIR.</p>"
        + "".join(items_html) +
        "</div></body></html>"
    )
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def apply_to_anki(cards_dict):
    shutil.copy2(ANKI_DB_PATH, "/tmp/collection.anki2.pre_visual_upgrade")
    conn = sqlite3.connect(ANKI_DB_PATH, timeout=5.0)
    conn.create_collation("unicase", lambda a, b: (a.lower() > b.lower()) - (a.lower() < b.lower()))
    cur = conn.cursor()
    now_sec = int(time.time())
    updated = 0
    for nid, (front, back) in cards_dict.items():
        flds = front + "\x1f" + back
        cur.execute(
            "UPDATE notes SET flds = ?, sfld = ?, csum = ?, mod = ?, usn = -1 WHERE id = ?",
            (flds, front, checksum(front), now_sec, nid)
        )
        updated += cur.rowcount
        cur.execute("UPDATE cards SET mod = ?, usn = -1 WHERE nid = ?", (now_sec, nid))
    conn.commit()
    conn.close()
    return updated


def insert_new_visual_cards(cards_list, sim_tag="sim19"):
    """
    Inserta una lista de tuplas (front_html, back_html) como nuevas tarjetas en el mazo MIR 2027.
    Comprueba si Anki está abierto y verifica la integridad de la base de datos al finalizar.
    """
    import random
    if is_anki_running():
        print("⚠️ ADVERTENCIA: /Applications/Anki.app está abierto en ejecución.")
        print("   Para evitar colisiones de bloqueo SQLite o corrupción, se recomienda cerrar Anki.")

    shutil.copy2(ANKI_DB_PATH, f"/tmp/collection.anki2.pre_{sim_tag}")
    conn = sqlite3.connect(ANKI_DB_PATH, timeout=10.0)
    conn.create_collation("unicase", lambda a, b: (a.lower() > b.lower()) - (a.lower() < b.lower()))
    cur = conn.cursor()
    now_sec = int(time.time())
    now_ms = int(time.time() * 1000)
    cur.execute("SELECT max(due) FROM cards WHERE did = ? AND type = 0", (MIR_DECK_ID,))
    max_due = cur.fetchone()[0] or 1000

    for idx, (front, back) in enumerate(cards_list):
        nid = now_ms + idx * 10 + 1
        cid = now_ms + idx * 10 + 2
        guid = f"{sim_tag}_{nid}_{random.randint(1000,9999)}"
        flds = front + "\x1f" + back
        cur.execute("""
            INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
            VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, "")
        """, (nid, guid, BASIC_MODEL_ID, now_sec, f" {sim_tag} ", flds, front, checksum(front)))
        cur.execute("""
            INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
            VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, "{}")
        """, (cid, nid, MIR_DECK_ID, now_sec, max_due + idx + 1))

    conn.commit()
    cur.execute("PRAGMA integrity_check;")
    chk = cur.fetchall()
    if chk != [("ok",)]:
        conn.close()
        raise RuntimeError(f"Error de integridad en SQLite tras inserción: {chk}")

    cur.execute("SELECT count(*) FROM cards WHERE did = ?", (MIR_DECK_ID,))
    total = cur.fetchone()[0]
    conn.close()
    return len(cards_list), total


def insert_cloze_card(text_html, extra_html="", tags="mir2027", sim_tag="cloze", deck_id=MIR_DECK_ID):
    """
    Inserta una tarjeta de tipo Cloze (Oclusión) en el mazo MIR 2027.
    Detecta automáticamente los índices {{c1::}}, {{c2::}}, etc., y crea las tarjetas correspondientes.
    """
    import random, re
    if is_anki_running():
        print("⚠️ ADVERTENCIA: /Applications/Anki.app está abierto.")

    # Detectar todos los índices cN en el texto
    cloze_indices = sorted(list(set(int(x) for x in re.findall(r"\{\{c(\d+)::", text_html))))
    if not cloze_indices:
        raise ValueError("El texto de la tarjeta Cloze no contiene ninguna oclusión con formato {{c1::...}}")

    shutil.copy2(ANKI_DB_PATH, f"/tmp/collection.anki2.pre_{sim_tag}")
    conn = sqlite3.connect(ANKI_DB_PATH, timeout=10.0)
    conn.create_collation("unicase", lambda a, b: (a.lower() > b.lower()) - (a.lower() < b.lower()))
    cur = conn.cursor()

    now_sec = int(time.time())
    now_ms = int(time.time() * 1000)
    cur.execute("SELECT max(due) FROM cards WHERE did = ? AND type = 0", (deck_id,))
    max_due = cur.fetchone()[0] or 1000

    nid = now_ms + random.randint(100, 999)
    guid = f"{sim_tag}_{nid}_{random.randint(1000,9999)}"
    flds = text_html + "\x1f" + extra_html

    # Insertar la nota cloze
    cur.execute("""
        INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
        VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, "")
    """, (nid, guid, CLOZE_MODEL_ID, now_sec, f" {tags} {sim_tag} ", flds, text_html, checksum(text_html)))

    # Insertar una tarjeta (card) para cada índice de cloze (ord = cloze_index - 1)
    cards_created = 0
    for idx_num in cloze_indices:
        ord_val = idx_num - 1
        cid = now_ms + random.randint(1000, 9999) + cards_created
        cur.execute("""
            INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
            VALUES (?, ?, ?, ?, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, "{}")
        """, (cid, nid, deck_id, ord_val, now_sec, max_due + cards_created + 1))
        cards_created += 1

    conn.commit()
    cur.execute("PRAGMA integrity_check;")
    chk = cur.fetchall()
    if chk != [("ok",)]:
        conn.close()
        raise RuntimeError(f"Error de integridad en SQLite tras inserción cloze: {chk}")

    cur.execute("SELECT count(*) FROM cards WHERE did = ?", (deck_id,))
    total = cur.fetchone()[0]
    conn.close()
    return nid, cards_created, total


if __name__ == "__main__":
    cards = get_sim18_visual_cards()
    preview_file = os.path.join(os.path.dirname(__file__), "preview_sim18_cards.html")
    generate_html_preview(cards, preview_file)
    print(f"Generated HTML preview with {len(cards)} visual cards at: {preview_file}")
    if "--apply" in sys.argv:
        n = apply_to_anki(cards)
        print(f"Successfully updated {n} notes in Anki MIR 2027!")
