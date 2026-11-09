#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inyector de Tarjetas Visuales Anki - Simulacro 19 (Mazo MIR 2027)
Tarjetas solicitadas:
1. Q085: Dinteles de cirugía de aorta ascendente (Marfan, Bicúspide, Degenerativo)
2. Q104: Rangos de PIO (Normal, Glaucoma Crónico, Glaucoma Agudo de Ángulo Cerrado)
3. Q138: Panarteritis Nodosa (PAN) completa (Mediano vaso, VHB, HTA, ANCA-, respeta pulmón)
"""

import os
import sys
import time
import json
import shutil
import sqlite3
import hashlib
import random

ANKI_DB_PATH = os.path.expanduser("~/Library/Application Support/Anki2/Usuario 1/collection.anki2")
MIR_DECK_ID = 1780386205296
BASIC_MODEL_ID = 1600653710837

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
    c = PALETTE.get(badge_color, PALETTE["blue"])
    sub = (
        f"<div style='margin-top:8px;font-size:14.5px;color:#475569;font-weight:500;line-height:1.45;'>{subtitle_html}</div>"
        if subtitle_html else ""
    )
    return (
        f"<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;"
        f"text-align:left;max-width:680px;margin:0 auto;padding:14px 18px;border-radius:12px;"
        f"background:#ffffff;border:1.5px solid #e2e8f0;box-shadow:0 2px 6px rgba(15,23,42,0.04);'>"
        f"<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;'>"
        f"<span style='display:inline-block;padding:3px 9px;border-radius:999px;background:{c['pill_bg']};"
        f"color:{c['text']};border:1px solid {c['border']};font-size:11.5px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;'>{subject}</span>"
        f"<span style='font-size:12px;font-weight:700;color:#64748b;letter-spacing:0.3px;'>{kind_label}</span>"
        f"</div>"
        f"<div style='font-size:18px;font-weight:800;color:#0f172a;line-height:1.35;'>{title_html}</div>"
        f"{sub}"
        f"</div>"
    )

def back_wrapper(*blocks):
    inner = "".join(blocks)
    return (
        f"<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;"
        f"text-align:left;max-width:680px;margin:10px auto 0 auto;padding:14px 18px;border-radius:12px;"
        f"background:#ffffff;border:1.5px solid #e2e8f0;box-shadow:0 2px 6px rgba(15,23,42,0.04);'>"
        f"{inner}"
        f"</div>"
    )

def steps(step_list):
    html = ["<div style='display:flex;flex-direction:column;gap:8px;'>"]
    for color, title, body in step_list:
        c = PALETTE.get(color, PALETTE["blue"])
        html.append(
            f"<div style='padding:10px 12px;border-radius:8px;background:{c['bg']};border-left:4px solid {c['text']};border:1px solid {c['border']};border-left-width:4px;'>"
            f"<div style='font-size:13.5px;font-weight:800;color:{c['text']};margin-bottom:4px;'>{title}</div>"
            f"<div style='font-size:13.5px;color:#1e293b;line-height:1.45;'>{body}</div>"
            f"</div>"
        )
    html.append("</div>")
    return "".join(html)

def versus(col1_title, col1_color, col1_bullets, col2_title, col2_color, col2_bullets):
    c1 = PALETTE.get(col1_color, PALETTE["blue"])
    c2 = PALETTE.get(col2_color, PALETTE["amber"])
    
    b1_html = "".join([f"<li style='margin-bottom:5px;'>{b}</li>" for b in col1_bullets])
    b2_html = "".join([f"<li style='margin-bottom:5px;'>{b}</li>" for b in col2_bullets])

    return (
        f"<div style='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px;'>"
        f"<div style='padding:10px 12px;border-radius:8px;background:{c1['bg']};border:1px solid {c1['border']};'>"
        f"<div style='font-size:13.5px;font-weight:800;color:{c1['text']};margin-bottom:6px;'>{col1_title}</div>"
        f"<ul style='margin:0;padding-left:16px;font-size:13px;color:#1e293b;line-height:1.4;'>{b1_html}</ul>"
        f"</div>"
        f"<div style='padding:10px 12px;border-radius:8px;background:{c2['bg']};border:1px solid {c2['border']};'>"
        f"<div style='font-size:13.5px;font-weight:800;color:{c2['text']};margin-bottom:6px;'>{col2_title}</div>"
        f"<ul style='margin:0;padding-left:16px;font-size:13px;color:#1e293b;line-height:1.4;'>{b2_html}</ul>"
        f"</div>"
        f"</div>"
    )

def callout(kind, text_html):
    if kind == "trap":
        c = PALETTE["red"]
        header = "⚠️ TRAMPA MIR / ERROR FRECUENTE"
    else:
        c = PALETTE["teal"]
        header = "💡 REGLA DE ORO / FISIOPATOLOGÍA"
    return (
        f"<div style='margin-top:10px;padding:9px 12px;border-radius:8px;background:{c['bg']};border:1px solid {c['border']};'>"
        f"<div style='font-size:11.5px;font-weight:800;color:{c['text']};text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;'>{header}</div>"
        f"<div style='font-size:13px;color:#1e293b;line-height:1.4;'>{text_html}</div>"
        f"</div>"
    )

def checksum(text):
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest()[:8], 16)

def build_new_cards():
    cards = []

    # CARD 1: Q085 - Dinteles Quirúrgicos Aorta Ascendente (Marfan, Bicúspide, General)
    c1_front = front_card(
        "❤️ Cardiología · Cirugía Cardíaca", "red", "🧭 DINTELES QUIRÚRGICOS",
        "Aneurisma de Aorta Ascendente: ¿A qué diámetro operar?",
        f"Diferencia entre {pill('Población General', 'slate')}, {pill('Marfan sin FR', 'amber')} y {pill('Marfan con Factores de Riesgo', 'red')}"
    )
    c1_back = back_wrapper(
        steps([
            ("slate", "1️⃣ ≥ 55 mm → Dintel General",
             f"{pill('Aneurisma degenerativo', 'slate')} (población general) o {pill('Válvula Bicúspide SIN factores de riesgo', 'blue')}."),
            ("amber", "2️⃣ ≥ 50 mm → Dintel en Tejido Conectivo sin FR / Bicúspide con FR",
             f"• {pill('Síndrome de Marfan SIN factores de riesgo', 'amber')}.<br>"
             f"• {pill('Válvula Aórtica Bicúspide CON factores de riesgo', 'amber')} (HTA, coartación, AF de disección, crecimiento >3 mm/año)."),
            ("red", "3️⃣ ≥ 45 mm → Marfan de Alto Riesgo",
             f"• {pill('Síndrome de Marfan CON factores de riesgo', 'red')}: Antecedente familiar de <b>muerte súbita o disección</b>, crecimiento <b>> 3 mm/año</b>, <b>insuficiencia aórtica grave</b> o deseo gestacional.<br>"
             f"• <i>(En Síndrome de Loeys-Dietz el dintel baja incluso a ≥ 42–45 mm por gran fragilidad)</i>."),
        ]),
        callout("trap", "En el caso del MIR: varón de 35 años con Marfan, <b>51 mm de aorta + hermano fallecido de muerte súbita</b> → ¡Se interviene ya! (supera tanto los 45 como los 50 mm).")
    )
    cards.append((c1_front, c1_back))

    # CARD 2: Q104 - Rangos de Presión Intraocular (PIO)
    c2_front = front_card(
        "👁️ Oftalmología · Glaucoma", "teal", "🔢 NIVELES DE PRESIÓN INTRAOCULAR",
        "Rangos de PIO (mmHg): Normal vs. Glaucoma Crónico vs. Glaucoma Agudo",
        f"¿Por qué el dolor trigeminal, halos y ojo pétreo en {pill('Glaucoma Agudo', 'red')}?"
    )
    c2_back = back_wrapper(
        steps([
            ("green", "🟢 10 – 21 mmHg → PIO NORMAL",
             f"Presión fisiológica normal del globo ocular. {pill('18 mmHg es un ojo sano', 'green')}."),
            ("amber", "🟡 22 – 30 mmHg → Glaucoma Crónico Simple (Ángulo Abierto)",
             f"Subida de presión <b>lenta e insidiosa</b> a lo largo de años. Asintomático (sin dolor, sin ojo rojo, sin edema corneal). Causa daño progresivo indoloro del nervio óptico y pérdida de campo visual periférico."),
            ("red", "🔴 > 45 – 55 mmHg (hasta 60–70) → Glaucoma Agudo de Ángulo Cerrado",
             f"Bloqueo pupilar brusco a oscuras en ojo predispuesto (hipermétrope/ojo corto). La presión <b>se triplica de golpe</b>: deja el globo <b>«duro como una piedra»</b>, introduce líquido en el estroma corneal ({pill('edema corneal = halos de colores', 'red')}) y causa dolor trigeminal brutal con náuseas y vómitos."),
        ]),
        callout("physio", "El edema corneal y los halos de colores solo aparecen cuando la PIO supera los <b>40–45 mmHg</b>; por debajo de esa cifra la bomba endotelial mantiene la córnea transparente.")
    )
    cards.append((c2_front, c2_back))

    # CARD 3: Q138 - Panarteritis Nodosa (PAN)
    c3_front = front_card(
        "🫀 Reumatología · Vasculitis", "purple", "🚨 PERFIL COMPLETO MIR",
        "Panarteritis Nodosa (PAN): ¿Cuál es su perfil clínico patognomónico?",
        f"Vasculitis de {pill('Mediano Vaso', 'purple')} · {pill('ANCA NEGATIVA', 'red')} · {pill('Respeta Pulmón', 'green')}"
    )
    c3_back = back_wrapper(
        steps([
            ("purple", "🫀 1. Tipo de vaso y Asociación Viral",
             f"Vasculitis necrotizante de {pill('MEDIANO y PEQUEÑO vaso', 'purple')}. Clásicamente asociada a {pill('Virus de la Hepatitis B (VHB)', 'amber')} (y en menor medida VHC)."),
            ("blue", "🩸 2. Afectación Renal y Digestiva (Microaneurismas)",
             f"• <b>Riñón:</b> Isquemia renal y {pill('microaneurismas arteriales', 'blue')} visibles en arteriografía → cursa con {pill('HTA VASCULORRENAL', 'red')} e insuficiencia renal, pero <b>SIN glomerulonefritis</b> (no da síndrome nefrítico ni hematuria glomerular).<br>"
             f"• <b>Digestivo:</b> Dolor abdominal posprandial ({pill('angina mesentérica', 'blue')}), riesgo de infarto o perforación intestinal."),
            ("amber", "⚡ 3. Sistema Nervioso y Piel",
             f"• <b>Neurología:</b> {pill('Mononeuritis múltiple', 'amber')} (pie o mano caída asimétrica en el 60–70% de los casos).<br>"
             f"• <b>Piel:</b> Nódulos subcutáneos inflamatorios dolorosos y {pill('Livedo reticularis', 'amber')}."),
            ("red", "❌ 4. Dos Reglas Negativas de Oro (¡Para el MIR!)",
             f"1) <b>{pill('ANCA NEGATIVA (100%)', 'red')}</b> (los ANCA positivos pertenecen a las vasculitis de pequeño vaso: Wegener, Churg-Strauss y PAM).<br>"
             f"2) <b>{pill('RESPETA EL PULMÓN', 'green')}</b> (nunca produce hemorragia alveolar ni infiltrados pulmonares; si hay pulmón es PAM o Wegener)."),
        ]),
        callout("trap", "Varón con HTA de difícil control + dolor abdominal + pie caído + VHB positivo + ANCA negativo → Diagnóstico directo: <b>Panarteritis Nodosa (PAN)</b>. Tratamiento: Corticoides + Ciclofosfamida (y antiviral si VHB activo).")
    )
    cards.append((c3_front, c3_back))

    # CARD 4: Q175 - Inducción de Tolerancia Oral (ITO) a alimentos
    c4_front = front_card(
        "🌾 Alergología · Pediatría", "amber", "🎯 INDICACIONES Y EDAD",
        "Inducción de Tolerancia Oral (ITO) a alimentos (leche/huevo): ¿Cuándo y por qué?",
        f"¿A qué edad se inicia y por qué {pill('NO se hace en < 4 años', 'red')}?"
    )
    c4_back = back_wrapper(
        steps([
            ("red", "1️⃣ Edad de inicio: A partir de los 4–5 años (¡NUNCA antes!)",
             f"La inmensa mayoría de las alergias alimentarias IgE-mediadas del lactante (leche de vaca y huevo) {pill('se curan solas entre los 2 y 4 años', 'green')}. No tiene sentido asumir el riesgo de una desensibilización hospitalaria si va a resolver espontáneamente. Se indica cuando la alergia {pill('persiste a partir de los 4–5 años', 'red')} (o antes en adultos/adolescentes)."),
            ("blue", "2️⃣ ¿En quién está indicada? Alergia persistente y/o Reacciones Graves",
             f"Especialmente en niños con {pill('anafilaxia o reacciones graves', 'blue')} ante trazas mínimas, con el objetivo prioritario de <b>elevar el umbral de tolerancia</b> para evitar un shock mortal por ingesta accidental."),
            ("amber", "3️⃣ Mantenimiento: Ingesta regular e ininterrumpida",
             f"La tolerancia lograda es un estado de <i>desensibilización activa</i>: exige {pill('tomar el alimento a diario sin descansos prolongados', 'amber')}. Si el paciente deja de tomarlo durante semanas, se pierde la tolerancia y vuelve a haber riesgo de reacción."),
        ]),
        callout("trap", "<b>¡Pregunta clásica MIR!</b> Es totalmente <b>FALSO</b> que la ITO «solo esté indicada en menores de 4 años». La regla es la contraria: se plantea a partir de los 4–5 años porque antes la probabilidad de resolución espontánea es máxima.")
    )
    # CARD 5: Q178 - Síndrome IPEX (FOXP3)
    c5_front = front_card(
        "🧬 Inmunología · Pediatría", "purple", "🚨 INMUNODEFICIENCIA POR DISREGULACIÓN",
        "Síndrome IPEX: Gen, Fisiopatología y Tríada Clásica",
        f"¿Qué significan las siglas {pill('IPEX', 'purple')}, qué gen muta y cuál es la tríada clínica?"
    )
    c5_back = back_wrapper(
        steps([
            ("purple", "🔤 1. Nombre completo y Siglas IPEX",
             f"<b>Síndrome IPEX:</b><br>"
             f"• <b>I</b>mmunodysregulation<br>"
             f"• <b>P</b>olyendocrinopathy<br>"
             f"• <b>E</b>nteropathy<br>"
             f"• <b>X</b>-linked ({pill('Ligado al cromosoma X', 'red')} → afecta a <b>varones en primeros meses de vida</b>)."),
            ("red", "🧬 2. Gen Causal y Fisiopatología",
             f"Mutación en el gen {pill('FOXP3', 'red')} (imprescindible para el desarrollo de {pill('Linfocitos T Reguladores (Treg) CD4+ CD25+', 'red')}).<br>"
             f"Fisiopatología: pérdida de la {pill('tolerancia inmunológica PERIFÉRICA', 'red')} (no hay freno supresor a los linfocitos autorreactivos)."),
            ("blue", "👶 3. Tríada Clínica en el Lactante Varón",
             f"1️⃣ {pill('Enteropatía autoinmune grave', 'amber')}: Diarrea intratable muy precoz con malabsorción y fallo de medro.<br>"
             f"2️⃣ {pill('Diabetes Mellitus neonatal / tipo 1', 'blue')}: Debut diabético en las primeras semanas/meses de vida.<br>"
             f"3️⃣ {pill('Dermatitis grave / Eccema', 'purple')}: Dermatitis eccematosa generalizada o eritrodermia (± tiroiditis autoinmune)."),
        ]),
        callout("trap", "<b>¡EL DÚO INSEPARABLE DEL MIR!</b><br>"
                       "• <b>APECED (SPA-1):</b> Gen <b>AIRE</b> (tolerancia <b>CENTRAL</b> tímica) → <i>Candidiasis + HipoPTH + Addison</i>.<br>"
                       "• <b>IPEX:</b> Gen <b>FOXP3</b> ligado al X (tolerancia <b>PERIFÉRICA / Treg</b>) → <i>Enteropatía + DM neonatal + Eccema</i>.")
    )
    cards.append((c5_front, c5_back))

    # CARD 6: Q189 - Síndrome Metabólico (ATP-III)
    c6_front = front_card(
        "🍔 Endocrinología y Nutrición", "teal", "🎯 CRITERIOS DIAGNÓSTICOS (ATP-III)",
        "Síndrome Metabólico: Los 5 Criterios de Definición",
        f"Diagnóstico con {pill('≥ 3 de 5', 'teal')}. ¿Cuáles son los puntos de corte y qué lípido {pill('NO cuenta', 'red')}?"
    )
    c6_back = back_wrapper(
        steps([
            ("slate", "📏 1. Obesidad Central (Perímetro Abdominal)",
             f"• Varones: {pill('> 102 cm', 'blue')}<br>"
             f"• Mujeres: {pill('> 88 cm', 'purple')}<br>"
             f"<i>(Refleja el acúmulo de grasa visceral / resistencia a la insulina).</i>"),
            ("amber", "🥩 2. Triglicéridos (TG) Elevados",
             f"{pill('≥ 150 mg/dL', 'amber')} (o tratamiento farmacológico específico para hipertrigliceridemia)."),
            ("blue", "🛡️ 3. Colesterol HDL («el bueno») Disminuido",
             f"• Varones: {pill('< 40 mg/dL', 'blue')}<br>"
             f"• Mujeres: {pill('< 50 mg/dL', 'purple')}<br>"
             f"<i>(Dislipemia aterogénica típica: TG altos + HDL bajo).</i>"),
            ("red", "🩺 4. Presión Arterial Elevada",
             f"{pill('≥ 130 / 85 mmHg', 'red')} (o paciente ya diagnosticado en tratamiento antihipertensivo)."),
            ("green", "🩸 5. Glucemia Basal en Ayunas Alterada",
             f"{pill('≥ 100 mg/dL', 'green')} (o diagnóstico previo de Diabetes Mellitus tipo 2 en tratamiento)."),
        ]),
        callout("trap", "<b>¡2 TRAMPAS CLÁSICAS DE EXAMEN!</b><br>"
                       "1) <b>El Colesterol LDL NO es criterio</b> de Síndrome Metabólico (aunque las LDL sean densas y aterogénicas, su cifra aislada no puntúa; puntúan <b>TG y HDL</b>).<br>"
                       "2) <b>El IMC por sí solo NO es criterio directo</b>: el criterio oficial es el <b>perímetro de cintura</b> (grasa abdominal). Diagnóstico con <b>≥ 3 de los 5</b>.")
    )
    cards.append((c6_front, c6_back))

    # CARD 7: Q014 - Manejo de la Angina de Esfuerzo (Síndrome Coronario Crónico)
    c7_front = front_card(
        "❤️ Cardiología · Cardiopatía Isquémica", "red", "🧭 MANEJO INTEGRAL Y ALGORITMO",
        "Angina de Esfuerzo (Síndrome Coronario Crónico): Manejo Completo",
        f"¿Qué fármacos {pill('mejoran pronóstico', 'red')}, cuáles son {pill('antianginosos sintomáticos', 'blue')} y cuándo {pill('Bypass vs Stent', 'amber')}?"
    )
    c7_back = back_wrapper(
        steps([
            ("red", "🛡️ 1. Fármacos que MEJORAN PRONÓSTICO (Supervivencia) en TODOS",
             f"• {pill('AAS 100 mg/día', 'red')} indefinido (o Clopidogrel 75 mg si alergia/intolerancia).<br>"
             f"• {pill('Estatinas de alta potencia', 'red')} (Atorvastatina 40–80 o Rosuvastatina 20–40 mg) con objetivo de <b>c-LDL < 55 mg/dL</b> y reducción ≥ 50%.<br>"
             f"• {pill('IECA / ARA-II', 'amber')}: Indicados si asocia <b>FEVI < 40%, HTA, Diabetes Mellitus o ERC</b>."),
            ("blue", "💊 2. Fármacos ANTIANGINOSOS (Control de Síntomas / Calidad de vida)",
             f"• <b>1.ª Línea:</b> {pill('Betabloqueantes', 'blue')} (reducen FC e inotropismo; mejoran supervivencia si hay FEVI baja o IAM previo) y/o {pill('Calcioantagonistas', 'blue')} (dihidropiridinas como Amlodipino, o Verapamilo/Diltiazem si FEVI conservada).<br>"
             f"• <b>Crisis aguda:</b> Nitroglicerina sublingual a demanda.<br>"
             f"• <b>2.ª Línea:</b> Ivabradina (si ritmo sinusal y FC ≥ 70 lpm), Ranolazina, Nitratos de acción prolongada o Nicorandil."),
            ("amber", "🫀 3. ¿Cuándo Revascularizar (Cateterismo) y técnica de elección?",
             f"<b>Indicaciones Pronósticas:</b><br>"
             f"1) Lesión de {pill('Tronco Coronario Izquierdo (>50%)', 'red')} o {pill('Descendente Anterior proximal', 'red')}.<br>"
             f"2) Enfermedad de {pill('3 vasos', 'amber')} (especialmente con FEVI deprimida o diabetes).<br>"
             f"3) Isquemia miocárdica extensa demostrada en pruebas no invasivas (> 10% del ventrículo).<br>"
             f"• <b>Bypass (CABG) de elección</b>: En {pill('Diabéticos con 3 vasos / multivaso', 'purple')} (con arteria mamaria interna).<br>"
             f"• <b>Stent (ACTP) de elección</b>: En enfermedad de 1–2 vasos no proximales o riesgo quirúrgico elevado."),
        ]),
        callout("trap", "<b>¡2 REGLAS DE ORO DEL MIR!</b><br>"
                       "1) <b>Los Nitratos NO salvan vidas</b> ni reducen mortalidad en angina crónica: son vasodilatadores exclusivamente sintomáticos.<br>"
                       "2) En angina estable sin criterios anatómicos de alto riesgo, <b>poner un STENT NO reduce la mortalidad ni evita infartos</b> comparado con el tratamiento médico óptimo (ensayos COURAGE / ISCHEMIA); el stent se usa para aliviar síntomas refractarios.")
    )
    cards.append((c7_front, c7_back))

    # CARD 8: Q041 - Hipotiroidismo Congénito: Sospecha y Urgencia Terapéutica
    c8_front = front_card(
        "👶 Pediatría · Endocrinología", "teal", "🚨 URGENCIA NEUROLÓGICA",
        "Hipotiroidismo Congénito: Sospecha Clínica y Actitud Inmediata",
        f"¿Cuáles son los signos cardinales y por qué {pill('NO se esperan pruebas de imagen', 'red')}?"
    )
    c8_back = back_wrapper(
        steps([
            ("teal", "👶 1. Clínica Típica en el Lactante",
             f"• {pill('Ictericia prolongada', 'amber')} + letargia («bebé excesivamente tranquilo») + hipotonía.<br>"
             f"• {pill('Hernia umbilical', 'amber')} + estreñimiento + macroglosia.<br>"
             f"• {pill('Fontanela posterior amplia (> 0,5 cm)', 'teal')} al nacimiento."),
            ("red", "🚨 2. Actitud Inmediata (¡Urgencia Terapéutica!)",
             f"• <b>Iniciar LEVOTIROXINA oral de inmediato</b> (tras extraer muestra para TSH/T4L).<br>"
             f"• <b>NUNCA demorar el tratamiento</b> esperando a ecografía o gammagrafía tiroidea: cada día de retraso en el primer mes de vida produce {pill('daño cerebral / retraso mental irreversible (cretinismo)', 'red')}."),
        ]),
        callout("trap", "¡Pregunta clásica MIR! Es falso esperar a confirmar la etiología (ectopia/agenesia) por imagen antes de tratar. Primero se inicia la <b>Levotiroxina</b> para proteger el cerebro; la imagen se hace después.")
    )
    cards.append((c8_front, c8_back))

    return cards

def inject():
    new_cards = build_new_cards()
    shutil.copy2(ANKI_DB_PATH, f"/tmp/collection.anki2.pre_s19_cards")
    conn = sqlite3.connect(ANKI_DB_PATH, timeout=10.0)
    conn.create_collation("unicase", lambda a, b: (a.lower() > b.lower()) - (a.lower() < b.lower()))
    cur = conn.cursor()
    now_sec = int(time.time())
    now_ms = int(time.time() * 1000)
    
    cur.execute("SELECT max(due) FROM cards WHERE did = ? AND type = 0", (MIR_DECK_ID,))
    row = cur.fetchone()
    max_due = row[0] if row and row[0] else 1000

    inserted_nids = []
    for idx, (front, back) in enumerate(new_cards):
        nid = now_ms + idx * 10 + 1
        cid = now_ms + idx * 10 + 2
        guid = f"s19_{nid}_{random.randint(1000,9999)}"
        flds = front + "\x1f" + back
        cur.execute("""
            INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
            VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, "")
        """, (nid, guid, BASIC_MODEL_ID, now_sec, " sim19 mir2027 ", flds, front, checksum(front)))
        cur.execute("""
            INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
            VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, "{}")
        """, (cid, nid, MIR_DECK_ID, now_sec, max_due + idx + 1))
        inserted_nids.append(nid)

    conn.commit()
    cur.execute("SELECT count(*) FROM cards WHERE did = ?", (MIR_DECK_ID,))
    total = cur.fetchone()[0]
    conn.close()
    print(f"✅ ¡{len(new_cards)} tarjetas visuales insertadas con éxito en el mazo MIR 2027! Total en mazo: {total}")
    return inserted_nids

if __name__ == "__main__":
    inject()
