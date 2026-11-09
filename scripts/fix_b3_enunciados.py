import json, re

with open('/tmp/s19_audit.json') as f:
    audit = {q['numero']: q for q in json.load(f)}

with open('/Users/hola/.gemini/antigravity/brain/9a114fd9-340f-4086-8b4f-8109903e4aa1/guia_correccion_simulacro_19.md') as f:
    text = f.read()

enuns_b3 = {
    3: "La imagen vinculada pertenece al **fondo de ojo** de una paciente. ¿Cuál de las siguientes afirmaciones es **CORRECTA**?",
    4: "Le avisa el neurocirujano de guardia por un hallazgo de una **fractura de peñascos** en un paciente que ha sufrido un accidente de tráfico. La **otoscopia** se muestra en la imagen vinculada. Es **FALSO** que:",
    10: "**Mujer de 32 años** que acude a consulta refiriendo **dolor, crujidos y limitación del movimiento en el brazo izquierdo**. Hace más de un año sufrió un grave accidente de tráfico, mientras viajaba de acompañante en una motocicleta, que le acarreó múltiples lesiones y un ingreso prolongado en la unidad de cuidados intensivos de su hospital. En el **húmero proximal izquierdo sufrió una fractura compleja, multifragmentaria**, que se intervino mediante una **placa de osteosíntesis**. En vista de la imagen radiográfica aportada (imagen vinculada), señale la afirmación **CORRECTA**:",
    18: "Paciente **varón de 57 años**, hipertenso, dislipémico y diabético tipo II que acude al urólogo por una **masa escrotal izquierda**. El urólogo considera necesaria la realización de una **ecografía testicular** (imagen vinculada). ¿Cuál es el diagnóstico **MÁS probable**?",
    25: "En una placa de agar sangre se siembran unos **cocos de color morado en la tinción de Gram que se agrupan en cadenas**. Al cabo de 24 horas la placa de cultivo presenta el aspecto que se muestra en la imagen vinculada. ¿Cuál de los siguientes es el microorganismo **MÁS probable**?",
    31: "En un **estudio fármaco-económico** que comparó dos fármacos antibióticos para el tratamiento de la neumonía fueron incluidos los **costes de la medicación, de las pruebas complementarias y analíticas, de hospitalización, de los efectos adversos de la medicación, del transporte al hospital y de la pérdida de productividad de los pacientes**. ¿Cuál fue la **perspectiva del estudio**?",
    56: "**Mujer soltera de 34 años** que acude a consulta de reproducción asistida por **deseo de maternidad en solitario**. Es una mujer con normopeso, no consume tóxicos, eumenorreica y como antecedente médico-quirúrgico de interés es que toma sumatriptán de manera ocasional y a demanda por episodios de migraña sin aura. En la anamnesis dirigida refiere positividad para VPH de alto riesgo controlado en la unidad de patología vulvocervical, con citología y colposcopia recientes normales. **También refiere un episodio febril y dolor abdominal agudo hace unos años por el que tuvo que acudir a Urgencias y que refiere haber sido manejado por Ginecología con tratamiento antibiótico ambulatorio durante 14 días** sin mayores complicaciones. En la ecografía presenta un útero en AVF de contornos e histerometría regular, endometrio de 6 mm TL concordante con la fase del ciclo, ambos ovarios de tamaño y ecoestructura normal con un folículo dominante de 15 mm en ovario derecho y un RFA de 7 + 6. Realizó una determinación de AMH hace un año en una revisión ginecológica con un resultado de 1,9 ng/mL. Señale la opción **CORRECTA**:",
    65: "Los fármacos **análogos del péptido similar al glucagón (GLP-1)**, como la liraglutida o la semaglutida, han demostrado ser útiles en el manejo de la obesidad. Sobre estos fármacos, ¿cuál de las siguientes afirmaciones es **FALSA**?",
    81: "¿Cuál de los siguientes hallazgos en una resonancia magnética es **MÁS indicativo de una avulsión preganglionar del plexo braquial**?",
    100: "**Varón de 75 años** con ingresos previos para la realización de bypass femorofemoral por isquemia de miembros inferiores y descompensación de enfermedad renal crónica. Acude a Urgencias por **dolor abdominal súbito desproporcionado a la exploración**. En la analítica destacan la presencia de **leucocitosis, hiperlactacidemia y una creatinina de 3**. ¿Cuál considera que es la **medida MÁS adecuada** en el momento actual?",
    102: "**Varón de 26 años** que acude a su consulta por **sensación de taponamiento del oído derecho e hipoacusia derecha fluctuante** desde hace varios meses. El paciente no refiere otorrea ni otalgia asociada. La exploración otoscópica es normal en ambos oídos. En la audiometría tonal se objetiva una **hipoacusia transmisiva leve en frecuencias graves, la impedanciometría es normal**. Sin embargo, sí que nos comenta que ha dejado de ir al gimnasio porque últimamente presentaba **episodios de giro de objetos al levantar pesas**. Respecto al diagnóstico que sospecha, señale la afirmación **CORRECTA**:",
    103: "Acude a su consulta un **paciente de 57 años, fumador y bebedor, por disfonía y disfagia de dos meses de evolución** que no mejora a pesar del tratamiento pautado por su médico de Atención Primaria. En la exploración fibrolaringoscópica se aprecia una **lesión ulcerada que afecta a la banda ventricular izquierda y pie de epiglotis, con disminución de la movilidad de la cuerda vocal derecha**. En la palpación cervical palpa una **adenopatía de unos 4 cm en el área II de consistencia dura y adherido a planos profundos**. Se realiza una TC de cuello con contraste donde se confirma la presencia de una masa infiltrante que afecta a la banda ventricular izquierda y epiglotis, sin afectar al cartílago tiroides, así como un conglomerado adenopático de 5 cm en el área II izquierda. Se realiza una microcirugía endolaríngea con resultado de **carcinoma epidermoide de laringe** moderadamente diferenciado. Señale el diagnóstico y tratamiento **MÁS adecuado**:",
    117: "**Varón de 55 años** con antecedente de **consumo de drogas por vía parenteral** que acude a consulta por cuadro de **distensión abdominal progresivo**. A la exploración física, además de edemas e ingurgitación yugular, destaca un **soplo sistólico en borde esternal izquierdo que aumenta con la inspiración profunda (signo de Rivero-Carvallo)** y unas **ondas V prominentes** en el pulso venoso yugular. Con respecto al diagnóstico de sospecha señale el tratamiento **MÁS adecuado**:",
    120: "**Varón de 66 años**, con historia de **hipertensión y fibrilación auricular paroxística**, con corazón estructuralmente normal a excepción de una insuficiencia mitral ligera-moderada con ligera dilatación auricular izquierda. **Lleva un año sin episodios de FA**. ¿Cuál es la actitud **MÁS apropiada**?",
    142: "De entre las siguientes relaciones entre **filariasis y su cuadro más frecuente**, señale la **FALSA**:",
    160: "¿Cuál de las siguientes afirmaciones es **FALSA** en relación con la **linfangioleiomiomatosis (LAM)**?",
    163: "**Varón de 65 años** acude a su consulta aquejando múltiples síntomas. Le han visto ya varios neurólogos y trae un montón de informes médicos con pruebas complementarias. Está tomando **levodopa/carbidopa** 100/25 g cuatro veces al día, **pramiprexol** 0,26 mg/día y un complemento alimenticio para paliar el estreñimiento. Aqueja **dolor en extremidades, mareo ortostático, rigidez al utilizar las extremidades, caídas en número de tres al mes aproximadamente (algunas sincopales), pesadillas muy vívidas y estreñimiento pertinaz**. La enfermedad comenzó hace unos cinco años. En otro centro, le han realizado una **gammagrafía cardíaca con metayodobenzilguanidina (123I-MIBG)**. En relación con esta prueba, ¿en qué enfermedad está **disminuida**?",
    169: "Paciente que presenta **debilidad muscular fluctuante que empeora a lo largo del día y mejora con el descanso, además de ptosis y diplopía**. Se sospecha una posible miastenia gravis. ¿Qué prueba diagnóstica puede ayudar a **confirmar el diagnóstico y descartar el síndrome de Lambert-Eaton**?",
    171: "Un **varón de 65 años** está ingresado por **colangitis litiásica** en la planta de Digestivo. El paciente desarrolla **taquicardia, hipotensión y fiebre**. Se recogen hemocultivos que son **positivos para E. coli**. La analítica muestra Hb 11,5 g/dL, Leucocitos 13,5 x 10^9/L y **plaquetas 40.000/mm^3**. El estudio de coagulación muestra un **INR 2, un TTPa 40 segundos (normal < 28 s), D-dímero elevado y fibrinógeno 2,8 g/L**. El paciente no tiene signos de sangrado. En relación con la patología que sospecha, ¿cuál de las siguientes afirmaciones es **CIERTA**?",
    176: "Algunas enfermedades inmunomediadas comparten mediadores implicados en la enfermedad. En las **enfermedades con inflamación tipo 2**, ¿cuál de los siguientes es una posible **diana terapéutica y cuál es su fármaco adecuado**?",
    203: "Señale la respuesta **CORRECTA** sobre los **aneurismas arteriales periféricos**:",
    208: "**Varón de 62 años** remitido por **adenopatía cervical derecha de 4 cm de cuatro meses de evolución**, no presenta otros síntomas. En la exploración ORL no se ven lesiones. Se solicita una **PAAF positiva para carcinoma epidermoide con inmunohistoquímica: p16 positivo y VEB negativo**. ¿Cuál es el origen primario **MÁS probable**?"
}

