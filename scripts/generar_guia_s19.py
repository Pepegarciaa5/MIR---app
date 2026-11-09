#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json

ARTIFACT_PATH = "/Users/hola/.gemini/antigravity/brain/9a114fd9-340f-4086-8b4f-8109903e4aa1/guia_correccion_simulacro_19.md"

with open("/tmp/s19_audit.json", "r", encoding="utf-8") as f:
    audit_qs = {q["numero"]: q for q in json.load(f)}

# Análisis clínico propio, directo y sintetizado (estilo Simulacro 18) para cada pregunta:
ANALISIS = {
    # ================= BLOQUE 1 (>=70% pob) =================
    33: {
        "titulo": "Interpretación de OR e Intervalo de Confianza al 95%",
        "caso": "Regresión logística de mortalidad en IC aguda: **PAS < 90 mmHg: OR 3,4 (IC 95%: 2,1–5,6; p < 0,001)** · **Fibrilación auricular: OR 1,2 (IC 95%: 0,8–1,7; p = 0,33)** · Creatinina > 2: OR 1,7 (1,1–2,6). Piden la **CORRECTA**.",
        "concepto": "En todas las medidas de razón (**OR, RR y HR**), el **valor nulo es el `1`**. Si el IC 95% incluye el `1` (como la FA: `0,8–1,7`), **NO hay asociación estadísticamente significativa** ($p > 0,05$). La PAS $<90$ tiene todo su IC por encima de `1` ($2,1–5,6$), por lo que es un predictor significativo que triplica el riesgo.",
        "anki": "Valor nulo en bioestadística: en cocientes (**OR, RR, HR**) es el **1** (si el IC 95% incluye el 1 $\\to$ NO significativo, $p > 0,05$). En restas (**Diferencia de medias, RRA**) es el **0**."
    },
    63: {
        "titulo": "TP Dependiente (Cluster C) vs. TP Histriónico (Cluster B)",
        "caso": "Joven de 21 años diagnosticado de **trastorno de la personalidad dependiente**. ¿Cuál **NO** se corresponde con dicho diagnóstico?",
        "concepto": "Ambos necesitan a los demás, pero con conductas opuestas: el **Dependiente (Cluster C)** tiene la creencia nuclear de **incapacidad para cuidar de sí mismo** y adopta una actitud **sumisa y pasiva** para que otro tome las decisiones y lo cuide. El **Histriónico (Cluster B)** busca **ser el centro de atención** mediante la **seducción y el dramatismo teatral**.",
        "anki": "Diferencial necesidad de otros: **TP Dependiente (Cluster C)** = se cree incapaz de cuidarse solo $\\to$ actitud **sumisa/pasiva** buscando que le cuiden. **TP Histriónico (Cluster B)** = busca ser el **centro de atención** mediante **seducción y dramatismo**."
    },
    75: {
        "titulo": "Intoxicación por cocaína en un menor → Parte de lesiones",
        "caso": "**Niño de 5 años** con TDAH que acude a Urgencias con **agitación y agresividad**, dando **positivo a cocaína** en analítica de tóxicos. Piden la actuación **CORRECTA**.",
        "concepto": "Cualquier intoxicación por drogas de abuso en un **menor de edad** obliga de inmediato a **emitir el parte de lesiones al Juzgado de Guardia** (después de estabilizar al niño). El médico **nunca** debe abstenerse de notificar pensando que fue una «imprudencia de los padres», ya que las lesiones por imprudencia grave en un menor también son perseguibles y las investiga el Juez/Forense.",
        "anki": "¿Cuándo es obligatorio el **Parte de Lesiones** en una intoxicación? Siempre que sea un **MENOR de edad / incapaz** (incluso si parece accidental/imprudencia materna), **sospecha de terceros/sumisión química**, **intento autolítico** o **accidente laboral/tráfico**."
    },
    83: {
        "titulo": "Labio leporino y fisura palatina aislados",
        "caso": "Sobre el **labio leporino / fisura labiopalatina**, señale con cuál de las siguientes **NO** se relaciona de forma típica:",
        "concepto": "Tenías un recuerdo real en mente: en el **labio leporino *aislado* (sin fisura palatina)** el pecho materno suele sellar el defecto labial y el bebé puede mamar bien, pero cuando se asocia **fisura palatina** (que es a lo que se refiere globalmente la pregunta al hablar de otitis y alteración del habla) comunica boca y fosa nasal e impide hacer vacío oral para succionar. ¿Por qué la **3 (Retraso mental)** es la falsa indiscutible? Porque aunque existen síndromes cromosómicos (Patau T13, Edwards T18, DiGeorge 22q11) con fisura + retraso mental, **más del 70–80% de las fisuras labiopalatinas son aisladas (no sindrómicas)** y tienen **inteligencia 100% normal**.",
        "anki": "Tríada funcional de la fisura labiopalatina aislada: 1) **Dificultad de succión** (si afecta al paladar no hace vacío oral; en labio leporino aislado el pecho sí puede sellarlo), 2) **Otitis media serosa** e hipoacusia transmisiva (disfunción trompa de Eustaquio), 3) **Rinolalia**. (**NO asocia retraso mental** salvo en síndromes cromosómicos)."
    },
    85: {
        "titulo": "Dinteles quirúrgicos de aorta ascendente en Síndrome de Marfan",
        "caso": "Varón de 35 años con **fenotipo Marfan** (aracnodactilia, escoliosis), **hermano fallecido de muerte súbita**, soplo diastólico (IAo) y **aneurisma de raíz aórtica de 51 mm**. Piden actitud:",
        "concepto": "En la aorta normal/degenerativa el dintel quirúrgico general es $\\ge 55\\text{ mm}$, pero en el **Síndrome de Marfan** es **$\\ge 50\\text{ mm}$ de forma general**, y baja a **$\\ge 45\\text{ mm}$ si hay factores de alto riesgo** (antecedente familiar de disección/muerte súbita, crecimiento $>3\\text{ mm/año}$, IAo/IM grave o deseo gestacional). Con **51 mm + hermano con muerte súbita**, tiene indicación quirúrgica directa.",
        "anki": "Dinteles de cirugía electiva en aneurisma de raíz aórtica / aorta ascendente:\n• **General:** $\\ge 55\\text{ mm}$\n• **Marfan (sin FR) o Válvula Bicúspide (con FR):** $\\ge 50\\text{ mm}$\n• **Marfan CON factores de riesgo** (AF muerte súbita/disección, crecimiento $>3\\text{ mm/a}$, IAo grave): **$\\ge 45\\text{ mm}$**"
    },
    104: {
        "titulo": "Cifras de PIO en el Glaucoma Agudo de Ángulo Estrecho",
        "caso": "Paciente de 76 años, **hipermétrope de +6 D** y fáquico, con **dolor ocular intenso en OD** que se desencadena **viendo una película a oscuras** (midriasis media). ¿Qué PIO esperas encontrar?",
        "concepto": "La PIO **normal** es de **10 a 21 mmHg** (por tanto, `18 mmHg` es un ojo completamente normal). En el **glaucoma crónico simple** suele estar entre **22 y 30 mmHg** (asintomático). Para que el bloqueo pupilar agudo produzca **edema corneal (halos), dolor trigeminal vegetativo y midriasis arreactiva**, la PIO se dispara de forma brusca por encima de **45–50 mmHg** (típicamente **50–60 mmHg**).",
        "anki": "Rangos de Presión Intraocular (PIO):\n• **Normal:** 10 – 21 mmHg\n• **Glaucoma crónico de ángulo abierto:** 22 – 30 mmHg (indoloro)\n• **Glaucoma agudo de ángulo cerrado:** **> 45–55 mmHg** (ojo duro pétreo, dolor intenso + cortejo vegetativo + edema corneal)"
    },
    138: {
        "titulo": "Panarteritis Nodosa (PAN) = Vasculitis ANCA Negativa",
        "caso": "¿En cuál de los siguientes pacientes esperarías una determinación de **ANCA negativa**?",
        "concepto": "La **Panarteritis Nodosa (PAN)** (varón de 60 años con **dolor abdominal / angina mesentérica, HTA vasculorrenal por microaneurismas renales y nódulos/paniculitis cutánea**, respetando el pulmón y sin glomerulonefritis) es una vasculitis necrotizante de **mediano vaso** y es característicamente **ANCA NEGATIVA**. (La opción 3 que marcaste —hemorragia alveolar + síndrome nefrítico + púrpura— es un síndrome pulmorrenal de pequeño vaso **ANCA positivo**, tipo PAM/Wegener).",
        "anki": "**Panarteritis Nodosa (PAN):** Vasculitis de **mediano vaso** asociada a **VHB**, con microaneurismas renales (**HTA vasculorrenal**, sin glomerulonefritis), angina intestinal y mononeuritis múltiple. **Respeta el pulmón** y es **SIEMPRE ANCA NEGATIVA**."
    },
    143: {
        "titulo": "Manejo de Uretritis Gonocócica — ¿Cuándo hacer cultivo?",
        "caso": "Varón de 23 años con **disuria y secreción uretral purulenta matutina a los 2 días** de coito sin preservativo (uretritis gonocócica). Señale la **INCORRECTA**:",
        "concepto": "La opción 4 que marcaste es **verdadera** (*Neisseria gonorrhoeae* crece en medio selectivo de **Thayer-Martin con 5–10% de $CO_2$**). La **INCORRECTA** es la 2 porque en toda sospecha de gonococia **SÍ se debe tomar muestra para cultivo y antibiograma ANTES de iniciar el tratamiento empírico** (para vigilar resistencias a cefalosporinas/macrólidos), aunque no hace falta test de cura si los síntomas desaparecen.",
        "anki": "Uretritis gonocócica (*N. gonorrhoeae*): incubación corta (**2–5 días**), exudado purulento matutino, cultivo en medio **Thayer-Martin con 5-10% $CO_2$**. **Tto empírico:** Ceftriaxona IM (asociando Doxiciclina si no se ha descartado *Chlamydia*)."
    },
    167: {
        "titulo": "Patrones de PET-FDG en Demencias",
        "caso": "¿Cuál de las siguientes afirmaciones refleja **MEJOR** el patrón de metabolismo cerebral en **PET-FDG** en las demencias?",
        "concepto": "Regla anatómica directa del PET-FDG en demencias:\n• **Demencia Frontotemporal (DFT):** Hipometabolismo **frontal y temporal anterior** (preservando parietal y occipital).\n• **Enfermedad de Alzheimer (EA):** Hipometabolismo **temporoparietal bilateral y del cíngulo posterior / precúneo**.\n• **Demencia con Cuerpos de Lewy (DCL):** Hipometabolismo **occipital** + signo de la **isla del cíngulo posterior** (*cingulate island sign*, preservación del cíngulo posterior).",
        "anki": "Mapa PET-FDG en Demencias:\n1) **Frontotemporal:** Hipometabolismo **frontotemporal**\n2) **Alzheimer:** Hipometabolismo **temporoparietal y cíngulo posterior**\n3) **Cuerpos de Lewy:** Hipometabolismo **occipital** + **signo de la isla del cíngulo** (cíngulo posterior preservado)"
    },
    175: {
        "titulo": "Inducción de Tolerancia Oral (ITO) a leche de vaca",
        "caso": "Respecto a la **inducción de tolerancia oral (ITO)** con leche de vaca, señale la **FALSA**:",
        "concepto": "La mayoría de los niños con alergia a proteínas de leche de vaca (APLV) alcanzan la tolerancia espontánea antes de los 2–4 años. Por eso, la ITO se plantea precisamente **a partir de los 4–5 años** en aquellos niños en los que la alergia **persiste** (es **falso** que «solo esté indicada en menores de 4 años»). Una vez lograda la desensibilización, exige **toma diaria mantenida** del alimento para no perderla.",
        "anki": "**Inducción de Tolerancia Oral (ITO)** a leche o huevo: se indica cuando la alergia IgE mediada **persiste más allá de los 4–5 años** (no antes, porque hasta esa edad suele resolverse sola) y exige **ingesta regular mantenida** tras alcanzar la dosis diana."
    },
    178: {
        "titulo": "Genética de las Inmunodeficiencias por Disregulación: APECED vs. IPEX",
        "caso": "El síndrome **APECED** (polendocrinopatía autoinmune-candidiasis-distrofia ectodérmica, síndrome poliglandular autoinmune tipo 1) está producido por mutaciones en el gen:",
        "concepto": "Confundiste la pareja clásica de genes de tolerancia inmunológica:\n• **APECED (SPA-1):** Mutación en el gen **`AIRE`** (tolerancia **central** en el timo: tríada de **Candidiasis mucocutánea + Hipoparatiroidismo + Insuficiencia suprarrenal**).\n• **IPEX:** Mutación en el gen **`FOXP3`** ligado al X (tolerancia **periférica** por falta de linfocitos **T reguladores**: **Enteropatía autoinmune + Diabetes neonatal + Eccema**).",
        "anki": "Versus Disregulación Inmune:\n• **APECED (SPA-1)** $\\to$ Gen **`AIRE`** (tolerancia central tímica; Candidiasis + Hipoparatiroidismo + Addison).\n• **IPEX** $\\to$ Gen **`FOXP3`** (ligado al X, déficit de **Treg**; Enteropatía + DM neonatal + Eccema)."
    },
    180: {
        "titulo": "Artropatía por Pirofosfato Cálcico (Pseudogota) en el anciano",
        "caso": "Mujer de 82 años con episodios de incapacidad para caminar por **artritis aguda en rodillas y carpo izquierdo**. Piden la actitud **MÁS adecuada**:",
        "concepto": "Anciana $>80$ años con mono/oligoartritis aguda de **rodilla y carpo** (las dos articulaciones diana de la **condrocalcinosis / pirofosfato cálcico**) obliga siempre primero a **confirmar el diagnóstico y descartar artritis séptica** mediante **radiografía simple (calcificación del fibrocartílago triangular del carpo y meniscos) y artrocentesis** (cristales romboidales con birrefringencia débilmente positiva). Nunca se pauta metotrexato a ciegas sin artrocentesis.",
        "anki": "Artritis aguda de **rodilla o carpo (ligamento triangular)** en anciano $\\to$ sospechar **Condrocalcinosis (Pirofosfato cálcico)**. 1º Paso: **Rx simple + Artrocentesis** (cristales **romboidales**, birrefringencia **débilmente positiva**)."
    },
    189: {
        "titulo": "Criterios de Síndrome Metabólico",
        "caso": "Varón de 52 años con **IMC 34**, **perímetro abdominal 110 cm**, **HTA**, **triglicéridos 210 mg/dL**, **HDL 35 mg/dL** y **glucemia basal 118 mg/dL**. Diagnóstico:",
        "concepto": "Cumple los **5 de 5 criterios de Síndrome Metabólico (ATP-III)**: 1) Perímetro abdominal $>102\\text{ cm}$ en varón ($>88\\text{ cm}$ en mujer), 2) TG $\\ge 150\\text{ mg/dL}$, 3) HDL $<40\\text{ mg/dL}$ en varón ($<50$ en mujer), 4) TA $\\ge 130/85\\text{ mmHg}$, y 5) Glucemia basal $\\ge 100\\text{ mg/dL}$.",
        "anki": "5 Criterios de **Síndrome Metabólico** (diagnóstico con $\\ge 3$): Cintura $>102\\text{ cm}$ (V) / $>88\\text{ cm}$ (M), **TG $\\ge 150$**, **HDL $<40$** (V) / $<50$ (M), **TA $\\ge 130/85$**, **Glucemia en ayunas $\\ge 100\\text{ mg/dL}$**."
    },

    # ================= BLOQUE 2 (50% - 69% pob) =================
    1: {
        "titulo": "Diverticulosis colónica no complicada (Hallazgo incidental)",
        "caso": "Colonoscopia por SOH positiva en paciente con estreñimiento crónico: se observan **divertículos en sigma sin signos inflamatorios ni complicación** (imagen). Actitud:",
        "concepto": "La **diverticulosis asintomática** (presencia de divertículos en colonoscopia sin dolor, fiebre ni leucocitosis) **NO requiere TC abdominal ni antibióticos**; su único manejo es **dieta rica en fibra** para corregir el estreñimiento. El TC abdominal solo se pide ante sospecha clínica de **diverticulitis aguda**.",
        "anki": "Hallazgo de **diverticulosis** en colonoscopia sin clínica de diverticulitis $\\to$ **Dieta rica en fibra** (NO pedir TC ni dar antibióticos)."
    },
    6: {
        "titulo": "Schwannoma vestibular bilateral = Neurofibromatosis tipo 2",
        "caso": "Joven de 15 años con **hipoacusia neurosensorial bilateral** y RM cerebral (imagen) que muestra **dos masas en ambos ángulos pontocerebelosos**.",
        "concepto": "El **schwannoma vestibular (neurinoma del acústico) BILATERAL** en un joven es diagnóstico patognomónico de **Neurofibromatosis tipo 2 (NF2)** (mutación del gen *merlina/schwannomina* en el **cromosoma 22**, regla *«NF2 = 2 oídos = cromosoma 22»*). Las manchas café con leche y neurofibromas cutáneos son típicos de la NF1 (cromosoma 17).",
        "anki": "**Schwannoma vestibular BILATERAL** en RM $\\to$ **Neurofibromatosis tipo 2 (NF2)** (gen *merlina* en **cromosoma 22**; asocia meningiomas múltiples y cataratas subcapsulares posteriores juveniles)."
    },
    8: {
        "titulo": "Prioridad inmediata en Fractura Abierta grave",
        "caso": "Accidente de tráfico con **fractura abierta grave de miembro superior** con gran exposición de partes blandas (imagen). **Primera medida** al entrar en Urgencias:",
        "concepto": "En toda **fractura abierta**, la medida que más disminuye la tasa de infección ósea (osteomielitis) y que constituye la **primera prioridad médica al cruzar la puerta de Urgencias** es la **antibioterapia intravenosa precoz + profilaxis antitetánica**, seguida de lavado, cobertura estéril, estabilización y desbridamiento quirúrgico.",
        "anki": "1ª medida médica prioritaria al ingreso de toda **fractura abierta**: **Antibioterapia IV precoz + profilaxis antitetánica** (es el factor que más reduce la infección, antes incluso de pasar a quirófano para lavado y fijador externo)."
    },
    14: {
        "titulo": "Manejo de placa coronaria en paciente asintomático (Piden la INCORRECTA)",
        "caso": "Varón de 45 años con **FRCV múltiples** (DM, dislipemia, HTA, fumador) que acude para valoración de riesgo. Está **ASINTOMÁTICO («hace vida normal»)**, con **ECG y ecocardiograma normales**. Aporta un angio-TC coronario que muestra **calcio parietal y estenosis en descendente anterior**. Piden señalar la opción **INCORRECTA**:",
        "concepto": "¡El paciente está **completamente asintomático**! En un paciente sin angina y con ECG/eco normales, el hallazgo incidental de ateromatosis coronaria en angio-TC **NO tiene indicación de cateterismo ni angioplastia con stent** (los stents en asintomáticos no aumentan la supervivencia y añaden riesgos, estudios COURAGE / ISCHEMIA). Lo que sí está indicado de forma agresiva es el **tratamiento médico óptimo**: estatina de alta potencia (opción 1), metformina y **antiagregación con AAS (opción 3, que es verdadera)**.",
        "anki": "Paciente asintomático con placa / calcio coronario en angio-TC $\\to$ **Tratamiento médico agresivo (Estatina alta potencia + AAS)**. **NUNCA** cateterismo/stent rutinario si no hay síntomas ni isquemia demostrada."
    },
    20: {
        "titulo": "Estadificación TNM por RM pélvica del Cáncer de Recto (T3 vs T4)",
        "caso": "RM pélvica en T2 de un varón con **carcinoma de recto** (imagen): tumor que **atraviesa la muscular propia e infiltra la grasa mesorrectal**, pero **sin invadir órganos vecinos (próstata/vejiga) ni peritoneo**. Estadio T:",
        "concepto": "En cáncer de recto:\n• **T1:** Submucosa · **T2:** Muscular propia (sin salir de la línea negra muscular en RM).\n• **T3:** Sobrepasa la muscular propia e **infiltra la grasa perirrectal / mesorrecto** (espiculaciones hacia la grasa mesorrectal, como en la imagen).\n• **T4:** Invade **peritoneo visceral (T4a)** u **órganos adyacentes como próstata, vagina, vejiga o sacro (T4b)**.",
        "anki": "Estadio T en RM de **Cáncer de Recto**:\n• **T2:** Respeta la muscular propia\n• **T3:** Infiltra la **grasa mesorrectal** sin tocar órganos vecinos\n• **T4:** Invade **peritoneo (T4a)** u **órganos vecinos: próstata/vejiga/vagina/sacro (T4b)**"
    },
    21: {
        "titulo": "Sarcoidosis: Adenopatías hiliares bilaterales en PET-TC y evolución",
        "caso": "Mujer de 28 años con astenia, artralgias, **uveítis anterior**, **ECA elevada** y PET-TC con **adenopatías hiliares bilaterales y mediastínicas hipermetabólicas** (imagen). Piden la **CORRECTA**:",
        "concepto": "El cuadro es una **Sarcoidosis pulmonar estadio I/II**. La radiografía de tórax está alterada en **más del 90%** de los casos (por eso la opción 3 que marcaste es falsa). La característica clave de la sarcoidosis aguda es su **alta tasa de remisión espontánea** (especialmente en estadios I y síndrome de Löfgren), reservándose los **corticoides** cuando hay afectación orgánica grave (ocular refractaria, cardíaca, SNC, hipercalcemia o progresión pulmonar).",
        "anki": "**Sarcoidosis:** Rx de tórax alterada en **>90%** de los casos (adenopatías hiliares bilaterales). En estadios iniciales tiene **alta tasa de remisión espontánea**; los corticoides aceleran la mejoría clínica y radiológica."
    },
    32: {
        "titulo": "Diseño de Estudios: Casos y Controles vs. Serie de Casos",
        "caso": "Se comparan los **antecedentes previos** (DM, HTA, EPOC, tabaco) de **pacientes fallecidos por COVID-19 (casos)** frente a **pacientes que sobrevivieron (controles)** para identificar factores de riesgo de mortalidad.",
        "concepto": "Hay **dos grupos comparados** seleccionados en función del **efecto final** (*fallecidos = casos* vs *supervivientes = controles*) y se mira **hacia atrás (retrospectivamente)** qué factores de exposición tenían. Eso define un estudio analítico observacional de **Casos y Controles**. (Una *serie de casos* es puramente descriptiva y solo tiene enfermos, sin grupo control de comparación).",
        "anki": "Si el estudio parte del **desenlace ya ocurrido** (ej. *fallecidos vs. vivos* o *enfermos vs. sanos*) y mira hacia atrás sus antecedentes $\\to$ **Estudio de Casos y Controles** (medida: **OR**)."
    },
    36: {
        "titulo": "Tratamiento de elección de la Aspergilosis Invasiva",
        "caso": "¿Cuál de los siguientes antifúngicos es de **primera elección** para el tratamiento de la **aspergilosis invasiva**?",
        "concepto": "¡Trampa mortal con el **Fluconazol**! El **Fluconazol NO cubre *Aspergillus*** (ni *Candida krusei*, ni *C. glabrata*, ni mucorales). El tratamiento de 1ª elección de la **Aspergilosis invasiva** es el **Voriconazol** o el **Isavuconazol** (que tiene igual eficacia que voriconazol pero menos hepatotoxicidad, menos interacciones y **no alarga el QT**; además el **Isavuconazol también cubre Mucor**).",
        "anki": "1) **Fluconazol NO tiene actividad frente a *Aspergillus***.\n2) 1ª elección en **Aspergilosis invasiva**: **Voriconazol** o **Isavuconazol** (ventaja de Isavuconazol: cubre también *Mucor* y acorta/no prolonga el QT)."
    },
    40: {
        "titulo": "Endocarditis Aguda Nosocomial con Insuficiencia Cardíaca → Cirugía Urgente",
        "caso": "Varón que a las **2 semanas de un cateterismo coronario** ingresa con fiebre alta, **soplo diastólico aórtico nuevo** y **edema agudo de pulmón (insuficiencia cardíaca aguda)**. Actitud:",
        "concepto": "Dos claves: 1) Al ser precoz poscateterismo (nosocomial), la cobertura empírica debe cubrir ***S. aureus* (incluyendo SARM) y estafilococos coagulasa negativos** con **Cloxacilina + Daptomicina (o Vancomicina)** (no ceftriaxona + ampicilina, que es para enterococo/estreptococo comunitario). 2) El **edema agudo de pulmón / shock cardiogénico por insuficiencia aórtica aguda** es la **1ª indicación de cirugía cardíaca de emergencia/urgente**, nunca diferida a 4 semanas.",
        "anki": "Indicaciones de **Cirugía Urgente en Endocarditis Infecciosa** (*regla ICE*):\n1) **I**nsuficiencia cardíaca refractaria / EAP / shock por rotura valvular (la más frecuente)\n2) **C**ontrol local imposible (absceso perivalvular, bloqueo AV, fístula) o germen multirresistente/hongos\n3) **E**mbolismos de repetición o vegetación $>10\\text{ mm}$."
    },
    41: {
        "titulo": "Hipotiroidismo Congénito: Urgencia Terapéutica",
        "caso": "Lactante de 1 mes con **letargia, hipotermia, estreñimiento, ictericia prolongada, hernia umbilical y fontanela posterior amplia**. Actitud prioritaria:",
        "concepto": "Es la clínica clásica del **hipotiroidismo congénito**. Cada día de retraso sin hormona tiroidea en el primer mes de vida produce **daño neurológico irreversible (cretinismo)**. Por eso, ante la sospecha clínica o en el cribado neonatal, tras extraer la muestra de sangre se debe **iniciar Levotiroxina oral de inmediato sin esperar al resultado de la ecografía/gammagrafía tiroidea**.",
        "anki": "Sospecha de **Hipotiroidismo congénito** (ictericia prolongada + hernia umbilical + macroglosia + fontanela posterior amplia) $\\to$ **Iniciar Levotiroxina de inmediato** sin esperar a las pruebas de imagen (urgencia neurológica para evitar retraso mental)."
    },
    43: {
        "titulo": "Fallo de Medro No Orgánico (Hipocrecimiento nutricional)",
        "caso": "Lactante de 9 meses que «come poco», sin vómitos ni diarrea. **Peso < P3**, pero **talla (P25) y perímetro craneal (P50) conservados**. Actitud:",
        "concepto": "Cuando se afecta **primero y únicamente el peso**, respetando la talla y el perímetro craneal, sin diarrea ni malabsorción, se trata de un **fallo de medro de causa nutricional / aporte insuficiente** (el más frecuente en AP, 80%). El manejo inicial es **optimizar y aumentar el aporte calórico de la dieta**, sin retirar el gluten a ciegas sin serología de celiaquía.",
        "anki": "Secuencia de afectación en el **Fallo de Medro nutricional (aporte insuficiente)**: 1º cae el **Peso**, 2º la **Talla**, 3º el **Perímetro craneal** (el último en afectarse). Tto inicial: **aumentar densidad calórica**."
    },
    61: {
        "titulo": "Priapismo por Trazodona",
        "caso": "Varón que acude a Urgencias por **priapismo doloroso de 6 horas de evolución**. ¿Qué psicofármaco utilizado habitualmente como hipnótico se asocia de forma característica a este efecto adverso?",
        "concepto": "Asociación directa y clásica del MIR: **Trazodona = Priapismo** (por su potente bloqueo **alfa-1 adrenérgico** en los cuerpos cavernosos). La trazodona es un antidepresivo SARI que a dosis bajas se usa muchísimo como hipnótico no benzodiacepínico.",
        "anki": "Psicofármaco usado como hipnótico que produce **Priapismo** (por bloqueo $\\alpha_1$-adrenérgico) $\\to$ **Trazodona**."
    },
    94: {
        "titulo": "Luxación Posterior de Hombro",
        "caso": "Varón de 35 años tras caída con brazo en flexión y rotación interna: hombro con **brazo bloqueado en rotación interna e imposibilidad total para la rotación externa**, y signo de la bombilla en Rx. Señale la **CORRECTA**:",
        "concepto": "El **bloqueo de la rotación externa** con el brazo fijo en rotación interna/aducción define la **Luxación POSTERIOR de hombro** (<5% de las luxaciones glenohumerales; la anterior es el 95%). Sus desencadenantes clásicos MIR son las **crisis epilépticas (convulsiones) y las descargas eléctricas / electrocución**, y asocia **lesión de McLaughlin** (fractura por impactación de la cara **anterior** de la cabeza humeral).",
        "anki": "**Luxación POSTERIOR de hombro:** Antecedente de **convulsión o electrocución**, brazo bloqueado en **rotación interna** (imposible rotar externo), Rx en **«bombilla»** y fractura de **McLaughlin** (cabeza humeral anterior)."
    },
    97: {
        "titulo": "Manejo del Traumatismo Hepático hemodinámicamente estable",
        "caso": "Paciente con **traumatismo hepático** (laceración 2 cm y hematoma 8 cm) que se encuentra **hemodinámicamente estable**. Señale la **CORRECTA**:",
        "concepto": "En el traumatismo hepático (igual que en el esplénico), **manda la estabilidad hemodinámica, no el grado anatómico del TC**: si está **estable**, el tratamiento de elección es **conservador (no quirúrgico)**, que tiene éxito en **>85–90%** de los casos. Si en el TC hay extravasación de contraste (*blush* arterial / sangrado activo) pero el paciente sigue estable, se realiza **angioembolización arterial selectiva** sin necesidad de laparotomía.",
        "anki": "Traumatismo hepático o esplénico **hemodinámicamente ESTABLE** $\\to$ **Tratamiento conservador** (éxito $>85\\%$). Si hay *blush* arterial (fuga de contraste en TC) y sigue estable $\\to$ **Angioembolización**."
    },
    98: {
        "titulo": "Primera prueba ante Disfagia Progresiva (Mecánica)",
        "caso": "Varón de 60 años con **disfagia progresiva (primero a sólidos y luego a líquidos)** y pérdida de peso. **Primera prueba** a solicitar:",
        "concepto": "Ante toda **disfagia progresiva + síndrome constitucional** (sospecha de carcinoma de esófago), la **primera prueba diagnóstica obligatoria** es siempre la **endoscopia digestiva alta (panendoscopia oral / gastroscopia) con toma de biopsias**. El TC toracoabdominal sirve después para la **estadificación (M)** una vez confirmado histológicamente el tumor.",
        "anki": "1ª prueba ante sospecha de **Cáncer de Esófago** (disfagia lógica progresiva de sólidos a líquidos): **Endoscopia digestiva alta con biopsia** (el TC y la ecoendoscopia son para estadificar después)."
    },
    119: {
        "titulo": "Fibrilación Auricular: ETE previo a cardioversión si hay dudas o trombo",
        "caso": "Mujer de 50 años con FA paroxística anticoagulada con **rivaroxabán**, que tuvo una **cardioversión eléctrica efectiva hace 2 semanas** y acude de nuevo en FA de $>48\\text{ h}$ o con dudas de manejo. Piden la opción considerada correcta por CTO:",
        "concepto": "En este caso de CTO, la opción dada por válida es realizar **ecocardiograma transesofágico (ETE)** antes de repetir la cardioversión o bien ajustar estrategia; ojo porque la **amiodarona** no es el fármaco de primera línea en una mujer joven de 50 años **sin cardiopatía estructural** (donde se prefiere mantener antiarrítmicos IC como flecainida/propafenona o plantear **ablación de venas pulmonares** tras fracaso de un antiarrítmico).",
        "anki": "En **FA sin cardiopatía estructural** que fracasa a antiarrítmico clase IC (flecainida/propafenona), la indicación de elección es la **ablación por catéter de venas pulmonares** (evitar amiodarona crónica en jóvenes por su toxicidad extracardíaca)."
    },
    136: {
        "titulo": "Porfiria Cutánea Tarda (PCT) asociada a VHC",
        "caso": "Varón de 59 años con **hepatitis C crónica**, **hiperfragilidad cutánea y ampollas tensas en dorso de manos** (zonas fotoexpuestas). Biopsia: ampolla subepidérmica sin inflamación y **PAS+ en vasos dérmicos**. Prueba alterada:",
        "concepto": "Hepatopatía (**VHC**, alcohol o hemocromatosis) + **ampollas y erosiones en dorso de manos** + hipertricosis malar = **Porfiria Cutánea Tarda (PCT)**. Se produce por déficit de la enzima hepática **Uroporfirinógeno descarboxilasa (URO-D)**, acumulándose **uroporfirina I y III y heptacarboxiporfirina en orina** (orina color vino de Oporto con fluorescencia rosa bajo luz de Wood). Tratamiento: **flebotomías** o cloroquina a dosis bajas.",
        "anki": "**Hepatitis C / Alcohol / Hemocromatosis + Ampollas en dorso de manos** $\\to$ **Porfiria Cutánea Tarda (PCT)**. Déficit de **URO-D** $\\to$ elevación de **uroporfirina en orina**. Tto: **Flebotomías**."
    },
    137: {
        "titulo": "Diagnóstico de Dermatomiositis y Anticuerpo Anti-TIF1-gamma (Piden la INCORRECTA)",
        "caso": "Mujer de 35 años con **debilidad proximal simétrica**, **CPK elevada**, **eritema en heliotropo y pápulas de Gottron**, con anticuerpos **anti-TIF1-$\\gamma$ positivos**. Piden la opción **INCORRECTA**:",
        "concepto": "1) La opción 1 que marcaste es **verdadera**: el **anti-TIF1-$\\gamma$** (y anti-NXP2) se asocia en un **40–75% a CÁNCER / neoplasia oculta** (en adultos obliga a cribado tumoral exhaustivo).\n2) La **INCORRECTA (opción 3)**: en la Dermatomiositis, ante la presencia de **lesiones cutáneas patognomónicas (Gottron / heliotropo) + debilidad proximal / CPK elevada + anticuerpo específico positivo**, el diagnóstico de certeza está establecido y **NO es obligatoria la biopsia muscular** (criterios ACR/EULAR). La biopsia se reserva solo si hay dudas diagnósticas o si los anticuerpos son negativos.",
        "anki": "Diagnóstico de **Dermatomiositis**: **Piel patognomónica (Gottron/Heliotropo) + Debilidad proximal/CPK alta + Anticuerpo específico (ej. Anti-TIF1-$\\gamma$)** $\\to$ Diagnóstico cerrado **SIN necesidad de biopsia muscular**."
    },
    149: {
        "titulo": "Genética de las Poliposis Hamartomatosas: Cowden vs. Peutz-Jeghers",
        "caso": "Mujer de 30 años con poliposis hamartomatosa y diagnóstico de **enfermedad de Cowden**. ¿Cuál es el gen mutado?",
        "concepto": "No confundas los genes de las poliposis hamartomatosas:\n• **Síndrome de Cowden:** Mutación del gen supresor **`PTEN`** (triquilemomas faciales, hiperqueratosis acral, macrocefalia y alto riesgo de cáncer de **mama, tiroides y endometrio**).\n• **Síndrome de Peutz-Jeghers:** Mutación del gen **`STK11` (`LKB1`)** (pigmentación mucocutánea perioral + pólipos hamartomatosos en intestino delgado).\n• **Poliposis Juvenil:** Mutación en **`SMAD4` o `BMPR1A`**.",
        "anki": "Genes de las **Poliposis Hamartomatosas**:\n• **Cowden** (triquilemomas + Ca mama/tiroides/endometrio) $\\to$ **`PTEN`**\n• **Peutz-Jeghers** (manchas melanóticas mucocutáneas) $\\to$ **`STK11 / LKB1`**\n• **Poliposis Juvenil** $\\to$ **`SMAD4` / `BMPR1A`**"
    },
    157: {
        "titulo": "Derrame Pleural Reumatoideo vs. Tuberculoso",
        "caso": "Varón de 53 años con **dolor articular en manos** y **derrame pleural unilateral**: exudado linfocítico con **pH < 7,20, glucosa muy baja (< 30 mg/dL), LDH muy alta y complemento bajo**.",
        "concepto": "Tanto la TBC como la Artritis Reumatoide dan exudado linfocítico con ADA elevado, pero las 3 pistas que sellan el **Derrame Reumatoideo** son: 1) **Varón con artritis de manos** (aunque la AR es más frecuente en mujeres, el derrame pleural reumatoideo es **más frecuente en varones con nódulos subcutáneos**), 2) **Glucosa extremadamente baja ($<30\\text{ mg/dL}$) y pH $<7,20$**, y 3) **Colesterol elevado / cristales de colesterol (pseudoquilotórax)** y complemento bajo.",
        "anki": "**Derrame pleural por Artritis Reumatoide:** Típico de **varones** con nódulos reumatoides. Exudado con **glucosa muy baja ($<30\\text{ mg/dL}$)**, **pH $<7,20$**, LDH muy alta, **complemento bajo** y evolución a **pseudoquilotórax (colesterol)**."
    },
    164: {
        "titulo": "Síndrome Cruzado de Protuberancia (Millard-Gubler) en Esclerosis Múltiple",
        "caso": "Paciente joven de 34 años con diplopía y asimetría facial: **paresia del VI par derecho + parálisis facial periférica (VII par) derecha + hemiparesia izquierda (contralateral)**.",
        "concepto": "Regla de los **Síndromes Cruzados del Tronco del Encéfalo** (el par craneal ipsilateral da el piso anatómico):\n• **Mesencéfalo (Weber):** **III par** ipsilateral + vía piramidal contralateral.\n• **Protuberancia (Millard-Gubler / Foville):** **VI y VII par** ipsilaterales + vía piramidal contralateral. En un joven de 34 años de instauración subaguda (2 días), la causa más frecuente es una **placa desmielinizante (brote de Esclerosis Múltiple) en protuberancia derecha**.\n• **Bulbo medial:** **XII par** ipsilateral + vía piramidal contralateral.",
        "anki": "Localización de los Síndromes Alternos del Tronco:\n• **III par** + hemiparesia contralateral $\\to$ **Mesencéfalo (Weber)**\n• **VI y VII par (facial periférica)** + hemiparesia contralateral $\\to$ **Protuberancia (Millard-Gubler)**\n• **XII par** + hemiparesia contralateral $\\to$ **Bulbo medial**"
    },
    184: {
        "titulo": "Tratamiento de la Crisis Suprarrenal Aguda: ¿Hace falta Fludrocortisona?",
        "caso": "Paciente con **hiperpigmentación, hipotensión 80/50 mmHg, hiponatremia e hiperpotasemia (5,6 mEq/L)** y vómitos (crisis suprarrenal aguda). Tratamiento inmediato:",
        "concepto": "¡Trampa clásica de farmacología endocrina! En la **crisis suprarrenal aguda** se administra **Suero Salino Fisiológico 0,9% IV intensivo + Hidrocortisona IV a dosis altas (100 mg en bolo + 200 mg/24h)**, y **NO se da fludrocortisona**, porque la **hidrocortisona a dosis altas ($\ge 50\\text{ mg/día}$) ya satura por completo los receptores mineralocorticoides**. La fludrocortisona oral solo se añade cuando se baja la hidrocortisona a dosis de mantenimiento ambulatorio.",
        "anki": "En la **Crisis Suprarrenal Aguda** (Addison descompensado): **SSF 0,9% IV + Hidrocortisona IV a dosis altas (100 mg)**. **NO se asocia fludrocortisona** en agudo porque las dosis altas de hidrocortisona ya ejercen potente efecto mineralocorticoide."
    },
    185: {
        "titulo": "Tratamiento de 1ª elección en la Acromegalia",
        "caso": "Paciente de 45 años con **acromegalia** confirmada (IGF-1 elevada y GH que no suprime con SOG) por **adenoma hipofisario de 1,5 cm**. Tratamiento de **primera elección**:",
        "concepto": "En **todos los tumores hipofisarios funcionantes EXCEPTO el prolactinoma**, el tratamiento de **primera elección** es la **cirugía transesfenoidal**. Los **análogos de somatostatina (octreótida, lanreótida)** o el pegvisomant se reservan como **2ª línea** si persiste enfermedad activa tras la cirugía o si el paciente es inoperable.",
        "anki": "1ª elección en tumores hipofisarios funcionantes:\n• **Prolactinoma:** **Cabergolina** (médico)\n• **Acromegalia (GH), Enfermedad de Cushing (ACTH) y TSHoma:** **Cirugía transesfenoidal** (los análogos de somatostatina son 2ª línea post-cirugía)."
    },
    191: {
        "titulo": "Síndrome Nefrótico Paraneoplásico en Carcinoma de Pulmón",
        "caso": "Paciente con **carcinoma de pulmón** que presenta **proteinuria de 5 g/24h e hipoalbuminemia de 2,5 g/dL (síndrome nefrótico)** con función renal normal.",
        "concepto": "Asociación paraneoplásica obligatoria del MIR:\n• **Tumores sólidos (Carcinoma de pulmón, colon, mama, estómago)** + Síndrome nefrótico $\\to$ **Glomerulonefritis Membranosa** (normalmente anti-PLA2R negativa, mediada por antígenos tumorales como THSD7A/NELL-1).\n• **Linfoma de Hodgkin** + Síndrome nefrótico $\\to$ **Enfermedad de Cambios Mínimos**.",
        "anki": "Asociación Síndrome Nefrótico y Cáncer:\n• **Tumores sólidos (Pulmón, colon, mama)** $\\to$ **GN Membranosa**\n• **Linfoma de Hodgkin** $\\to$ **Cambios Mínimos**"
    },
    193: {
        "titulo": "Fármacos con efecto Antiproteinúrico",
        "caso": "¿Cuál de los siguientes fármacos **NO** tiene efecto antiproteinúrico demostrado en la enfermedad renal crónica?",
        "concepto": "Los 4 pilares antiproteinúricos actuales en nefrología son: 1) **IECA / ARA-II**, 2) **iSGLT2 (gliflozinas: dapagliflozina, empagliflozina)**, 3) **Finerrenona** (antagonista no esteroideo del receptor mineralocorticoide, indicado en ERC diabética albuminúrica), y 4) **Agonistas GLP-1 (semaglutida/tirzepatida)**. En cambio, la **Doxazosina** ($\alpha_1$-bloqueante) baja la TA pero **NO reduce la presión intraglomerular ni la proteinuria**.",
        "anki": "Fármacos **Antiproteinúricos** nefroprotectores: **IECA/ARA-II + iSGLT2 (gliflozinas) + Finerrenona (antimineralocorticoide no esteroideo) + aGLP-1**. (Los $\\alpha$-bloqueantes como **Doxazosina** NO son antiproteinúricos)."
    },
    197: {
        "titulo": "Clasificación de la Retirada (Destete / Weaning) de la Ventilación Mecánica",
        "caso": "Definición de **destete prolongado** de la ventilación mecánica invasiva:",
        "concepto": "Clasificación internacional del *weaning* (destete) desde la **1ª prueba de ventilación espontánea (PVE)**:\n• **Destete simple:** Se extuba con éxito en el **1º intento** de PVE.\n• **Destete difícil:** Requiere hasta **3 pruebas de PVE** o hasta **7 días** desde la primera PVE.\n• **Destete prolongado:** Fracasa en **$\\ge 3$ pruebas de PVE** o tarda **$> 7$ días** desde la **primera prueba de ventilación espontánea** (no 20 días desde la intubación).",
        "anki": "Clasificación del **Destete (Weaning)** de VM:\n• **Simple:** Éxito en la 1ª prueba de ventilación espontánea (PVE)\n• **Difícil:** Hasta 3 PVE o $<7\\text{ días}$ desde la 1ª PVE\n• **Prolongado:** **$\\ge 3$ intentos fallidos** o **$>7\\text{ días}$ desde la 1ª PVE**"
    },
    207: {
        "titulo": "Arbovirus y sus Vectores: Dengue, Zika, Chikungunya y Fiebre del Nilo",
        "caso": " *(Reserva)* ¿Cuál de las siguientes asociaciones **virus – familia – vector** es **CORRECTA**?",
        "concepto": "Regla para no mezclar nunca los arbovirus:\n• **Dengue, Zika y Fiebre Amarilla:** Familia **Flavivirus** $\\to$ Mosquito ***Aedes* (*A. aegypti / A. albopictus*)**.\n• **Chikungunya:** Familia **Togavirus (*Alphavirus*)** $\\to$ Mosquito ***Aedes***.\n• **Virus del Nilo Occidental (West Nile):** Familia **Flavivirus** $\\to$ Mosquito ***Culex***.\n• **Fiebre hemorrágica de Crimea-Congo:** **Bunyavirus (*Nairovirus*)** $\\to$ Garrapata ***Hyalomma***.",
        "anki": "Mapa de Arbovirus MIR:\n• **Flavivirus + *Aedes*:** **Dengue, Zika, Fiebre Amarilla**\n• **Alphavirus + *Aedes*:** **Chikungunya**\n• **Flavivirus + *Culex*:** **Virus del Nilo Occidental (West Nile)**"
    },

    # ================= BLOQUE 3 (35% - 49% pob) =================
    3: {
        "titulo": "DMAE exudativa/avanzada en Fondo de Ojo → Bilateralidad y Drusas",
        "caso": "Fondo de ojo con gran placa fibrovascular/exudativa macular (DMAE avanzada, imagen). Señale la **CORRECTA**:",
        "concepto": "La imagen muestra una **Degeneración Macular Asociada a la Edad (DMAE)** (no una retinopatía diabética, por eso no se relaciona con la HbA1c). Al ser una enfermedad degenerativa **bilateral aunque asimétrica**, en el ojo contralateral lo más probable es encontrar el signo precoz de la enfermedad: **drusas maculares**.",
        "anki": "Ante una **DMAE exudativa/avanzada** en un ojo, en el **ojo contralateral** cabe esperar la presencia de **drusas maculares** (enfermedad bilateral y asimétrica)."
    },
    4: {
        "titulo": "Fractura Transversal de Peñasco (con afectación de cápsula ótica)",
        "caso": "Fractura de peñasco con **hemotímpano sin perforación timpánica** (imagen), **hipoacusia neurosensorial irreversible y vértigo**. Señale la **FALSA**:",
        "concepto": "Si hay **hipoacusia neurosensorial irreversible**, vértigo vestibular y **hemotímpano con tímpano íntegro** (sin otorragia por desgarro timpánico), se trata de una **fractura TRANSVERSAL de peñasco**, la cual **SÍ atraviesa y destruye la cápsula ótica (laberinto)** (por eso es falso decir que «no afecta a la cápsula ótica»).",
        "anki": "Fracturas de Peñasco:\n• **Longitudinal / Oblicua (80%):** Respeta cápsula ótica $\\to$ desgarro timpánico (**otorragia**) + hipoacusia **transmisiva**.\n• **Transversal (20%):** **Afecta cápsula ótica** $\\to$ tímpano íntegro (**hemotímpano**) + **cofosis (neurosensorial)** + vértigo + **parálisis facial (50%)**."
    },
    10: {
        "titulo": "Necrosis Avascular de Cabeza Humeral tras fractura de húmero proximal",
        "caso": "Mujer de 32 años que 1 año después de la osteosíntesis con placa de una **fractura compleja de húmero proximal** presenta dolor, crepitación y colapso articular en la Rx (imagen).",
        "concepto": "Las fracturas complejas (en 3 o 4 fragmentos de Neer o del cuello anatómico) del **húmero proximal** lesionan las arterias circunflejas humerales y tienen como complicación clásica la **necrosis avascular (osteonecrosis) de la cabeza humeral**.",
        "anki": "Huesos con alto riesgo de **Necrosis Avascular** post-fractura: **Cabeza femoral** (subcapital), **Escafoides carpiano** (polo proximal), **Astrágalo** (cuello) y **Cabeza humeral** (fracturas en 4 fragmentos o cuello anatómico)."
    },
    18: {
        "titulo": "Ecografía escrotal: Masa extratesticular con peristaltismo = Hernia Inguinoescrotal",
        "caso": "Varón de 57 años con masa escrotal izquierda: la ecografía (imagen) muestra el testículo normal desplazado por una **masa extratesticular heterogénea con ecos brillantes y gas (asas intestinales)**.",
        "concepto": "En ecografía escrotal, lo primero es ver si la lesión es **intratesticular** (sólida = tumor testicular como seminoma hasta demostrar lo contrario) o **extratesticular** (benigna en >95%: hidrocele, varicocele, quiste de epidídimo o **hernia inguinoescrotal** con epiplón/asas intestinales).",
        "anki": "Masa escrotal en ecografía: **Intratesticular sólida** = Tumor maligno (Seminoma). **Extratesticular** con grasa mesentérica o asas con gas = **Hernia inguinoescrotal**."
    },
    25: {
        "titulo": "Cocos Gram+ en cadenas Beta-hemolíticos: Prueba de CAMP positiva = S. agalactiae",
        "caso": "Cocos Gram+ en cadenas con **beta-hemólisis** en agar sangre y **prueba de CAMP positiva (en punta de flecha)** en la imagen.",
        "concepto": "La imagen muestra la clásica **prueba de CAMP** (zona de hemólisis sinérgica en forma de **punta de flecha** o campana junto a una estría de *S. aureus*), que identifica de forma específica al ***Streptococcus agalactiae* (Estreptococo grupo B, resistente a bacitracina)**.",
        "anki": "Identificación de Estreptococos $\\beta$-hemolíticos:\n• ***S. pyogenes* (Grupo A):** Sensible a **Bacitracina**, PYR+\n• ***S. agalactiae* (Grupo B):** Resistente a Bacitracina, **Prueba de CAMP positiva (hemólisis en punta de flecha)** e hidrólisis del hipurato+."
    },
    31: {
        "titulo": "Evaluación Farmacoeconómica: Perspectiva Social vs. Hospitalaria",
        "caso": "Estudio farmacoeconómico de dos antibióticos que incluye **costes hospitalarios + bajas laborales (pérdida de productividad / costes indirectos)**. ¿Desde qué perspectiva se ha hecho?",
        "concepto": "• **Perspectiva hospitalaria / del SNS (pagador):** Solo incluye **costes directos sanitarios** (fármacos, analíticas, días de cama).\n• **Perspectiva de la sociedad (social):** Es la única que incluye además los **costes indirectos no sanitarios**, como las **bajas laborales y la pérdida de productividad laboral**.",
        "anki": "En farmacoeconomía, si el estudio incluye **bajas laborales / pérdida de productividad (costes indirectos)** $\\to$ **Perspectiva de la Sociedad (Social)**."
    },
    56: {
        "titulo": "Estudio de permeabilidad tubárica previo a Inseminación Artificial",
        "caso": "Mujer de 34 años sana y sin pareja que solicita reproducción asistida con semen de donante (IAD). Sobre la valoración tubárica:",
        "concepto": "Para indicar una **inseminación artificial** en una mujer joven con buena reserva ovárica, al menos una trompa debe ser permeable; en pacientes asintomáticas sin antecedentes de EIP ni cirugías pélvicas, se puede utilizar la **serología IgG anti-*Chlamydia trachomatis*** como cribado no invasivo de daño tubárico antes de indicar pruebas invasivas.",
        "anki": "Para realizar **Inseminación Artificial** se requiere comprobar reserva ovárica y **ausencia de patología tubárica** (mediante histerosalpingografía/histerosonografía o cribado con **IgG anti-*Chlamydia*** en mujeres de bajo riesgo)."
    },
    65: {
        "titulo": "Mecanismo hipotalámico de los agonistas GLP-1 (Liraglutida / Semaglutida)",
        "caso": "Sobre el mecanismo de los agonistas **GLP-1** en la obesidad, señale la **FALSA**:",
        "concepto": "En el núcleo arqueado del hipotálamo, los agonistas GLP-1 **estimulan (despolarizan) las neuronas anorexigénicas POMC/CART** e **inhiben indirectamente (vía GABA) las neuronas orexigénicas NPY/AgRP**, pero **no** actúan directamente sobre receptores GLP-1 en las neuronas AgRP suprimiendo en minutos su secreción plasmática como describía el distractor 3. (El ensayo STEP-1 demostró que semaglutida 2,4 mg/sem logra pérdidas medias del ~15% / >12 kg en 68 semanas, por lo que la 4 era verdadera).",
        "anki": "Núcleo arqueado hipotalámico e ingesta: neuronas **POMC/CART = Anorexigénicas (saciedad)** (estimuladas por Leptina y **GLP-1**); neuronas **NPY/AgRP = Orexigénicas (hambre)** (estimuladas por Ghrelina)."
    },
    81: {
        "titulo": "Avulsión Preganglionar del Plexo Braquial → Pseudomeningocele en RM",
        "caso": "¿Qué hallazgo en la RM cervical es **MÁS indicativo de avulsión preganglionar** (arrancamiento radicular desde la médula) del plexo braquial?",
        "concepto": "Cuando la raíz nerviosa se arranca directamente de la médula espinal (**lesión preganglionar**, de muy mal pronóstico quirúrgico porque no se puede suturar), se desgarra el manguito dural y sale LCR por el agujero de conjunción, formando un **pseudomeningocele traumático** en la RM. Clínicamente asocia **síndrome de Horner (C8-T1)**, parálisis del **serrato anterior (escápula alada)** y romboides, con **PESS conservados** (porque el ganglio sensitivo dorsal está intacto).",
        "anki": "**Avulsión PREGANGLIONAR del plexo braquial:**\n• RM: **Pseudomeningocele**\n• Clínica: **Horner + Escápula alada (serrato anterior)**\n• Neurofisiología: **Potenciales sensitivos (SNAP) CONSERVADOS** con anestesia clínica (mal pronóstico: no reparable con injerto directo)."
    },
    100: {
        "titulo": "Diagnóstico de Isquemia Mesentérica Aguda con ERC → Angio-TC CON contraste",
        "caso": "Varón de 75 años vasculópata con **ERC** que acude por **dolor abdominal súbito desproporcionado a la exploración** y lactato elevado. Prueba de elección:",
        "concepto": "¡Regla vital de Urgencias! Ante sospecha de una emergencia vascular mortal (**isquemia mesentérica aguda, disección aórtica o TEP**), la prueba de elección es el **Angio-TC CON contraste intravenoso**, y el deterioro de la función renal (ERC o fracaso renal agudo) **NUNCA contraindica ni debe retrasar el contraste IV**, porque un TC sin contraste no permite ver la oclusión de la arteria mesentérica superior.",
        "anki": "En sospecha de **Isquemia Mesentérica Aguda** (dolor abdominal súbito desproporcionado): pedir **Angio-TC abdominal CON contraste IV** siempre, **incluso si hay insuficiencia renal** (el riesgo vital supera a la nefropatía por contraste)."
    },
    102: {
        "titulo": "Síndrome de Dehiscencia del Canal Semicircular Superior (Tercera Ventana)",
        "caso": "Varón con **autofonía, hipoacusia transmisiva con reflejo estapedial PRESENTE** y **vértigo inducido por ruidos fuertes (fenómeno de Tullio) o presión (signo de Hennebert)**. Prueba diagnóstica:",
        "concepto": "La presencia de **hipoacusia de transmisión con reflejo estapedial PRESENTE** (en la otosclerosis está ausente) + **fenómeno de Tullio** (vértigo con sonidos intensos) define la **dehiscencia del canal semicircular superior** (fenómeno de «tercera ventana»). Al ser un defecto óseo del techo del peñasco, se confirma con **TC de peñascos de alta resolución** (reconstrucción en plano de Pöschl).",
        "anki": "Vértigo desencadenado por ruidos fuertes (**Fenómeno de Tullio**) + autofonía + hipoacusia transmisiva con **reflejo estapedial CONSERVADO** $\\to$ **Dehiscencia del canal semicircular superior**. Diagnóstico: **TC de peñascos**."
    },
    103: {
        "titulo": "Estadificación y Tratamiento del Cáncer Supraglótico (T2 vs T3)",
        "caso": "Varón de 57 años con tumor en **banda ventricular y pie de epiglotis**, con **cuerdas vocales móviles** y sin invasión del espacio preepiglótico, y adenopatía ipsilateral de 3,5 cm sin extensión extranodal (`N2a`).",
        "concepto": "En el cáncer de laringe supraglótico:\n• Si invade **más de una subregión supraglótica** pero **las cuerdas vocales son MÓVILES** y no invade espacio preepiglótico, es un **`T2`** (para ser `T3` tiene que haber **fijación de cuerda vocal** o invasión preepiglótica/paraglotis). En un `T2` supraglótico se puede realizar **laringectomía horizontal supraglótica** (conservando la voz y sin traqueostomía definitiva) + **vaciamiento cervical bilateral** (porque la supraglotis tiene drenaje linfático cruzado riquísimo) + RT adyuvante por ser N2.",
        "anki": "Cáncer de laringe: pasa a ser **`T3`** cuando hay **FIJACIÓN de cuerda vocal** o invasión del espacio preepiglótico/paraglotis. Si afecta varias zonas supraglóticas pero con **cuerdas móviles**, es **`T2`** (permite laringectomía supraglótica + vaciamiento **bilateral**)."
    },
    117: {
        "titulo": "Cirugía de la Insuficiencia Tricúspide Orgánica severa post-Endocarditis",
        "caso": "Varón ex-ADVP con **insuficiencia tricúspide severa primaria (orgánica por endocarditis previa)** con velos destruidos y clínica de IC derecha refractaria.",
        "concepto": "En la IT **funcional/secundaria** (por dilatación del anillo secundaria a valvulopatía izquierda) se hace **anuloplastia con anillo protésico**. Pero cuando la válvula tricúspide tiene **daño estructural orgánico grave (destrucción de velos por endocarditis en ADVP o síndrome carcinoide)** con gran defecto de coaptación, la anuloplastia fracasa y requiere **sustitución valvular (implante de prótesis biológica)**.",
        "anki": "Cirugía de la Insuficiencia Tricúspide:\n• **Funcional** (dilatación del anillo) $\\to$ **Anuloplastia**\n• **Orgánica con destrucción de velos** (endocarditis en ADVP, carcinoide) $\\to$ **Prótesis valvular (preferiblemente biológica)**."
    },
    120: {
        "titulo": "Anticoagulación en Fibrilación Auricular Paroxística según CHA2DS2-VASc",
        "caso": "Varón de **66 años (+1)** e **hipertenso (+1)** (`CHA2DS2-VASc = 2`) con **FA paroxística** actualmente en ritmo sinusal. Tratamiento antitrombótico:",
        "concepto": "Dos reglas de oro en la FA:\n1) La indicación de anticoagulación depende **exclusivamente de la escala $\\text{CHA}_2\\text{DS}_2\\text{-VASc}$** ($\\ge 2$ en varones, $\\ge 3$ en mujeres), **nunca del patrón temporal** (la FA paroxística en ritmo sinusal tiene el mismo criterio de anticoagulación indefinida que la permanente).\n2) **El AAS (antiagregación) está proscrito** para la prevención del ictus en la FA. Debe recibir un **ACOD (dabigatrán, apixabán, rivaroxabán o edoxabán)**.",
        "anki": "En la **Fibrilación Auricular**: 1) La **FA paroxística** se anticoagula exactamente igual que la permanente según el **$\\text{CHA}_2\\text{DS}_2\\text{-VASc}$**. 2) Los **antiagregantes (AAS) NO están indicados** para prevenir el ictus en la FA."
    },
    142: {
        "titulo": "Cuadros clínicos de las Filariasis",
        "caso": "Señale la relación **FALSA** entre especie de filaria y su clínica típica:",
        "concepto": "Tabla clásica de Filarias para el MIR:\n• ***Wuchereria bancrofti* y *Brugia malayi*:** Filariasis **linfática** $\\to$ **Linfedema / Elefantiasis** de miembros inferiores y escroto (hidrocele/quiluria). **NO producen uretritis reactiva**.\n• ***Loa loa*:** Filariasis subcutánea transmitida por el tábano *Chrysops* $\\to$ **Edema migratorio de Calabar** y paso del gusano adulto por la **conjuntiva ocular**.\n• ***Onchocerca volvulus*:** Transmitida por la mosca negra *Simulium* $\\to$ nódulos subcutáneos, prurito y **queratitis esclerosante («ceguera de los ríos»)**.",
        "anki": "Tríada de **Filariasis** MIR:\n1) ***W. bancrofti / Brugia malayi*:** Linfedema / **Elefantiasis**\n2) ***Loa loa*:** **Edema de Calabar** + gusano subconjuntival\n3) ***Onchocerca volvulus*:** **Ceguera de los ríos**"
    },
    160: {
        "titulo": "Patrón espirométrico en la Linfangioleiomiomatosis (LAM)",
        "caso": "Señale la afirmación **FALSA** sobre la **linfangioleiomiomatosis (LAM)**:",
        "concepto": "¡Excepción clásica de Neumología! La mayoría de las EPID (como la FPI) dan patrón *restrictivo*, pero las enfermedades pulmonares **quísticas** (**Linfangioleiomiomatosis [LAM]** e **Histiocitosis de células de Langerhans**) cursan característicamente con **patrón ventilatorio OBSTRUCTIVO** (con atrapamiento aéreo y caída de la DLCO). La LAM afecta a **mujeres en edad fértil**, asocia **neumotórax recurrentes, quilotórax y angiomiolipomas renales** (esclerosis tuberosa), se trata con **Sirolimus (inhibidor mTOR)** y **sí puede recidivar en el pulmón trasplantado**.",
        "anki": "EPID que dan **patrón OBSTRUCTIVO** en la espirometría (excepción MIR): **Linfangioleiomiomatosis (LAM)** e **Histiocitosis de células de Langerhans**. (LAM = mujer joven + quistes + **neumotórax/quilotórax** + tto con **Sirolimus**)."
    },
    163: {
        "titulo": "Gammagrafía cardíaca con 123I-MIBG: Enfermedad de Parkinson vs. AMS",
        "caso": "Varón de 65 años con **parkinsonismo e hipotensión ortostática**, en el que la **gammagrafía cardíaca con $^{123}\\text{I-MIBG}$ muestra marcada denervación simpática cardíaca (hipocaptación)**.",
        "concepto": "Diferencial clave entre **Enfermedad de Parkinson (y Cuerpos de Lewy)** frente a **Atrofia Multisistémica (AMS)**:\n• En el **Parkinson / DCL**, el daño autonómico es **postganglionar** $\\to$ se pierden los nervios simpáticos del miocardio y la **gammagrafía cardíaca con $^{123}\\text{I-MIBG}$ está ALTERADA (hipocaptación cardíaca)**.\n• En la **Atrofia Multisistémica (AMS)**, el daño autonómico es **preganglionar (central)** $\\to$ los nervios del corazón están intactos y el **MIBG cardíaco es NORMAL**.",
        "anki": "**Gammagrafía cardíaca con $^{123}\\text{I-MIBG}$** en parkinsonismos con disautonomía:\n• **Alterada (hipocaptación cardíaca, daño postganglionar):** **Enfermedad de Parkinson y Demencia por Cuerpos de Lewy**\n• **Normal (daño preganglionar central):** **Atrofia Multisistémica (AMS)**"
    },
    169: {
        "titulo": "Diagnóstico específico de Miastenia Gravis frente a Lambert-Eaton",
        "caso": "Paciente con **debilidad muscular fluctuante que empeora por la tarde, ptosis y diplopía**. ¿Qué prueba confirma **Miastenia Gravis** y descarta Lambert-Eaton?",
        "concepto": "El **EMG de fibra única (jitter)** es la prueba más sensible de trastorno de la unión neuromuscular, pero **está alterado TANTO en la Miastenia Gravis como en el síndrome de Lambert-Eaton** (no los diferencia). La prueba específica que confirma la Miastenia Gravis es la determinación de **anticuerpos anti-receptor de acetilcolina (anti-AChR)** (mientras que Lambert-Eaton tiene **Ac anti-canales de calcio voltaje-dependientes P/Q**).",
        "anki": "• **EMG de fibra única (*jitter*):** Prueba más **sensible**, pero positiva tanto en Miastenia Gravis como en Lambert-Eaton.\n• **Prueba específica:** **Ac anti-AChR** ( y anti-MuSK) en **Miastenia Gravis** vs. **Ac anti-canales de Calcio (VGCC)** en **Lambert-Eaton**."
    },
    171: {
        "titulo": "Manejo de la Coagulación Intravascular Diseminada (CID) en Sepsis",
        "caso": "Varón con **shock séptico por colangitis (*E. coli*)** que presenta en analítica **plaquetopenia, alargamiento de TP/TTPa, fibrinógeno bajo y D-dímero elevado (CID)** sin sangrado activo.",
        "concepto": "En la **CID**, la piedra angular y el **tratamiento más importante** es siempre **tratar la causa desencadenante** (en una colangitis séptica: **antibioterapia dirigida + drenaje de la vía biliar**). Los hemoderivados (plaquetas, plasma, crioprecipitados) solo se transfunden si hay **sangrado activo** o antes de un procedimiento invasivo.",
        "anki": "El pilar fundamental del tratamiento de la **CID (Coagulación Intravascular Diseminada)** es **tratar la causa subyacente** (ej. antibiótico y control del foco en la sepsis). Solo se transfunde plasma/plaquetas si hay **hemorragia activa**."
    },
    176: {
        "titulo": "Biológicos en Inflamación Tipo 2 (Asma Grave): Tezepelumab (anti-TSLP)",
        "caso": "En las enfermedades con **inflamación tipo 2 (T2)**, ¿cuál de los siguientes emparejamientos **diana terapéutica – fármaco biológico** es correcto?",
        "concepto": "En el asma y la inflamación T2, las células epiteliales respiratorias liberan **alarminas**, entre las que destaca la **TSLP (linfopoyetina estromal tímica)**, cuya diana específica es el anticuerpo monoclonal **Tezepelumab**. (El *Canakinumab* bloquea la **IL-1$\\beta$**, que es de la vía autoinflamatoria/inflammasoma Th1/innata como la fiebre mediterránea familiar o la gota, no de la vía T2).",
        "anki": "Mapa de Biológicos del Asma Grave:\n• **Omalizumab:** Anti-**IgE**\n• **Mepolizumab / Reslizumab:** Anti-**IL-5** · **Benralizumab:** Anti-**Receptor IL-5 ($\\alpha$)**\n• **Dupilumab:** Anti-**IL-4R$\\alpha$ (IL-4 / IL-13)**\n• **Tezepelumab:** Anti-**TSLP** (alarmina epitelial)"
    },
    203: {
        "titulo": "Aneurisma Poplíteo: Bilateralidad y riesgo de Isquemia Tromboembólica",
        "caso": " *(Reserva)* Señale la afirmación **CORRECTA** sobre los aneurismas arteriales periféricos:",
        "concepto": "El **aneurisma poplíteo** es el aneurisma arterial periférico **más frecuente** y tiene 3 reglas de oro en el MIR: 1) Es **BILATERAL en >50% de los casos** y se asocia en un 40% a **aneurisma de aorta abdominal** (obligatorio hacer eco contralateral y abdominal), 2) **Rara vez se rompe**, sino que debuta con **trombosis aguda o embolización distal (isquemia aguda de la pierna)**, y 3) Se opera de forma electiva cuando mide **$\\ge 2\\text{ cm}$** o tiene trombo mural/síntomas.",
        "anki": "**Aneurisma Poplíteo:** El periférico más frecuente. **Bilateral en >50%** (y asocia AAA en 40%). Complicación típica: **Trombosis / Isquemia aguda** (NO rotura). Cirugía si **$\\ge 2\\text{ cm}$** o sintomático."
    },
    208: {
        "titulo": "Adenopatía cervical metastásica p16 positiva → Origen en Orofaringe (Amígdala)",
        "caso": " *(Reserva)* Varón de 62 años con **adenopatía cervical metastásica de carcinoma epidermoide p16 positivo** sin tumor primario visible a simple vista. ¿Dónde asienta con mayor probabilidad el primario?",
        "concepto": "La sobreexpresión inmunohistoquímica de la proteína **p16** es el marcador subrogado de infección por **VPH (Virus del Papiloma Humano, serotipo 16)**, que es el causante del **carcinoma epidermoide de OROFARINGE** (especialmente oculto en las criptas de la **amígdala palatina** y base de la lengua). (Si fuera **VEB positivo**, el primario oculto estaría en el **cavum / nasofaringe**).",
        "anki": "Metástasis ganglionar cervical de primario oculto según marcador viral:\n• **p16 positivo (VPH)** $\\to$ **Orofaringe** (amígdala / base de lengua)\n• **VEB positivo** $\\to$ **Nasofaringe (Cavum)**"
    },

    # ================= BLOQUE 4 (<35% pob) =================
    16: {
        "titulo": "Estadificación del Cáncer de Pulmón mediante PET-TC",
        "caso": "Fumador de 59 años con hemoptisis y TC con masa pulmonar en LSD y adenopatías mediastínicas (imagen). Siguiente paso para definir estadio y actitud:",
        "concepto": "En el cáncer de pulmón no microcítico potencialmente operable o localmente avanzado, el **PET-TC con $^{18}\\text{F-FDG}$** es imprescindible para la **estadificación mediastínica (N) y sistémica (M)** antes de decidir entre cirugía o quimiorradioterapia (no se puede asumir que es un estadio IVA metastásico sin confirmación por PET/biopsia).",
        "anki": "En **Cáncer de Pulmón** sin metástasis evidentes a distancia, el **PET-TC** es obligatorio para completar la estadificación ganglionar mediastínica (N) y descartar metástasis ocultas (M)."
    },
    26: {
        "titulo": "Cálculo del Índice Epidémico (Casos observados / Mediana de 5 años)",
        "caso": "Cálculo del **Índice Epidémico (IE)** en una semana con 23 casos de salmonelosis frente a los casos de esa misma semana en el quinquenio previo:",
        "concepto": "El **Índice Epidémico** se calcula dividiendo los **casos observados esta semana** entre la **MEDIANA (no la media)** de casos de esa misma semana en los **últimos 5 años** (se usa la mediana para que un brote puntual de un año previo no distorsione el denominador). Un $\\text{IE} > 1,25$ define **incidencia alta / brote epidémico**.",
        "anki": "**Índice Epidémico (IE)** = $\\frac{\\text{Casos observados en la semana actual}}{\\text{MEDIANA de casos en la misma semana de los últimos 5 años}}$. (Normal: $0,76 - 1,24$; Epidemia/Alto: **$\\ge 1,25$**; usaste la media en lugar de la mediana)."
    },
    38: {
        "titulo": "Serología del Virus de Epstein-Barr (VEB) y Anticuerpos Heterófilos",
        "caso": "Mujer de 24 años con **síndrome mononucleósico de 10 días**, linfocitos atípicos y serología con **VCA-IgM positiva, VCA-IgG positiva y EBNA negativo**. Piden la **CORRECTA** según CTO:",
        "concepto": "El perfil **VCA-IgM (+), VCA-IgG (+) y anti-EBNA (–)** define una **primoinfección AGUDA por VEB** (porque los anticuerpos **anti-EBNA** tardan de 6 semanas a 3 meses en positivizarse y son los que marcan infección pasada, por lo que la opción 3 que marcaste era falsa).",
        "anki": "Serología de **Infección AGUDA por VEB**: **VCA-IgM (+)** y **Anti-EBNA NEGATIVO** (el Anti-EBNA solo aparece en la infección **pasada/latente** a partir del 2º-3º mes)."
    },
    49: {
        "titulo": "Fiebre sin foco en lactante con auscultación asimétrica y leucocitosis",
        "caso": "Niña de 20 meses con **fiebre de 39,6 ºC**, **auscultación pulmonar asimétrica (hipoventilación basal)**, **22.000 leucocitos con neutrofilia y PCR elevada**.",
        "concepto": "Si en la exploración ya hay **asimetría auscultatoria** junto con fiebre alta y leucocitosis $>20.000/\\mu\\text{L}$ con reactantes elevados, no es una fiebre sin foco banal para mandar a casa: está indicado **realizar radiografía de tórax** para descartar **neumonía bacteriana complicada (derrame paraneumónico)**.",
        "anki": "Lactante con fiebre $>39\\ ^\\circ\\text{C}$ + **leucocitosis $>20.000/\\mu\\text{L}$** o **asimetría auscultatoria** $\\to$ realizar **Radiografía de tórax** (descartar neumonía oculta / derrame)."
    },
    76: {
        "titulo": "Mayoría de edad sanitaria (16 años) vs. Decisiones de grave riesgo",
        "caso": "Menor de **16 años** que solicita un tratamiento con **grave riesgo para su vida o salud**. ¿Quién debe otorgar el consentimiento?",
        "concepto": "Según la **Ley 41/2002 de Autonomía del Paciente**, la mayoría de edad sanitaria general es a los **16 años**, **EXCEPTO** en actuaciones de **grave riesgo para la vida o la salud del menor** (y en ensayos clínicos o técnicas de reproducción asistida), donde el consentimiento lo prestan los **representantes legales (padres)** tras haber oído la opinión del menor.",
        "anki": "**Ley 41/2002 (Menor maduro):** A partir de los **16 años** decide el menor, **EXCEPTO en actuaciones de GRAVE RIESGO para su vida o salud**, donde deciden los **padres/representantes legales**."
    },
    86: {
        "titulo": "Malacoplaquia urinaria: Células de Von Hansemann y Cuerpos de Michaelis-Gutmann",
        "caso": "Mujer de 60 años con **ITU de repetición por *E. coli*** y masas pseudotumorales vesicales/renales con macrófagos espumosos PAS+ (**células de Von Hansemann**) y **cuerpos de Michaelis-Gutmann**.",
        "concepto": "La **malacoplaquia** es una inflamación granulomatosa crónica por defecto de la actividad bactericida de los fagolisosomas de los macrófagos frente a ***E. coli*** (acumulando fragmentos bacterianos mineralizados: **cuerpos de Michaelis-Gutmann** dentro de las **células de Von Hansemann**). *(Nota: esta pregunta de CTO fue muy controvertida porque las fluoroquinolonas de hecho sí penetran intracelularmente, pero CTO dio por válida la descripción histológica de la opción 3)*.",
        "anki": "**Malacoplaquia urinaria:** Asociada a **ITU de repetición por *E. coli***. Histología patognomónica: **Células de Von Hansemann** (histiocitos PAS+) y **Cuerpos de Michaelis-Gutmann** (inclusiones basófilas calcificadas)."
    },
    126: {
        "titulo": "Algoritmo diagnóstico de diarrea por Clostridioides difficile (GDH + Toxina)",
        "caso": "Anciano de 80 años con neumonía en tratamiento con ceftriaxona y clindamicina que desarrolla **diarrea nosocomial con GDH (glutamato deshidrogenasa) POSITIVA** en heces. Siguiente paso:",
        "concepto": "Algoritmo diagnóstico en 2 pasos de *C. difficile*:\n• **1º Paso (Cribado muy sensible):** **GDH** en heces. Si es negativa, descarta infección. Si es **GDH POSITIVA**, indica que hay *C. difficile*, pero **no distingue entre cepa colonizadora no toxigénica y cepa productora de toxina**.\n• **2º Paso (Confirmación):** Solicitar **detección rápida de Toxina A/B en heces** (y si la GDH es `+` pero la toxina es `–`, desempatar con **PCR de gen de toxina / NAAT**).",
        "anki": "Algoritmo diagnóstico de ***Clostridioides difficile*** en heces:\n1º **GDH** (cribado sensible) $\\to$ si es **GDH (+)**, 2º hacer **Test de Toxina A/B** (si GDH+ y Toxina–, desempatar con **PCR/NAAT**)."
    },
    141: {
        "titulo": "Marcadores de riesgo de Linfoma en el Síndrome de Sjögren",
        "caso": "Mujer de 60 años con **Síndrome de Sjögren** que presenta febrícula y adenopatías. ¿Qué manifestación clínica se asocia de forma directa a **crioglobulinemia, hipocomplementemia y alto riesgo de evolución a Linfoma B (MALT)**?",
        "concepto": "En el **Síndrome de Sjögren**, el desarrollo de **púrpura palpable en miembros inferiores (vasculitis leucocitoclástica / crioglobulinémica)**, junto con el **descenso de C4 (hipocomplementemia)** y la **parotidomegalia persistente**, son los principales predictores clínicos de evolución a **Linfoma No Hodgkin de células B (MALT)**.",
        "anki": "Factores de riesgo de **Linfoma B (MALT) en el Síndrome de Sjögren**: **Púrpura palpable (vasculitis crioglobulinémica)**, **hipocomplementemia (descenso de C4)** y **parotidomegalia persistente**."
    },
    146: {
        "titulo": "Bloqueo ecoguiado del nervio supraescapular",
        "caso": "Sobre la técnica del bloqueo ecoguiado del nervio supraescapular, señale la **FALSA**:",
        "concepto": "Pregunta subespecializada de Rehabilitación (17% pob, carne de no hacer Anki): el nervio supraescapular se bloquea en la **fosa/escotadura supraespinosa** (bajo el ligamento transverso superior de la escápula), no desplazando la sonda hasta la articulación acromioclavicular.",
        "anki": "🚫 **NO HACER ANKI:** Detalle técnico de ecografía intervencionista de rehabilitación (<18% de acierto poblacional)."
    },
    151: {
        "titulo": "Índice endoscópico CDEIS en Enfermedad de Crohn",
        "caso": "¿Cuál de los siguientes parámetros **NO** forma parte del índice de gravedad endoscópico **CDEIS** en la enfermedad de Crohn?",
        "concepto": "El **CDEIS** es un índice **exclusivamente endoscópico (intraluminal)** que evalúa en íleon y colon: úlceras superficiales, úlceras profundas, porcentaje de superficie ulcerada/enferma y estenosis. La **enfermedad perianal** es una manifestación clínica/exploratoria externa que forma parte de la clasificación de Montreal o del CDAI clínico, pero **no** del score endoscópico CDEIS.",
        "anki": "🚫 **NO HACER ANKI** (se saca por lógica: un score *endoscópico* mucoso como el CDEIS valora úlceras y estenosis de la luz, no fístulas perianales externas)."
    },
    154: {
        "titulo": "Linfoma Intestinal asociado a Enfermedad Celíaca = Linfoma T (EATL)",
        "caso": "¿Cuál de las siguientes **NO** es una manifestación o complicación característica de la **enfermedad celíaca**?",
        "concepto": "¡Concepto muy preguntado en el MIR! La enfermedad celíaca refractaria se complica con el **Linfoma intestinal asociado a enteropatía (EATL)**, que es un **Linfoma No Hodgkin de células T** (nunca de células B). También asocia osteopenia/osteoporosis por malabsorción de calcio y vitamina D, ferropenia, dermatitis herpetiforme y déficit selectivo de IgA.",
        "anki": "El linfoma intestinal típico de la **Enfermedad Celíaca** refractaria es un **Linfoma No Hodgkin de células T** (*EATL*), **NO de células B**."
    },
    172: {
        "titulo": "Leucemia Mieloide Crónica (LMC) en Fase Acelerada vs. LMA",
        "caso": "Paciente con hepatoesplenomegalia y gran **leucocitosis a expensas de serie mieloide madura (neutrófilos, mielocitos)** que presenta un **15–19% de blastos** (o en el límite del 20%).",
        "concepto": "Cuando predomina la **hiperplasia mieloide diferenciada (toda la cascada de granulocitos maduros, basofilia y esplenomegalia)**, el diagnóstico de base es un síndrome mieloproliferativo crónico: **Leucemia Mieloide Crónica (LMC, $t(9;22)$ *BCR-ABL1*)** en **fase acelerada / crisis blástica**, mientras que la LMA primaria cursa con **hiato leucémico** (blastos inmaduros sin formas intermedias maduras).",
        "anki": "Leucocitosis con **toda la serie granulocítica madura (mielocitos, metamielocitos, basofilia) + esplenomegalia** $\\to$ **Leucemia Mieloide Crónica (LMC)**. (La LMA primaria tiene **hiato leucémico**: blastos sin formas intermedias)."
    },
    174: {
        "titulo": "Diphyllobothrium latum = Anemia Megaloblástica (Macrocítica) por déficit de B12",
        "caso": "Ante una **anemia microcítica (Hb 10 g/dL, VCM 70 fL)**, ¿cuál es el diagnóstico **MENOS probable**?",
        "concepto": "Las causas de anemia **microcítica ($\text{VCM} < 80\text{ fL}$)** son la regla **TASE**: **T**alasemia, **A**nemia inflamatoria, **S**ideroblástica hereditaria y **E**scasez de hierro (Ferropenia). En cambio, el cestodo del pescado crudo ***Diphyllobothrium latum*** consume vitamina $B_{12}$ en el íleon y produce **anemia MEGALOBLÁSTICA (macrocítica, $\\text{VCM} > 100\\text{ fL}$)**.",
        "anki": "Parasitosis por ***Diphyllobothrium latum*** (cestodo por ingesta de pescado de agua dulce crudo) $\\to$ consume **Vitamina $B_{12}$** y produce **Anemia Megaloblástica (VCM alto)**."
    },
    200: {
        "titulo": "Factores de riesgo en violencia de género (Pregunta atípica 6,2% pob)",
        "caso": "Pregunta teórica de medicina legal sobre escalas de valoración del riesgo en violencia sobre la mujer (acertada solo por el 6,2% de la academia):",
        "concepto": "Pregunta puramente arbitraria y mal redactada de CTO (solo el 6% la acertó porque los antecedentes delictivos de hecho sí figuran en los protocolos VioGén reales). Ignorar por completo.",
        "anki": "🚫 **NO HACER ANKI:** Pregunta defectuosa de CTO (6,2% de acierto poblacional)."
    },
    204: {
        "titulo": "Manejo Escalonado (Step-up approach) de la Necrosis Pancreática Infectada",
        "caso": " *(Reserva)* Paciente en la **5ª semana de una pancreatitis aguda** con **necrosis pancreática tabicada (*walled-off necrosis*) sobreinfectada** y fiebre. Señale la **INCORRECTA**:",
        "concepto": "En la **necrosis pancreática infectada**, la cirugía urgente (necrosectomía laparoscópica o abierta de entrada) **está contraindicada** por su altísima mortalidad. El estándar actual es el **manejo escalonado (*step-up approach*)**: **1º Antibioterapia IV (carbapenem) + Drenaje percutáneo guiado por TC o transgástrico endoscópico (ecoendoscopia)**, y solo si fracasa, necrosectomía mínimamente invasiva diferida.",
        "anki": "Tratamiento de la **Necrosis Pancreática Infectada** (*Step-up approach*):\n**1º Antibiótico IV + Drenaje percutáneo o endoscópico transgástrico**.\n**2º** Solo si no mejora: **Necrosectomía mínimamente invasiva** (NUNCA necrosectomía quirúrgica urgente de entrada)."
    },
    205: {
        "titulo": "Obstrucción de Intestino Delgado: Indicaciones de Cirugía Urgente vs. Manejo Conservador",
        "caso": " *(Reserva)* En una **obstrucción de intestino delgado por bridas**, todas las siguientes obligan a cirugía urgente (contraindicando el manejo conservador con SNG) **EXCEPTO**:",
        "concepto": "En la obstrucción de intestino delgado por adherencias/bridas, el manejo inicial es **conservador (dieta absoluta + SNG + sueroterapia)** durante 48–72 h, **SALVO que existan signos de sufrimiento/estrangulación intestinal** (**peritonismo, fiebre, leucocitosis, acidosis láctica o hernia incarcerada**), que obligan a cirugía urgente. En cambio, la **elevación de la creatinina (FRA prerrenal por vómitos y tercer espacio)** es constante y se corrige con **fluidoterapia IV**, sin contraindicar el manejo conservador.",
        "anki": "Obstrucción de intestino delgado por bridas: la **elevación de creatinina (FRA prerrenal por deshidratación)** NO obliga a cirugía urgente (se trata con sueroterapia + SNG). **Sí obligan a cirugía urgente:** fiebre, leucocitosis, acidosis láctica o peritonismo (isquemia/estrangulación)."
    },
    206: {
        "titulo": "Pseudohipoparatiroidismo Tipo Ia (Albright) vs. Tipo Ib",
        "caso": " *(Reserva)* Mujer de 32 años con **hipocalcemia (8,1), hiperfosfatemia (4,9) y PTH elevada (resistencia a la PTH)**, pero con **talla normal y SIN rasgos de osteodistrofia hereditaria de Albright**. Diagnóstico:",
        "concepto": "En el **Pseudohipoparatiroidismo** hay resistencia renal a la PTH (**Calcio bajo + Fósforo alto + PTH alta**):\n• **Tipo Ia:** Mutación inactivante de $G_s\\alpha$ con **Osteodistrofia Hereditaria de Albright** (talla baja, obesidad, cara redonda, **braquidactilia del 4º y 5º metacarpiano**).\n• **Tipo Ib:** Defecto de metilación de *GNAS* limitado al túbulo renal $\\to$ **misma bioquímica (Ca bajo, P alto, PTH alta) pero FENOTIPO FÍSICO NORMAL (sin Albright)**.\n• **Pseudopseudohipoparatiroidismo:** Fenotipo de Albright **CON calcio, fósforo y PTH normales**.",
        "anki": "Clasificación del **Pseudohipoparatiroidismo** (Ca $\\downarrow$, P $\\uparrow$, PTH $\\uparrow$):\n• **Tipo Ia:** Bioquímica alterada **+ Fenotipo de Albright** (talla baja + acortamiento 4º-5º metacarpiano)\n• **Tipo Ib:** Bioquímica alterada **+ Fenotipo físico NORMAL (sin Albright)**\n• **Pseudopseudohipoparatiroidismo:** Fenotipo de Albright **+ Bioquímica NORMAL**"
    },
    209: {
        "titulo": "Vía Aérea Difícil (VAD) Prevista → Intubación con Fibroscopio Despierto",
        "caso": " *(Reserva)* Paciente con **radioterapia cervical previa por cáncer de laringe, trismus severo (apertura bucal < 2 cm), Mallampati IV y cuello rígido leñoso**. Técnica de elección:",
        "concepto": "Ante una **Vía Aérea Difícil (VAD) claramente prevista** con **limitación grave de la apertura bucal y rigidez cervical posradioterapia** (donde existe riesgo de «no poder intubar ni poder ventilar» si se duerme al paciente), el estándar de oro de seguridad es la **intubación con fibrobroncoscopio flexible con el paciente DESPIERTO** (bajo anestesia tópica de vía aérea y sedación ligera manteniendo la respiración espontánea).",
        "anki": "Regla de oro en **Vía Aérea Difícil (VAD) prevista** (radioterapia cervical, trismus severo, masas): **Intubación con fibrobroncoscopio flexible con el paciente DESPIERTO** (nunca abolir la ventilación espontánea antes de asegurar la vía aérea)."
    },
    210: {
        "titulo": "Inmunofenotipo de la Leucemia Linfoblástica B madura (LAL-L3 / Burkitt) = TdT Negativa",
        "caso": " *(Reserva)* Señale la relación **INCORRECTA** entre leucemia aguda y su marcador diagnóstico:",
        "concepto": "La **TdT (desoxinucleotidil transferasa terminal)** es positiva en todos los **linfoblastos inmaduros (LAL pre-B y LAL-T)**, con una **única excepción clásica**: la **LAL-L3 (Leucemia de Burkitt, $t(8;14)$ *MYC*)**, que al ser una proliferación de linfocitos **B maduros** expresa inmunoglobulina de superficie (**sIg+**) y es **TdT NEGATIVA**.",
        "anki": "Marcador **TdT** en Leucemias Agudas: positivo en todas las **LAL (pre-B y T)**, **EXCEPTO en la LAL-L3 (tipo Burkitt)**, que es de célula B madura (**sIg+, TdT NEGATIVA**)."
    }
}

