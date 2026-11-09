with open('/Users/hola/.gemini/antigravity/brain/9a114fd9-340f-4086-8b4f-8109903e4aa1/guia_correccion_simulacro_19.md') as f:
    text = f.read()

# Insert Q160 after Q142 (before Q163)
q160_block = """### 16. `Q160` · Neumología (41.7% pob) — *Linfangioleiomiomatosis (LAM): Patrón Obstructivo (Piden la FALSA)* [🎯 `Sin descartes`]
* **Enunciado completo:** ¿Cuál de las siguientes afirmaciones es **FALSA** en relación con la **linfangioleiomiomatosis (LAM)**?
* ❌ **Marcaste (4):** *En ocasiones requiere de trasplante pulmonar, pudiendo recidivar la enfermedad en el injerto.* (12.2% pob).
* ✅ **Correcta (2 - La FALSA):** ***Puede producir un defecto ventilatorio obstructivo y restrictivo, siendo más frecuente el segundo.***.
* **🎯 Por qué fallaste / Concepto clave:** ¡Paradoja espirométrica clásica del MIR! Aunque la LAM es una enfermedad intersticial (quistes aéreos en mujeres fértiles), la proliferación de células musculares lisas atípicas comprime y destruye las vías aéreas pequeñas, produciendo característicamente un patrón ventilatorio **OBSTRUCTIVO** con hiperinsuflación y atrapamiento aéreo (no restrictivo). La opción 4 que marcaste es verdadera: la LAM puede requerir trasplante bipulmonar y tiene riesgo documentado de recidiva en el injerto.
* **🃏 Anki:** Linfangioleiomiomatosis (LAM): Enfermedad quística pulmonar en mujeres fértiles / Esclerosis Tuberosa. Cursa con patrón **OBSTRUCTIVO** (hiperinsuflación) y quilotórax. Tto: **Sirolimus** (inhibidor de mTOR).

"""

# Insert Q171 after Q169 (before Q176)
q171_block = """### 19. `Q171` · Hematología (41.9% pob) — *Coagulación Intravascular Diseminada (CID) en Sepsis: Tratar la Causa* [✂️ `Con descartes`]
* **Enunciado completo:** Un **varón de 65 años** está ingresado por **colangitis litiásica** en la planta de Digestivo. El paciente desarrolla **taquicardia, hipotensión y fiebre**. Se recogen hemocultivos que son **positivos para E. coli**. La analítica muestra Hb 11,5 g/dL, Leucocitos 13,5 x 10^9/L y **plaquetas 40.000/mm^3**. El estudio de coagulación muestra un **INR 2, un TTPa 40 segundos (normal < 28 s), D-dímero elevado y fibrinógeno 2,8 g/L**. El paciente no tiene signos de sangrado. En relación con la patología que sospecha, ¿cuál de las siguientes afirmaciones es **CIERTA**?
* ❌ **Marcaste (1):** *Se debe iniciar HBPM a dosis profilácticas.* (19.4% pob).
* ✅ **Correcta (4):** ***El mejor tratamiento en el momento actual es la terapia antibiótica dirigida a la bacteria.***.
* **🎯 Por qué fallaste / Concepto clave:** El paciente presenta una **Coagulación Intravascular Diseminada (CID)** aguda desencadenada por shock séptico biliar por *E. coli* (trombopenia, alargamiento de TP/INR y TTPa, D-dímero elevado). Regla de ORO en la CID: **el único tratamiento que cura la CID es tratar agresivamente la causa desencadenante** (aquí: antibioterapia dirigida + drenaje biliar). Si el paciente NO tiene hemorragia activa, no se transfundirá plasma ni plaquetas profilácticas, ni se anticoagula de forma agresiva en shock séptico.
* **🃏 Anki:** Tratamiento de la **Coagulación Intravascular Diseminada (CID)**: El pilar primordial es **tratar la causa subyacente** (infección/sepsis, neoplasia, obstetricia). Los hemoderivados (plaquetas, plasma fresco) SOLO se administran si hay **sangrado activo** o procedimiento invasivo inminente.

"""

text = text.replace('### 17. `Q163`', q160_block + '### 17. `Q163`')
text = text.replace('### 20. `Q176`', q171_block + '### 20. `Q176`')

with open('/Users/hola/.gemini/antigravity/brain/9a114fd9-340f-4086-8b4f-8109903e4aa1/guia_correccion_simulacro_19.md', 'w') as f:
    f.write(text)

print("Inserted Q160 and Q171 successfully into Bloque 3!")