b3_start = text.find('## 🟡 BLOQUE 3:')
b4_start = text.find('## 📡 BLOQUE 4:')

pre = text[:b3_start]
b3 = text[b3_start:b4_start]
post = text[b4_start:]

for num, enun in enuns_b3.items():
    # Find heading like `Q003` or `Q031` or `Q100`
    tag = f"Q{num:03d}"
    # Find start of this question
    pos = b3.find(tag)
    if pos == -1:
        print(f"Tag {tag} not found!")
        continue
    
    # Find next bullet * **Enunciado completo:** or * **Caso:**
    line_start = b3.find('\n* **', pos)
    if line_start != -1:
        line_end = b3.find('\n* ❌', line_start)
        if line_end == -1:
            line_end = b3.find('\n* ⚪', line_start)
        if line_end != -1:
            old_line = b3[line_start:line_end]
            new_line = f"\n* **Enunciado completo:** {enun}"
            b3 = b3[:line_start] + new_line + b3[line_end:]
            print(f"Replaced Q{num} correctly!")

with open('/Users/hola/.gemini/antigravity/brain/9a114fd9-340f-4086-8b4f-8109903e4aa1/guia_correccion_simulacro_19.md', 'w') as f:
    f.write(pre + b3 + post)

print("Bloque 3 fully updated with exact bolded enunciados!")