def render_question(num, idx):
    q = audit_qs[num]
    info = ANALISIS.get(num, {})
    asig = q["asignatura"]
    tema = q["tema"]
    pct = q["pct"]
    same_pct = q["samePct"]
    nula = q.get("nula", 0) == 1
    descartes = q.get("dudas", 0) == 1
    reserva = q.get("ignorar", False)
    resp_dada = q["respDada"]
    resp_corr = q["respCorr"]

    badges = []
    if reserva:
        badges.append("📌 `Reserva`")
    if nula:
        badges.append("⚪ `Dejada en blanco`")
    else:
        badges.append("✂️ `Con descartes`" if descartes else "🎯 `Sin descartes`")
    badge_str = " · ".join(badges)

    titulo = info.get("titulo", tema)
    caso = info.get("caso", q["enun"])
    concepto = info.get("concepto", q["coment"])
    anki = info.get("anki", f"*{asig}: {tema}* $\\to$ **{resp_corr}**.")

    if nula:
        marked_line = "* ⚪ **Dejada en blanco (No contestada).**"
    else:
        marked_line = f"* ❌ **Marcaste ({q['respuesta_dada']}):** *{resp_dada}* ({same_pct}% pob)."

    lines = [
        f"### {idx}. `Q{num:03d}` · {asig} ({pct}% pob) — *{titulo}* [{badge_str}]",
        f"* **Caso:** {caso}",
        marked_line,
        f"* ✅ **Correcta ({q['respuesta_correcta']}):** ***{resp_corr}***.",
        f"* **🎯 Por qué fallaste / Concepto clave:** {concepto}",
        f"* **🃏 Anki:** {anki}",
        ""
    ]
    return "\n".join(lines)

b1_nums = [q["numero"] for q in audit_qs.values() if q["pct"] >= 70]
b2_nums = [q["numero"] for q in audit_qs.values() if 50 <= q["pct"] < 70]
b3_nums = [q["numero"] for q in audit_qs.values() if 35 <= q["pct"] < 50]
b4_nums = [q["numero"] for q in audit_qs.values() if q["pct"] < 35]

doc = [
    "# ⚡ Guía de Corrección Rápida — Simulacro 19",
    "**Resultado actual (200 preg):** 127 Aciertos · 67 Fallos · 6 Blancas = **104,67 Netas (Percentil 47)**",
    "**Reservas (`Q201–Q210`):** 2 Aciertos · 7 Fallos · 1 Blanca",
    "",
    "---",
    "",
    "## ⏱️ Rendimiento por Tramos (En tu Orden Real de Realización)",
    "",
    "| Orden Real | Bloque | Preg. | A · F · B | Netas | Tu % Total | % Academia | Balance vs Media | Fallos/Blancas ≥70% |",
    "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    "| **1º** | **Q026 – Q100** (Texto mitad 1) | 75 | 51A · 24F · 0B | **43.00** | **68.0%** | 63.5% | **+4.5%** | 5 (`Q33, 63, 75, 83, 85`) |",
    "| **2º** | **Q001 – Q025** (25 Imágenes) | 25 | 13A · 12F · 0B | **9.00** | **52.0%** | 54.9% | **-2.9%** | **0** |",
    "| **3º** | **Q101 – Q160** (Texto mitad 2) | 60 | 41A · 16F · 3B | **35.67** | **68.3%** | 64.4% | **+4.0%** | 3 (`Q104, 138, 143`) |",
    "| **4º** | **Q201 – Q210** (Reservas) | 10 | 2A · 7F · 1B | *-0.33* | **20.0%** | 37.6% | **-17.6%** | **0** |",
    "| **5º** | **Q161 – Q200** (Último tramo) | 40 | 22A · 15F · 3B | **17.00** | **55.0%** | 62.0% | **-7.0%** | 5 (`Q167, 175, 178, 180, 189`) |",
    "",
    "---",
    "",
    "## 🔴 BLOQUE 1: Las 13 «Imperdonables» ($\ge 70\\%$ de acierto en la academia)",
    "*Aquí tienes **+17,0 netas directas** (12 fallos + 1 en blanco).*",
    ""
]

for i, n in enumerate(sorted(b1_nums), 1):
    doc.append(render_question(n, i))

doc.extend([
    "---",
    "",
    "## 🟠 BLOQUE 2: Preguntas Asequibles ($50\\% - 69\\%$ de acierto en la academia — 27 preguntas)",
    ""
])
for i, n in enumerate(sorted(b2_nums), 1):
    doc.append(render_question(n, i))

doc.extend([
    "---",
    "",
    "## 🟡 BLOQUE 3: Discriminación P80 ($35\\% - 49\\%$ de acierto en la academia — 22 preguntas)",
    ""
])
for i, n in enumerate(sorted(b3_nums), 1):
    doc.append(render_question(n, i))

doc.extend([
    "---",
    "",
    "## 📡 BLOQUE 4: Radar de Cosas Nuevas / Difíciles ($< 35\\%$ de acierto — 19 preguntas)",
    ""
])
for i, n in enumerate(sorted(b4_nums), 1):
    doc.append(render_question(n, i))

content = "\n".join(doc)
with open(ARTIFACT_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"✅ Guía con análisis propio estilo S18 generada en {ARTIFACT_PATH} ({len(content)} chars)")
