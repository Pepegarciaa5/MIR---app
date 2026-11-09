# -*- coding: utf-8 -*-
"""
Base de datos clínica estructurada para la corrección de la Tirada de Digestivo (60 preg, 52 revisadas).
Contiene negritas clínicas, desmontaje Espejo Clínico, descartes y tarjetas Anki (regla ≤3s).
"""
import json

CLINICAL_DATA = {}

# Q01 (Fallo · Cirrosis / Budd-Chiari)
CLINICAL_DATA[1] = {
    "enun_bold": "Paciente de **63 años** consulta por **dolor en flanco derecho, ictericia y aumento del perímetro abdominal**. Se realiza ecografía doppler y TC de hígado como se muestra en la imagen vinculada. ¿Cuál de las siguientes es la **MEJOR opción terapéutica**?",
    "espejo": {
        "premisa": "Identificaste correctamente la presencia de ascitis y alteración del flujo vascular en el doppler.",
        "trampa": "Pensaste en el TIPS como tratamiento inicial («anda por ahí»), olvidando que el Síndrome de Budd-Chiari tiene un manejo estrictamente escalonado donde la anticoagulación médica es SIEMPRE el primer escalón obligatorio.",
        "regla": "Budd-Chiari: 1º Anticoagulación oral precoz e indefinida -> 2º Angioplastia/Stent si estenosis focal -> 3º TIPS si refractario -> 4º Trasplante solo si fallo fulminante o cirrosis terminal."
    },
    "descartes": {
        "A": "TIPS: Es el segundo/tercer escalón si fracasa la anticoagulación médica; nunca de entrada.",
        "C": "Trasplante hepático: Reservado para cirrosis Child C terminal o fallo hepático fulminante refractario.",
        "D": "Angioplastia percutánea: Solo factible si existe estenosis membranosa/focal corta de cava o suprahepática, pero no precede a la anticoagulación."
    },
    "anki": "**Frente:** Síndrome de Budd-Chiari agudo/subagudo → ¿Cuál es el PRIMER escalón terapéutico obligado?\n**Reverso:** **Anticoagulación oral precoz e indefinida** (el TIPS es de rescate si no responde)."
}

# Q02 (Acierto frágil · Obstrucción intestinal)
CLINICAL_DATA[2] = {
    "enun_bold": "º 1. El **manejo clínico inicial más adecuado** para el paciente sería:",
    "consolidacion": "La tríada de oro de la obstrucción mecánica de delgado es: Dieta absoluta + SNG con aspiración continua (descompresión) + Sueroterapia con reposición de K+. El TC abdominal urgente confirma la causa y descarta sufrimiento de asa.",
    "descartes": {
        "B": "Enemas de limpieza: Inútiles y peligrosos en obstrucción mecánica de intestino delgado; solo tienen papel en fecalomas o vólvulo de sigma.",
        "C": "Bicarbonato 1/6 M: Solo si acidosis metabólica severa; el vómito gástrico produce alcalosis metabólica hipoclorémica e hipopotasémica.",
        "D": "Lactulosa y domperidona: Procinéticos y laxantes están formalmente CONTRAINDICADOS en obstrucción mecánica (riesgo de perforación).",
        "E": "Gastroscopia: No tiene indicación diagnóstica ni terapéutica en obstrucción de asas de delgado."
    },
    "anki": "**Frente:** Manejo médico inicial inmediato de la obstrucción mecánica de intestino delgado → Tríada fundamental:\n**Reverso:** **Dieta absoluta + SNG descompresiva + Sueroterapia con K+** (resuelve el 90% sin cirugía)."
}

# Q03 (Acierto frágil · Patología perianal)
CLINICAL_DATA[3] = {
    "enun_bold": "Varón de 68 años, **diabético con mal control** de años de evolución, que acude a Urgencias por **dolor anal y fiebre**. A la exploración física se objetiva **tumoración anal fluctuante**. Se realiza una analítica que objetiva **leucocitosis y elevación de la PCR**. En relación con esta patología, señale la respuesta **MÁS correcta**:",
    "espejo": {
        "premisa": "Acertaste la opción quirúrgica con antibióticos por intuición clínica ante la gravedad.",
        "trampa": "Creíste que era una hemorroide complicada; una masa perianal fluctuante con fiebre, dolor continuo y leucocitosis es un ABSCESO perianal hasta que se demuestre lo contrario.",
        "regla": "Absceso perianal = Drenaje quirúrgico urgente bajo anestesia. Los antibióticos NO sustituyen al drenaje, pero se añaden si es diabético, inmunodeprimido o séptico."
    },
    "descartes": {
        "A": "Manejo conservador con antibióticos tópicos: Gravísimo error; un absceso sin drenar progresa a gangrena de Fournier o sepsis pélvica.",
        "B": "Trombectomía: Indicada en trombosis hemorroidal externa dolorosa en <72h, no en abscesos.",
        "C": "Prueba de imagen obligada: El absceso perianal habitual es de diagnóstico clínico directo; solo se pide TC/RM si sospecha de absceso interesfinteriano alto, pelvirrectal o fístula compleja."
    },
    "anki": "**Frente:** Tumoración anal dolorosa fluctuante + fiebre en paciente diabético → Tratamiento de elección:\n**Reverso:** **Drenaje quirúrgico urgente bajo anestesia + antibioterapia sistémica** (cubrir E. coli y Bacteroides)."
}

# Q04 (Acierto frágil · Vía biliar)
CLINICAL_DATA[4] = {
    "enun_bold": "Paciente colecistectomizada hace 6 años por colelitiasis. Desde hace 6 meses presenta dolor cólico en el flanco derecho a temporadas. En la analítica hay valores de **colestasis moderada**. La **ecografía abdominal confirma coledocolitiasis**. ¿Cuál, entre las siguientes, es la **prueba indicada para realizar en primer lugar**, en este caso?",
    "espejo": {
        "premisa": "Razonaste con perfecta lógica clínica: si la litiasis ya está demostrada en la ecografía, no necesitas más pruebas diagnósticas y vas directo a la terapéutica (CPRE).",
        "trampa": "Dudaste sobre el papel de la colangio-RM; recuerda que la colangio-RM solo se pide ante sospecha intermedia cuando la eco no ve el cálculo.",
        "regla": "Sospecha alta/cálculo confirmado en colédoco en paciente ya colecistectomizado -> CPRE directa (terapéutica y extractiva)."
    },
    "descartes": {
        "A": "TC abdominal: Baja sensibilidad para litiasis de colédoco (muchas son radiotransparentes).",
        "C": "Colangiorresonancia: Prueba de imagen de elección ante probabilidad intermedia, pero aquí la eco ya confirmó la coledocolitiasis.",
        "D": "Colangiografía isotópica (HIDA): Valora permeabilidad cística en colecistitis aguda, no extrae cálculos coledocianos."
    },
    "anki": "**Frente:** Paciente colecistectomizado con coledocolitiasis CONFIRMADA por ecografía → Siguiente paso:\n**Reverso:** **CPRE (colangiografía retrógrada endoscópica)** directa con esfinterotomía y extracción del cálculo."
}

# Q05 (Acierto frágil · Fármacos e hígado)
CLINICAL_DATA[5] = {
    "enun_bold": "Mujer de 14 años que es llevada a urgencias por sus padres tras haber ingerido **12 horas antes múltiples comprimidos de paracetamol** (no saben concretar la cantidad). Está nauseosa, pálida y sudorosa. Se solicitan niveles de paracetamol en sangre que se encuentran en **rango de probable toxicidad hepática**. Las pruebas de función hepática y coagulación son normales. ¿Cuál será la **actitud a seguir**?:",
    "espejo": {
        "premisa": "Acertaste administrando N-acetilcisteína guiada por niveles y analítica.",
        "trampa": "Dudabas si el antídoto solo servía hasta las 8-16h; la N-acetilcisteína es eficaz incluso pasadas 12-24h (e incluso en fallo hepático ya establecido) y NO se retira a ciegas a las 12h.",
        "regla": "Intoxicación por paracetamol con niveles tóxicos en nomograma de Rumack-Matthew: Iniciar N-acetilcisteína iv de inmediato y mantener hasta normalización de paracetamolemia y transaminasas."
    },
    "descartes": {
        "A": "Observación sin antídoto: Negligencia médica; a las 12h con niveles en rango tóxico el daño hepatocelular por NAPQI es inminente.",
        "B": "Mantener solo 12 horas fijas: La duración no es fija de 12h; la pauta clásica iv dura 21 horas y se prolonga si persiste toxicidad.",
        "C": "Esperar 4 horas para repetir analítica: El retraso en administrar NAC aumenta drásticamente la mortalidad y necesidad de trasplante."
    },
    "anki": "**Frente:** Ingesta de paracetamol hace 12 horas con niveles séricos en rango de toxicidad → Actitud inmediata:\n**Reverso:** **Iniciar N-acetilcisteína intravenosa** sin demora y mantener según niveles y función hepática."
}

# Q06 (Acierto frágil · Pancreatitis aguda)
CLINICAL_DATA[6] = {
    "enun_bold": "Paciente con **pancreatitis aguda grave** por litiasis biliar, necrosis extensa estéril del cuerpo y cola. A las tres semanas, presenta **fiebre, dolor persistente, PCR elevada**. En la TAC de abdomen con contraste se observa una colección encapsulada con **niveles líquido aire y necrosis pancreática**. ¿Cuál es la **conducta MÁS adecuada**?",
    "espejo": {
        "premisa": "Reconociste que el gas en la colección indica necrosis infectada y que el tratamiento debe ser en etapas.",
        "trampa": "Dudaste si operar en un tiempo mediante laparotomía abierta directa, lo cual hoy es una mala práctica con altísima mortalidad.",
        "regla": "Necrosis pancreática infectada = Abordaje escalonado «Step-up approach»: 1º Drenaje percutáneo o transgástrico endoscópico -> 2º Necrosectomía mínimamente invasiva (VARD/endoscópica) solo si no mejora."
    },
    "descartes": {
        "A": "Laparotomía urgente con necrosectomía abierta: Asocia un 40-50% de mortalidad; totalmente desplazada por el step-up approach.",
        "B": "Tratamiento conservador: El gas dentro de una necrosis en un paciente febril es diagnóstico de necrosis infectada; requiere intervención obligada.",
        "D": "Esclerosis percutánea con alcohol: Reservada para quistes ováricos o adenomas, jamás en necrosis pancreática."
    },
    "anki": "**Frente:** Paciente a las 3 semanas de pancreatitis aguda con necrosis pancreática encapsulada y gas (infección) → Estrategia de elección:\n**Reverso:** **Abordaje escalonado (Step-up approach)**: drenaje percutáneo/endoscópico inicial y necrosectomía mínimamente invasiva si fracasa."
}

# Q07 (Fallo · Cirrosis / Encefalopatía · Pregunta Anulada)
CLINICAL_DATA[7] = {
    "enun_bold": "Mujer de 67 años diagnosticada de cirrosis hepática, con antecedentes de descompensaciones ascíticas en tratamiento con espironolactona y furosemida. Su familia la trae a urgencias por alteración del nivel de conciencia. La paciente se encuentra ligeramente desorientada en tiempo y espacio y somnolienta. Tiene **asterixis franca**. ¿Cuál de las siguientes medidas **NO se encuentra indicada** a su ingreso?:",
    "espejo": {
        "premisa": "Razonaste impecablemente que una encefalopatía sin foco infeccioso evidente no justifica antibióticos de amplio espectro de forma rutinaria.",
        "trampa": "Marcaste la D creyendo que era la única falsa, pero el Ministerio ANULÓ la pregunta porque los niveles de amoniaco plasmático (B) tampoco tienen correlación clínica ni modifican la actitud, y la paracentesis diagnóstica (A) es obligada en todo cirrótico que ingresa descompensado para descartar PBE.",
        "regla": "Toda descompensación en un cirrótico (incluida encefalopatía) exige PARACENTESIS DIAGNÓSTICA para descartar PBE como gatillo silente. El amonio en sangre NO sirve para monitorizar encefalopatía."
    },
    "descartes": {
        "A": "Paracentesis diagnóstica: OBLIGADA al ingreso de cualquier cirrótico con ascitis que se descompensa (incluso si no tiene dolor ni fiebre).",
        "B": "Amonio plasmático: Su valor no correlaciona con la gravedad clínica de la encefalopatía (motivo de la anulación ministerial).",
        "C": "Lactulosa oral: Tratamiento de primera línea indiscutible para eliminar bacterias productoras de amonio y acidificar el colon."
    },
    "anki": "**Frente:** Cirrótico con ascitis conocida que ingresa por confusión y asterixis (encefalopatía) → Maniobra diagnóstica INVASIVA que NUNCA debe omitirse:\n**Reverso:** **Paracentesis diagnóstica** (descartar peritonitis bacteriana espontánea como causa desencadenante)."
}

# Q08 (Fallo · Estudio hepatobiliar / Ca Páncreas)
CLINICAL_DATA[8] = {
    "enun_bold": "Mujer de 62 años con antecedente personal de pólipos neoplásicos de colon resecados, antecedente familiar de primer grado de cáncer gástrico y hermano fallecido de cáncer de colon a los 42 años. Consulta por **ictericia progresiva de días de evolución junto con coluria**. No asocia dolor ni otros síntomas. En la **ecografía abdominal realizada en Urgencias se observa una lesión de 2 cm en la cabeza pancreática** junto con leve dilatación de la vía biliar intra y extrahepática. Ante la sospecha diagnóstica, **¿cuál sería la siguiente prueba que realizar?**",
    "espejo": {
        "premisa": "Identificaste que había una obstrucción biliar neoplásica y que el drenaje paliativo alivia los síntomas.",
        "trampa": "Priorizaste el alivio paliativo antes del diagnóstico («paliativo primero»), cuando colocar una prótesis biliar antes de estadificar provoca artefactos masivos en la imagen y riesgo de colangitis en un tumor potencialmente curable.",
        "regla": "Masa pancreática detectada por ecografía -> TC toraco-abdomino-pélvico trifásico SIEMPRE antes de cualquier maniobra invasiva o colocación de prótesis."
    },
    "descartes": {
        "A": "Ecoendoscopia con PAAF: No es la primera prueba; además, si el tumor es resecable por TC se opera directamente sin necesidad de biopsia previa.",
        "B": "CPRE con prótesis: Reservada solo si colangitis o bilirrubina >15-20 mg/dL que retrasa quimioterapia, pero NUNCA antes de la TC de estadificación.",
        "D": "Ecoendoscopia con drenaje: No indicada en una lesión sólida sospechosa de adenocarcinoma resecable."
    },
    "anki": "**Frente:** Ictericia obstructiva indolora + nódulo de 2 cm en cabeza de páncreas por ecografía → Siguiente prueba obligada:\n**Reverso:** **TC toraco-abdomino-pélvico con contraste** (estadificación locorregional y a distancia antes de cualquier intervención)."
}

# Q10 (Fallo · Patología perianal / Fisura anal)
CLINICAL_DATA[9] = {
    "enun_bold": "Mujer de 45 años con **proctalgia en relación con la deposición de 12 semanas de evolución**. En la exploración en posición genupectoral se observa la siguiente imagen. ¿Cuál es el diagnóstico más probable?",
    "espejo": {
        "premisa": "Descartaste fístula ano-vaginal y úlcera de Crohn por ausencia de supuración ni clínica digestiva asociada.",
        "trampa": "Te fijaste en que la lesión estaba «roja» para marcar aguda, ignorando el dato pivote cronológico de 12 semanas (crónica >6 semanas) y los signos de cronicidad (bordes sobreelevados escleróticos, colgajo cutáneo o fibras del esfínter interno visibles).",
        "regla": "Fisura anal: > 6 semanas de evolución o visualización de fibras del esfínter anal interno en el lecho / colgajo cutáneo centinela = CRÓNICA."
    },
    "descartes": {
        "B": "Fisura anal aguda: Se limita a desgarro superficial de < 4-6 semanas de evolución que cura con medidas conservadoras.",
        "C": "Fístula anovaginal: Cursa con paso de gases o heces a través de la vagina y orificio fistuloso visible en mucosa vaginal.",
        "D": "Úlcera anal por Crohn: Suelen ser indoloras, múltiples, atípicas en posición lateral y acompañadas de enteropatía."
    },
    "anki": "**Frente:** Dolor anal desgarrador durante y tras la defecación de >6-8 semanas de evolución con bordes indurados → Diagnóstico:\n**Reverso:** **Fisura anal crónica** (tratamiento médico inicial con diltiazem o nitroglicerina tópicos)."
}

# Q11 (Acierto frágil · Úlcera péptica perforada)
CLINICAL_DATA[10] = {
    "enun_bold": "Paciente de 53 años sin antecedentes de interés, que acude a Urgencias por **epigastralgia intensa que irradia difusamente** al resto del abdomen... En la exploración tiene un **abdomen duro con dolor difuso** que mejora con la flexión ventral del tronco. Se le realiza una **radiografía de abdomen en la que se observa neumoperitoneo** en la imagen vinculada. ¿Cuál es la principal sospecha diagnóstica?",
    "consolidacion": "La presencia de neumoperitoneo (gas libre subdiafragmático o en decúbito lateral) junto a un abdomen en tabla peritoneal tras epigastralgia aguda es patognomónica de perforación de víscera hueca (típicamente úlcera péptica duodenal o gástrica).",
    "descartes": {
        "A": "Obstrucción de intestino grueso: Cursa con distensión colónica masiva sin gas libre fuera del intestino (salvo que haya perforado el ciego por hiperpresión).",
        "C": "Suboclusión de delgado: Muestra niveles hidroaéreos en escalera dentro de las asas, no aire libre peritoneal.",
        "D": "Íleo adinámico: Dilatación generalizada de asas con gas en recto y sin neumoperitoneo."
    },
    "anki": "**Frente:** Dolor epigástrico súbito en puñalada + abdomen en tabla + aire libre subdiafragmático en Rx → Diagnóstico:\n**Reverso:** **Perforación de úlcera péptica** (neumoperitoneo = indicación quirúrgica urgente)."
}

print("Batch 1 (Q01-Q11) ready")

# Q12 (Acierto frágil · Fisiología intestinal / Celiaquía)
CLINICAL_DATA[11] = {
    "enun_bold": "Mujer de 27 años en estudio en el Servicio de Dermatología por presentar episodios de **aftas bucales recidivantes**... En analítica: Hb 11,5 g/dl, Fe 38 ug/dl, **Ac antitransglutaminasa IgA 177 U/mI**. La paciente sólo refiere presentar molestias abdominales difusas... ¿Qué prueba considera que es la más adecuada para realizar el diagnóstico?",
    "espejo": {
        "premisa": "Acertaste que la confirmación diagnóstica definitiva de la enfermedad celíaca en el adulto exige biopsia duodenal.",
        "trampa": "Pensabas que las aftas orales recidivantes solo eran típicas de Behçet o lupus; en el MIR son una manifestación extraintestinal clásica de celiaquía del adulto.",
        "regla": "Adulto con sospecha de celiaquía y serología positiva (anti-TG IgA) = OBLIGADA Gastroscopia con biopsias duodenales múltiples para clasificar Marsh antes de retirar el gluten."
    },
    "descartes": {
        "A": "Cápsula endoscópica: Reservada para celiaquía refractaria o sospecha de linfoma/yeyunitis ulcerativa.",
        "B": "Colonoscopia: La celiaquía afecta al duodeno y yeyuno, nunca al colon.",
        "C": "Serología hepatitis víricas: Las transaminasas ligeramente elevadas en celiaquía («hepatitis celíaca») remiten al quitar el gluten; no es la prueba prioritaria."
    },
    "anki": "**Frente:** Adulto con aftas bucales de repetición, ferropenia y anticuerpos antitransglutaminasa IgA positivos → Prueba diagnóstica estándar:\n**Reverso:** **Gastroscopia con biopsia duodenal múltiple** (en adultos NUNCA se prescinde de la biopsia para diagnosticar celiaquía)."
}

# Q13 (Acierto frágil · Celiaquía seronegativa)
CLINICAL_DATA[12] = {
    "enun_bold": "Varón de 24 años con antecedente de dermatitis en la infancia... **diarreas episódicas** de años de evolución. Análisis: **Hb 11,5 g/dL; ferritina baja; albúmina 2; IgA total 300; IgA antitransglutaminasa NEGATIVOS**. Calprotectina y coprocultivo normales. Como antecedentes familiares destaca un **hermano con trisomía** (Down). ¿Cuál sería la actitud diagnóstico-terapéutica MÁS adecuada?",
    "espejo": {
        "premisa": "Intuiste que tras el síndrome de Down familiar y la malabsorción ferropénica subyacía una celiaquía oculta y marcaste el estudio genético.",
        "trampa": "Dudabas por el coste económico de la prueba genética y por no hacer directamente la biopsia; cuando la serología es negativa pero la sospecha es alta (Down, ferropenia), el HLA descarta la enfermedad si es negativo.",
        "regla": "Sospecha de celiaquía con serología negativa en grupo de riesgo (Down, DM1, familiares 1º grado) -> Solicitar HLA-DQ2/DQ8. Si negativo, descarta celiaquía (VPN 99%); si positivo, pasar a biopsia."
    },
    "descartes": {
        "A": "Tratamiento sintomático: La presencia de anemia ferropénica e hipoalbuminemia en un varón joven son signos de alarma que obligan a completar estudio orgánico.",
        "B": "Biopsia duodenal directa: Invasiva e innecesaria de entrada si el paciente fuera HLA-DQ2/DQ8 negativo (evita endoscopias innecesarias).",
        "C": "Test de sobrecrecimiento bacteriano (SIBO): No explica la ferropenia marcada ni el vínculo genético con la trisomía familiar."
    },
    "anki": "**Frente:** Paciente con alta sospecha de celiaquía (ferropenia, familiar con Down) pero anticuerpos antitransglutaminasa NEGATIVOS → Siguiente escalón:\n**Reverso:** **Estudio genético HLA-DQ2 / HLA-DQ8** (su negatividad tiene un valor predictivo negativo >99%)."
}

# Q14 (Acierto frágil · Tumores hepáticos / MASH)
CLINICAL_DATA[13] = {
    "enun_bold": "En un paciente con **esteatosis hepática metabólica** (antes enfermedad hepática por depósito de grasa) el riesgo de desarrollo de **hepatocarcinoma** en comparación con otras etiologías frecuentes como la hepatopatía alcohólica o la hepatitis C, se caracteriza por:",
    "consolidacion": "A diferencia del VHC o el alcohol, donde >90% de los hepatocarcinomas aparecen sobre hígado cirrótico, en el hígado graso metabólico (MASLD/MASH) hasta un 25-30% de los hepatocarcinomas se desarrollan en fases PREVIAS a la cirrosis (en esteatohepatitis no cirrótica).",
    "descartes": {
        "A": "Aparece en personas más jóvenes: Al contrario, el paciente con MASH suele ser más añoso debido a la acumulación crónica del síndrome metabólico.",
        "B": "Se beneficia más de programas de cribado: Falso; al aparecer en hígados no cirróticos que no están en programa de cribado ecográfico semestral, su detección suele ser más tardía.",
        "D": "Mayor incidencia anual que el VHC: Falso; el riesgo anual individual de hepatocarcinoma es menor que en la cirrosis por VHC o VHB activa."
    },
    "anki": "**Frente:** ¿Qué peculiaridad de aparición presenta el hepatocarcinoma (CHC) sobre esteatosis hepática metabólica (MASLD/MASH)?\n**Reverso:** **Puede aparecer en fases previas a la cirrosis (hasta un 25-30% sin cirrosis establecida)**, dificultando el cribado."
}

# Q15 (Acierto frágil · Diverticulitis aguda)
CLINICAL_DATA[14] = {
    "enun_bold": "Hombre de 60 años, sin antecedentes de interés, que acude a Urgencias con un cuadro de 48 horas de **fiebre de 38 ºC y dolor abdominal en fosa iliaca izquierda**. A la exploración abdominal destaca **cierta defensa a la palpación sin peritonismo generalizado**. La TC abdomino-pélvica muestra engrosamiento cólico en sigma y divertículos con estriación grasa. ¿Cuál es el diagnóstico MÁS probable?",
    "espejo": {
        "premisa": "Identificaste perfectamente el cuadro típico de «apendicitis izquierda»: fiebre + dolor en FII + TC con divertículos inflamados.",
        "trampa": "Dudaste de si las imágenes correspondían a otra patología aguda, pero la estriación de la grasa peridiverticular es la clave de la diverticulitis.",
        "regla": "Fiebre + Dolor en Fosa Ilíaca Izquierda + Leucocitosis = DIVERTICULITIS AGUDA hasta que la TC abdominal demuestre lo contrario (TC es la prueba de elección, NUNCA colonoscopia aguda)."
    },
    "descartes": {
        "A": "Cáncer de colon oclusivo: No produce fiebre de 48h con inflamación aguda peridiverticular en sigma de forma súbita.",
        "B": "Síndrome de Ogilvie: Es una pseudoobstrucción cólica masiva no mecánica sin signos inflamatorios ni fiebre.",
        "D": "Megacolon tóxico: Cursa con dilatación de colon transverso >6 cm y signos de toxicidad sistémica grave en colitis previa."
    },
    "anki": "**Frente:** Fiebre + dolor en fosa ilíaca izquierda + defensa local en varón de 60 años → Prueba diagnóstica de elección:\n**Reverso:** **TC toraco-abdomino-pélvico con contraste** (confirma diverticulitis aguda y clasifica Hinchey; colonoscopia contraindicada en fase aguda)."
}

# Q17 (Fallo · Hepatitis autoinmune / Tipos)
CLINICAL_DATA[15] = {
    "enun_bold": "Niña de 10 años que presenta en un análisis una importante elevación de transaminasas, que persiste en controles posteriores. Entre los estudios complementarios destaca la presencia en sangre de **anticuerpos antimicrosómicos de hígado-riñón tipo 1 (anti-LKM-1)**. El cuadro que presenta tiene todas las características siguientes, **EXCEPTO una de las siguientes**:",
    "espejo": {
        "premisa": "Sabías que era una hepatitis autoinmune típica de mujeres y sospechaste que la hipogammaglobulinemia no cuadraba con una enfermedad autoinmune mediada por anticuerpos.",
        "trampa": "Caíste en la trampa asociativa por el número 1: creíste que los anticuerpos anti-LKM-1 correspondían al tipo 1, cuando son precisamente el marcador del TIPO 2 (Tipo 1 = ANA y anti-músculo liso).",
        "regla": "Hepatitis Autoinmune: Tipo 1 = ANA + SMA (adultos). Tipo 2 = anti-LKM-1 (niñas/jóvenes). TODAS cursan con HIPERgammaglobulinemia (IgG policlonal), NUNCA hipo."
    },
    "descartes": {
        "B": "Hepatitis de interfase en biopsia: Es el hallazgo anatomopatológico cardinal de la hepatitis autoinmune (necrosis parcelar y plasmocitos).",
        "C": "Más frecuente en sexo femenino: Cierto, el 70-80% de los casos son niñas o mujeres jóvenes.",
        "D": "Es una hepatitis autoinmune tipo 2: Totalmente CIERTO; los anti-LKM-1 definen la HAI tipo 2."
    },
    "anki": "**Frente:** ¿Cuál es el anticuerpo característico de la Hepatitis Autoinmune Tipo 2 (típica de niñas) y qué alteración proteica asocia?\n**Reverso:** **Anti-LKM-1** y asocia **HIPERgammaglobulinemia (IgG)** (la hipogammaglobulinemia es falsa)."
}

# Q18 (Acierto frágil · Sobrecrecimiento bacteriano / SIBO)
CLINICAL_DATA[16] = {
    "enun_bold": "Varón de 83 años que consulta por un cuadro recurrente de **dolor abdominal en fosa iliaca izquierda, acompañado de diarrea de hasta 6 deposiciones al día sin productos patológicos**, de 10-15 días de evolución. No refiere fiebre ni afectación del estado general... colonoscopia hace tres años con **divertículos a lo largo de todo el colon**. De las siguientes, ¿cuál sería la **MEJOR actitud a seguir**?",
    "espejo": {
        "premisa": "Acertaste la opción de antibioterapia empírica orientándote por el cuadro diarreico crónico.",
        "trampa": "No entendías la causa del cuadro («no tengo ni idea de qué puede estar pasando»); los divertículos colónicos y del intestino delgado actúan como reservorios y zonas ciegas que producen sobrecrecimiento bacteriano (SIBO).",
        "regla": "Anciano con diverticulosis extensa y diarrea acuosa recurrente sin fiebre ni inflamación = Sospechar SIBO secundario por estasis en divertículos -> Ciclo de antibiótico oral (rifaximina o metronidazol)."
    },
    "descartes": {
        "B": "Colonoscopia preferente: Innecesaria al tener una colonoscopia reciente normal con divertículos y sin datos de sangrado ni alarma.",
        "C": "Ecografía abdominal urgente: El paciente está afebril y sin signos de abdomen agudo ni diverticulitis.",
        "D": "Sigmoidectomía quirúrgica: Desproporcionada y contraindicada en ausencia de diverticulitis complicada recurrente o perforación."
    },
    "anki": "**Frente:** Anciano con diarrea crónica acuosa recurrente y diverticulosis cólica sin signos de infección aguda ni leucocitosis → Diagnóstico y actitud:\n**Reverso:** **Sobrecrecimiento bacteriano (SIBO)** secundario a estasis diverticular → **Antibioterapia empírica (rifaximina)**."
}

# Q19 (Acierto frágil · Linfoma MALT gástrico)
CLINICAL_DATA[17] = {
    "enun_bold": "¿En cuál de las siguientes neoplasias gástricas en estadio incipiente, se puede considerar como **primera opción terapéutica la erradicación de H. pylori** con antibioterapia e inhibidores de la bomba de protones?",
    "consolidacion": "El linfoma MALT gástrico de bajo grado (estadios iniciales I-IIIE) tiene su génesis ligada a la estimulación antigénica crónica por Helicobacter pylori. El tratamiento de erradicación antibiótica logra la remisión histológica completa en el 70-80% de los casos sin requerir quimioterapia ni gastrectomía.",
    "descartes": {
        "A": "Adenocarcinoma difuso: Cáncer agresivo infiltrante (linitis plástica); requiere gastrectomía total oncológica + quimioterapia.",
        "B": "Adenocarcinoma intestinal: Requiere resección quirúrgica o endoscópica; la erradicación de H. pylori solo previene su desarrollo, no lo cura.",
        "D": "Linfoma gástrico de alto grado: Progresión difusa de células B grandes; requiere inmuno-quimioterapia sistémica (R-CHOP).",
        "E": "Linfoma de Hodgkin: Extremadamente infrecuente en estómago; se trata con quimioterapia sistémica (ABVD), no con IBP."
    },
    "anki": "**Frente:** Neoplasia gástrica maligna de bajo grado curable en estadios iniciales únicamente erradicando Helicobacter pylori:\n**Reverso:** **Linfoma gástrico MALT de bajo grado** (remisión completa en 75% de casos con antibioterapia + IBP)."
}

# Q20 (Fallo · Factores de litogénesis biliar)
CLINICAL_DATA[18] = {
    "enun_bold": "La etiología litiásica corresponde aproximadamente al 90% de los pacientes con colecistitis aguda. Existen factores claramente relacionados con el aumento de litogénesis biliar en algunos pacientes. Señale cuál de los siguientes **NO es factor de riesgo para su desarrollo**:",
    "concepto_clave": "El factor de riesgo sexual indiscutible para la litiasis biliar de colesterol es el SEXO FEMENINO (regla de las 4 F: Female, Fat, Fertile, Forty) por acción de los estrógenos. Por tanto, el «sexo masculino» es FALSO como factor de riesgo.",
    "descartes": {
        "A": "Pérdida rápida de peso: Factor de riesgo mayor por movilización rápida de colesterol biliar y sobresaturación litiásica.",
        "B": "Ayuno prolongado o nutrición parenteral: Factor de riesgo mayor por hipomotilidad y éstasis vesicular al no haber estímulo de colecistoquinina (CCK).",
        "D": "Enfermedad de Crohn: Afecta al íleon terminal impidiendo la reabsorción de sales biliares -> desbalance sales/colesterol -> litogénesis."
    },
    "anki": "**Frente:** ¿Cuál de los sexos es el factor de riesgo clásico para la colelitiasis de colesterol?\n**Reverso:** **Sexo FEMENINO** (estrógenos aumentan secreción de colesterol biliar; el sexo masculino NO es factor de riesgo)."
}

# Q21 (Acierto frágil · Obstrucción intestinal neoplásica)
CLINICAL_DATA[19] = {
    "enun_bold": "Hombre de 72 años con carcinoma de cavidad oral intervenido con GEP... dolor y distensión abdominal de 3 días, intolerancia y ausencia de deposiciones. La TC abdominopélvica muestra estenosis por **engrosamiento parietal del colon descendente** con dilatación retrógrada. ¿Cuál de los siguientes es el diagnóstico más probable?",
    "consolidacion": "La imagen de TC muestra un «signo del mordisco de manzana» en colon descendente con masa estenosante que ocluye la luz colónica y dilata el ciego y colon ascendente. La gastrostomía previa no causa estenosis colónica izquierda.",
    "descartes": {
        "B": "Carcinomatosis peritoneal: Produciría nódulos peritoneales múltiples y ascitis con efecto compresivo extrínseco multifocal, no una lesión estenosante primaria colónica única.",
        "C": "Migración de la sonda de gastrostomía: Provocaría obstrucción gástrica o duodenal alta, nunca una estenosis a nivel del colon descendente.",
        "D": "Íleo adinámico por fármacos: Cursaría con dilatación colónica simétrica sin punto de estenosis abrupto ni efecto masa parietal."
    },
    "anki": "**Frente:** Anciano con cuadro oclusivo bajo y TC que muestra engrosamiento tumoral circular estenosante en colon descendente → Diagnóstico:\n**Reverso:** **Cáncer colorrectal estenosante de colon izquierdo** (colon descendente/sigma)."
}

# Q22 (Acierto frágil · Colitis isquémica post-AAA)
CLINICAL_DATA[20] = {
    "enun_bold": "Ingresa una paciente de 83 años para tratamiento de **aneurisma de aorta abdominal (AAA)** de 50 mm... **Veinticuatro horas tras la cirugía** la paciente presenta distensión, dolor abdominal y **rectorragias, acompañado de leucocitosis 32.100 mcL**... angio-TC muestra **neumatosis en colon descendente**. ¿Cuál es el diagnóstico MÁS probable?",
    "consolidacion": "La combinación de cirugía aórtica previa (ligadura o exclusión de arteria mesentérica inferior) + rectorragia + dolor abdominal agudo + neumatosis colónica izquierda en TC es la definición de colitis isquémica transmural postoperatoria.",
    "descartes": {
        "A": "Isquemia mesentérica aguda de delgado: Afecta a la arteria mesentérica superior (AMS); cursa con dolor periumbilical desproporcionado sin rectorragia precoz y afecta al yeyuno/íleon.",
        "B": "Isquemia mesentérica crónica: Cuadro insidioso de meses con dolor posprandial («angor intestinal») y pérdida de peso por miedo a comer.",
        "C": "Isquemia no oclusiva (NOMI): Secundario a bajo gasto/shock o fármacos vasoconstrictores en UCI, predominantemente en delgado y colon derecho."
    },
    "anki": "**Frente:** Dolor abdominal agudo + RECTORRAGIA en las primeras 24-48 horas tras reparación de aneurisma de aorta abdominal → Sospecha:\n**Reverso:** **Colitis isquémica** (secundaria a ligadura/hipoflujo de arteria mesentérica inferior; colon izquierdo)."
}

# Q24 (Fallo · Cáncer de Páncreas / DPC)
CLINICAL_DATA[21] = {
    "enun_bold": "La **complicación MÁS frecuente y grave** de la duodenopancreatectomía cefálica (operación de Whipple) es:",
    "concepto_clave": "El talón de Aquiles de la duodenopancreatectomía cefálica (DPC) es la anastomosis pancreaticoyeyunal: la FÍSTULA PANCREÁTICA postoperatoria es la complicación más frecuente (15-25%) y la más temida, ya que las enzimas activadas digieren vasos circundantes provocando dehiscencia, peritonitis y hemorragias cataclísmicas.",
    "descartes": {
        "A": "Hemorragia: Es muy grave, pero suele ser una consecuencia secundaria a la erosión vascular por una fístula pancreática desapercibida.",
        "B": "Absceso intraabdominal: Frecuente pero secundario a fuga pancreática o biliar.",
        "D": "Infección de la herida: Complicación banal que no compromete la vida del paciente ni define la gravedad de la DPC."
    },
    "anki": "**Frente:** ¿Cuál es la complicación más frecuente y potencialmente letal tras una duodenopancreatectomía cefálica (Whipple)?\n**Reverso:** **Fístula pancreática** (por dehiscencia de la anastomosis pancreato-yeyunal; 15-25% de incidencia)."
}

# Q25 (Acierto frágil · Cirugía Bariátrica)
CLINICAL_DATA[22] = {
    "enun_bold": "En relación con las **indicaciones de cirugía bariátrica**, señale la **CORRECTA**.",
    "espejo": {
        "premisa": "Tenías perfectamente claro que pacientes con IMC 30-35 kg/m² con comorbilidades metabólicas graves (especialmente diabetes tipo 2 de mal control) tienen indicación de cirugía metabólica.",
        "trampa": "Ninguna trampa te desvió; consolida que las guías actuales priorizan el beneficio metabólico cardiovascular sobre el corte rígido estricto de IMC >40.",
        "regla": "Cirugía Bariátrica / Metabólica: Indicada con IMC ≥40 sin comorbilidades, IMC ≥35 con comorbilidades mayores, y ahora con IMC 30-35 si DM2 de difícil control metabólico."
    },
    "descartes": {
        "A": "IMC es la mejor medida de gravedad: Falso; no mide distribución de grasa visceral ni grado de inflamación vascular metabólica.",
        "B": "El IMC no se utiliza: Falso; sigue siendo el parámetro de corte inicial de clasificación en todos los consensos.",
        "C": "Punto de corte fijo de 55: Absurdo; 55 corresponde a super-superobesidad, pero la indicación se establece a partir de 35-40 (o 30 en metabólica)."
    },
    "anki": "**Frente:** ¿Está indicada la cirugía metabólica/bariátrica en pacientes con IMC entre 30 y 35 kg/m²?\n**Reverso:** **SÍ, en pacientes con diabetes mellitus tipo 2** o enfermedad metabólica con mal control médico a pesar de tratamiento optimizado."
}

print("Batch 2 (Q12-Q25) ready")

# Q26 (Acierto frágil · Neoplasia mucinosa papilar intraductal - NMPI)
CLINICAL_DATA[23] = {
    "enun_bold": "Indique la afirmación **FALSA** en relación con la **neoplasia mucinosa papilar intraductal (NMPI)** del páncreas:",
    "espejo": {
        "premisa": "Acertaste sospechando con buen sentido quirúrgico que la pancreatectomía total sistemática es una medida desproporcionada.",
        "trampa": "Dudabas por la multifocalidad de la NMPI; aunque existan lesiones salteadas («skip lesions»), la pancreatectomía total convierte al paciente en diabético lábil apo-pancreático y solo se reserva a casos extremos.",
        "regla": "NMPI del páncreas: Si afecta a rama principal (>10 mm) o tiene signos de alto riesgo -> Cirugía resectora PARCIAL/segmentaria (DPC o pancreatectomía corporocaudal). Pancreatectomía total casi nunca de entrada."
    },
    "descartes": {
        "A": "Multifocal en 10%: Cierto; hasta un 10-20% son multicéntricas.",
        "C": "Tres tipos (I conducto principal, II rama secundaria, III mixto): Cierto y define el pronóstico y actitud terapéutica.",
        "D": "Salida de moco por la ampolla de Vater en CPRE: Signo patognomónico clásico del tipo I (rama principal)."
    },
    "anki": "**Frente:** Ante una neoplasia mucinosa papilar intraductal (NMPI) de páncreas con indicación quirúrgica, ¿está indicada la pancreatectomía total de rutina?\n**Reverso:** **NO, se realizan resecciones pancreáticas parciales/segmentarias** (la pancreatectomía total asocia una morbimortalidad prohibitiva)."
}

# Q27 (Acierto frágil · Coledocolitiasis + Colelitiasis)
CLINICAL_DATA[24] = {
    "enun_bold": "Varón de 58 años con colelitiasis conocida... **dolor continuo en hipocondrio derecho irradiado a espalda tras la ingesta**, orinas colúricas, **bilirrubina 4 mg/dL con directa 3,5 mg/dL**. Ecografía y colangio-RM confirman litiasis vesicular y **defecto de repleción en colédoco**. ¿Cuál es la sospecha diagnóstica y tratamiento que aplicaría?",
    "consolidacion": "Cuadro obstructivo biliar con litiasis en colédoco + vesícula in situ litiásica: la secuencia terapéutica reglada en dos tiempos es: 1º CPRE terapéutica (esfinterotomía + extracción del cálculo del colédoco para descomprimir vía biliar) y 2º Colecistectomía laparoscópica programada en el mismo ingreso.",
    "descartes": {
        "A": "Colecistectomía simple: Si quitas la vesícula sin limpiar el colédoco, dejas la coledocolitiasis impactada provocando colangitis o pancreatitis aguda postoperatoria.",
        "C": "Colangitis aguda: No cumple criterios de colangitis de Tokio (está afebril, hemodinámicamente estable y sin leucocitosis).",
        "D": "Neoplasia de vía biliar: Las imágenes demuestran defectos de repleción compatibles con cálculos litiásicos móviles, no estenosis malignas con masa."
    },
    "anki": "**Frente:** Coledocolitiasis confirmada por imagen en paciente con vesícula litiásica in situ y sin colangitis → Secuencia terapéutica de elección:\n**Reverso:** **1º CPRE terapéutica (esfinterotomía + extracción de cálculos) + 2º Colecistectomía laparoscópica diferida**."
}

# Q28 (Acierto frágil · Poliposis / Síndrome de Gardner / Gen APC)
CLINICAL_DATA[25] = {
    "enun_bold": "Hombre de 34 años con **poliposis intestinal** y manifestaciones extraintestinales como **hipertrofia congénita del epitelio pigmentario de la retina (CHRPE) y osteomas mandibulares**. Para hacer el diagnóstico genético se debe analizar el gen:",
    "espejo": {
        "premisa": "Vinculaste con éxito el gen APC a la poliposis adenomatosa.",
        "trampa": "Dudabas porque no mencionaban antecedentes familiares explícitos («no hace referencia a familia»), olvidando que hasta un 25-30% de las mutaciones en APC son de novo y que los osteomas + CHRPE son la firma del Síndrome de Gardner (variante fenotípica de la PAF).",
        "regla": "Poliposis adenomatosa + Osteomas óseos + Quistes epidérmicos + Manchas pigmentadas en retina (CHRPE) = SÍNDROME DE GARDNER (mutación en gen APC, cromosoma 5q)."
    },
    "descartes": {
        "A": "Gen MYH (MAP): Poliposis recesiva por mutación en MUTYH; no asocia hipertrofia congénita de retina ni osteomas típicos de Gardner.",
        "B": "Gen PTEN: Síndrome de Cowden (pólipos hamartomatosos, triquilemomas faciales y alto riesgo de cáncer de mama y tiroides).",
        "D": "Gen p53: Síndrome de Li-Fraumeni (sarcomas, cáncer de mama, tumores cerebrales y corticosuprarrenales)."
    },
    "anki": "**Frente:** Cientos de pólipos adenomatosos en colon + osteomas mandibulares + hipertrofia congénita de retina (CHRPE) → Síndrome y gen mutado:\n**Reverso:** **Síndrome de Gardner** (variante de PAF) → **Gen APC** (autosómico dominante, cromosoma 5q)."
}

# Q29 (Acierto frágil · Esófago de Barrett)
CLINICAL_DATA[26] = {
    "enun_bold": "Un hombre de 60 años de edad refiere pirosis diaria desde la juventud que trata con alcalinos... endoscopia que muestra unión escamosa columnar desplazada 7 cm... Las biopsias revelan epitelio columnar de tipo intestinal con **displasia de bajo grado**. ¿Cuál es la opción más apropiada para el manejo de este paciente?",
    "espejo": {
        "premisa": "Acertaste de lleno que una displasia de bajo grado no requiere esofaguectomía quirúrgica agresiva.",
        "trampa": "Dudabas sobre la necesidad de seguimiento indefinido; el esófago de Barrett con displasia de bajo grado exige tratamiento antisecretor potente continuo con IBP y vigilancia endoscópica periódica con biopsias dirigidas cada 6 meses (o ablación por radiofrecuencia).",
        "regla": "Esófago de Barrett: Sin displasia -> IBP + eco/endoscopia cada 3-5 años. Displasia bajo grado -> IBP continuo + endoscopias de vigilancia periódicas (o radiofrecuencia). Displasia alto grado -> Ablación endoscópica (o esofaguectomía si multifocal/invasivo)."
    },
    "descartes": {
        "A": "Continuar solo con alcalinos: Insuficiente; los antiácidos no revierten el ácido nocturno ni previenen la progresión displásica.",
        "B": "IBP altas dosis sin vigilancia endoscópica: Falso; ningún fármaco elimina totalmente el riesgo de adenocarcinoma, por lo que la vigilancia endoscópica es obligada.",
        "C": "IBP por menos de 12 semanas por miedo a gastrinomas: Falso; los IBP son seguros a largo plazo y no causan gastrinomas.",
        "E": "Esofaguectomía: Desproporcionada; asocia alta mortalidad y se reserva a displasia de alto grado refractaria o adenocarcinoma invasivo."
    },
    "anki": "**Frente:** Paciente con Esófago de Barrett y displasia de BAJO grado confirmada por patólogo experto → Actitud terapéutica y de control:\n**Reverso:** **Tratamiento indefinido con IBP a dosis altas + vigilancia endoscópica periódica reglada** (o ablación con radiofrecuencia)."
}

# Q31 (Acierto frágil · Complicaciones EII en Varones)
CLINICAL_DATA[27] = {
    "enun_bold": "Varón de 42 años con **colitis ulcerosa** diagnosticada 16 meses antes... Dado que las complicaciones extradigestivas parecen estar relacionadas con la intensidad de la inflamación, explicaremos al paciente la importancia de cumplir el tratamiento... En relación con estas últimas, ¿cuál es la **complicación extraintestinal MÁS típica en varones con colitis ulcerosa**?",
    "consolidacion": "La complicación extraintestinal hepatobiliar MÁS TÍPICA en varones jóvenes (alrededor de 40 años) con colitis ulcerosa es la Colangitis Esclerosante Primaria (CEP). Hasta el 70-80% de los pacientes con CEP padecen colitis ulcerosa subyacente. Además, es independiente del curso del brote.",
    "descartes": {
        "A": "Uveítis: Más frecuente en mujeres y mucho menos prevalente que las afecciones articulares o hepatobiliares.",
        "C": "Artropatía periférica: Es la más FRECUENTE en cifras absolutas globales, pero la pregunta enfatiza específicamente la más «TÍPICA en VARONES» jóvenes como asociación sindrómica clásica.",
        "D": "Anemia hemolítica: Es una complicación inmune infrecuente no ligada de forma preponderante al sexo masculino."
    },
    "anki": "**Frente:** Complicación extraintestinal hepatobiliar más típica y característica en VARONES jóvenes (~40 años) afectos de Colitis Ulcerosa:\n**Reverso:** **Colangitis Esclerosante Primaria (CEP)** (curso independiente de la actividad inflamatoria del colon)."
}

# Q32 (Fallo · Complicaciones cirrosis / Diagnóstico diferencial neurológico)
CLINICAL_DATA[28] = {
    "enun_bold": "¿Cuál de los siguientes procesos es **MENOS probable** en un paciente con cirrosis alcohólica que traen a Urgencias por letargo y confusión moderada?",
    "concepto_clave": "El Síndrome de Mielinólisis Pontina (Mielinólisis Central Pontina) es una complicación IATRÓGENA que aparece tras corregir bruscamente una hiponatremia grave con sueros salinos hipertónicos en el hospital (típicamente 2-6 días después), manifestándose como tetraparesia flácida y parálisis seudobulbar (síndrome de cautiverio). Es imposible que un paciente que llega de la calle sin tratamiento previo debute con este cuadro.",
    "descartes": {
        "B": "Encefalopatía hepática: La causa más común de confusión en un cirrótico descompensado.",
        "C": "Encefalopatía hipoglucémica: Típica en alcohólicos crónicos por depleción de glucógeno y bloqueo de la gluconeogénesis hepática por el etanol.",
        "D": "Hematoma subdural: Extremadamente frecuente en alcohólicos por caídas de repetición unidas a la coagulopatía y trombopenia de la cirrosis."
    },
    "anki": "**Frente:** Cirrótico alcohólico traído de la calle a Urgencias con confusión aguda → ¿Por qué la mielinólisis pontina es la MENOS probable?\n**Reverso:** **Porque es una complicación iatrogénica intrahospitalaria** causada por la corrección excesivamente rápida de hiponatremia grave."
}

# Q33 (Fallo · Hepatitis Alcohólica Aguda)
CLINICAL_DATA[29] = {
    "enun_bold": "Mujer de 50 años que acude a Urgencias por astenia, ictericia, **fiebre (38,5 ºC)** y dolor abdominal. **Consumo de 60 g/día de alcohol incrementado en el último mes**. En exploración: **desorientación, asterixis, ictericia y hepatomegalia dolorosa**. Analítica: **leucocitos 15.000 (90% PMN), VCM 115 fl, bilirrubina 15 mg/dl, AST (GOT) 300 U/l, ALT (GPT) 120 U/l (cociente GOT/GPT >2)**, TP alargado >50%. ¿Cuál es el diagnóstico MÁS probable?",
    "concepto_clave": "El cuadro clínico de fiebre + ictericia + hepatomegalia dolorosa + leucocitosis neutrofílica intensa con transaminasas moderadas (<300-500) y cociente GOT/GPT > 2 en paciente que ha disparado la ingesta etílica es el sello indiscutible de la HEPATITIS ALCOHÓLICA AGUDA. La asterixis y la prolongación del TP indican gravedad extrema (Maddrey ≥32).",
    "descartes": {
        "A": "Colecistitis aguda: No explica el cociente GOT/GPT >2, la macrocitosis (VCM 115) ni la encefalopatía hepática con asterixis.",
        "B": "Colangitis aguda: La tríada de Charcot tiene dolor cólico biliar e ictericia con patrón de colestasis disociada (FA/GGT desorbitadas), no hepatomegalia dolorosa difusa por necrosis alcohólica.",
        "D": "Pancreatitis aguda: Cursaría con dolor epigástrico transfictivo hacia la espalda y elevación de amilasa/lipasa >3 veces el límite superior, sin hepatomegalia dolorosa masiva."
    },
    "anki": "**Frente:** Fiebre + hepatomegalia dolorosa + ictericia + leucocitosis neutrofílica + cociente transaminasas GOT/GPT > 2 tras atracón etílico → Diagnóstico:\n**Reverso:** **Hepatitis alcohólica aguda** (evaluar gravedad con índice de Maddrey para indicar corticoides)."
}

# Q34 (Acierto frágil · Diarrea crónica / Datos de alarma)
CLINICAL_DATA[30] = {
    "enun_bold": "Varón de 42 años... **astenia, dolor abdominal difuso y diarrea crónica (4-5 deposiciones/día) de 1 año de evolución**. En este tiempo ha **perdido 7 kg de peso**. Analítica: **Hb 10,5 g/dL, ferritina < 6**. Coprocultivo y parásitos negativos. Con respecto a este caso, señale la afirmación **CORRECTA**:",
    "consolidacion": "La presencia de pérdida involuntaria de peso de 7 kg y anemia ferropénica marcada (ferritina <6) en un varón joven son «banderas rojas» (datos de alarma clínicos y analíticos) que obligan a descartar causa orgánica (celiaquía, EII o neoplasia) mediante serología celíaca (anti-TG IgA), calprotectina fecal y sangre oculta en heces.",
    "descartes": {
        "A": "Tratamiento sintomático por no tener datos de alarma: Falso; la anemia ferropénica y la pérdida de 7 kg son datos de alarma mayores inequívocos.",
        "B": "Diagnóstico de síndrome de intestino irritable: Error grave; el SII es un diagnóstico de exclusión que exige por definición la AUSENCIA de anemia y pérdida de peso.",
        "D": "Hierro oral y esperar 3 meses: Falso; en un varón la ferropenia sin sangrado visible exige estudio digestivo endoscópico y serológico sin demoras."
    },
    "anki": "**Frente:** Diarrea crónica de 1 año con pérdida de 7 kg de peso y anemia ferropénica en varón de 42 años → Actitud correcta:\n**Reverso:** **Ampliar estudio de organicidad (anti-TG IgA, calprotectina fecal, SOH y colonoscopia)** (prohibido etiquetar de SII ante datos de alarma)."
}

# Q35 (Acierto frágil · Barrett con displasia leve / Intervalo)
CLINICAL_DATA[31] = {
    "enun_bold": "Un paciente le consulta para pedir segunda opinión porque en una endoscopia realizada en otro centro le han diagnosticado de **esófago de Barrett con displasia leve**. ¿Cuándo indicaría la siguiente endoscopia?",
    "consolidacion": "En el esófago de Barrett con displasia de bajo grado (leve) confirmada por un patólogo experto de referencia, el intervalo estándar de revisión endoscópica con toma de biopsias en los cuatro cuadrantes cada 1-2 cm es a los 6 MESES (o plantear tratamiento ablativo con radiofrecuencia).",
    "descartes": {
        "B": "A los dos años: Intervalo excesivamente largo; el riesgo de progresión a displasia de alto grado/adenocarcinoma exige control semestral.",
        "C": "A los tres años: Es el intervalo para Barrett metaplásico SIN displasia.",
        "D": "A los cinco años: Intervalo para Barrett de segmento corto (<3 cm) sin displasia."
    },
    "anki": "**Frente:** Intervalo de vigilancia endoscópica recomendado en Esófago de Barrett con DISPLASIA LEVE (bajo grado):\n**Reverso:** **A los 6 meses** (con biopsias en 4 cuadrantes cada 1-2 cm o considerar ablación por radiofrecuencia)."
}

# Q36 (Acierto frágil · Cribado CCR en Colitis Ulcerosa)
CLINICAL_DATA[32] = {
    "enun_bold": "Paciente de 32 años con **colitis ulcerosa extensa de 10 años de evolución**, en remisión clínica y endoscópica, sin displasia en colonoscopias previas. ¿Cree que debe realizarse **colonoscopias de revisión para la vigilancia endoscópica del cáncer colorrectal**?",
    "consolidacion": "Todo paciente con colitis ulcerosa extensa (pancolitis) debe iniciar el programa de cribado de cáncer colorrectal a los 8-10 años del diagnóstico, independientemente de que se encuentre en remisión asintomática. La técnica de elección es la colonoscopia con cromoendoscopia y toma de biopsias dirigidas cada 3-5 años.",
    "descartes": {
        "A": "No precisa vigilancia hasta los 20 años: Falso; a los 20 años de evolución el riesgo acumulado de CCR ya supera el 5-10%, por lo que el cribado empieza a los 8-10 años.",
        "C": "Solo si presenta antecedentes familiares: Falso; la inflamación crónica mucosal per se es un factor carcinogénico de primer orden.",
        "D": "Biopsia aleatoria ha sustituido a cromoendoscopia: Al contrario, la cromoendoscopia dirigida ha desplazado a las biopsias a ciegas aleatorias (cuadrantes cada 10 cm)."
    },
    "anki": "**Frente:** Paciente con colitis ulcerosa extensa (pancolitis) de 8-10 años de evolución → Protocolo de vigilancia de cáncer colorrectal:\n**Reverso:** **Colonoscopia con cromoendoscopia y biopsias dirigidas cada 3-5 años** (incluso en remisión completa)."
}

# Q37 (Acierto frágil · Causas de Disfagia Orofaríngea)
CLINICAL_DATA[33] = {
    "enun_bold": "La **disfagia orofaríngea** es la dificultad de trasladar el alimento desde la cavidad oral hasta el esófago proximal. Entre las causas de disfagia orofaríngea motora están las siguientes **EXCEPTO**:",
    "consolidacion": "La disfagia orofaríngea (dificultad para iniciar la deglución con atragantamiento inmediato, tos y regurgitación nasal) se debe a trastornos neurológicos o miopáticos del músculo esquelético/estriado orofaríngeo (miastenia gravis, tétanos, ELA, dermatomiositis, ACV). El reflujo gastroesofágico causa disfagia esofágica baja por estenosis péptica en músculo liso distal.",
    "descartes": {
        "A": "Miastenia gravis: Causa típica de disfagia orofaríngea fluctuante por afectación de la placa motora faríngea.",
        "C": "Tétanos: El trismo y espasmo faríngeo producen disfagia orofaríngea severa.",
        "D": "Dermatopolimiositis: Afecta selectivamente a la musculatura estriada de la faringe y tercio superior del esófago."
    },
    "anki": "**Frente:** ¿Por qué el reflujo gastroesofágico (RGE) NO produce disfagia orofaríngea motora?\n**Reverso:** **Porque el RGE afecta al esófago distal (músculo liso)**; la disfagia orofaríngea afecta al inicio deglutorio y a la musculatura estriada faríngea."
}

# Q38 (Fallo · Cáncer Colorrectal metastásico MSI-H)
CLINICAL_DATA[34] = {
    "enun_bold": "En un paciente con **cáncer colorrectal metastásico irresecable RAS nativo y con pérdida de expresión de proteínas reparadoras del ADN (MSI-H / dMMR)**. ¿Cuál debe ser el **tratamiento de elección de primera línea**?",
    "concepto_clave": "El ensayo KEYNOTE-177 demostró que en el cáncer colorrectal metastásico con inestabilidad de microsatélites alta (MSI-H o deficiencia en reparación de emparejamientos dMMR), la INMUNOTERAPIA con inhibidores de punto de control (pembrolizumab en monoterapia) dobla la supervivencia libre de progresión frente a la quimioterapia clásica y se establece como el estándar absoluto de primera línea.",
    "descartes": {
        "A": "Quimioterapia + Anti-EGFR (cetuximab/panitumumab): Es el estándar en RAS nativo si los microsatélites son ESTABLES (MSS), pero en MSI-H la inmunoterapia es drásticamente superior y la primera opción obligada.",
        "C": "Quimioterapia sola (FOLFOX/FOLFIRI): Los tumores MSI-H son intrínsecamente quimiorresistentes a 5-FU en comparación con la inmunoterapia.",
        "D": "Quimioterapia + Anti-VEGFR (bevacizumab): Terapia clásica para tumores MSS o con mutación BRAF/RAS, desplazada en MSI-H."
    },
    "anki": "**Frente:** Cáncer de colon metastásico irresecable con inestabilidad de microsatélites alta (MSI-H / dMMR) → Tratamiento de PRIMERA LÍNEA de elección:\n**Reverso:** **Inmunoterapia (Pembrolizumab)** (muy superior a la quimioterapia con doblete + biológico)."
}

print("Batch 3 (Q26-Q38) ready")

# Q39 (Fallo · Tumores neuroendocrinos gástricos / Microcarcinoides)
CLINICAL_DATA[35] = {
    "enun_bold": "Hombre de 45 años tras extirpación endoscópica de **al menos 7 pólipos gástricos de 1-2 mm**. AP: **gastritis crónica con marcada atrofia corporal y metaplasia intestinal, y focos de microcarcinoide** en cuerpo y fundus. Indique la afirmación **CORRECTA**:",
    "concepto_clave": "Los tumores carcinoides gástricos tipo 1 (70-80%) se originan por hipergastrinemia secundaria a aclorhidria/atrofia del cuerpo (anemia perniciosa). La gastrina producida por las células G del antro estimula de forma crónica la hiperplasia y degeneración de las células ECL corporales. Por ello, si son múltiples o recidivan y requieren cirugía, la técnica indicada es la GASTRECTOMÍA DISTAL (ANTRECTOMÍA), ya que al eliminar las células G productoras de gastrina cesa el estímulo trófico.",
    "descartes": {
        "A": "Cursa con hipogastrinemia: Falso; cursa con hipergastrinemia masiva reactiva a la falta de ácido clorhídrico.",
        "B": "La metaplasia intestinal obliga a gastrectomía: Falso; la metaplasia intestinal solo requiere vigilancia endoscópica, nunca resección gástrica preventiva.",
        "D": "Tratamiento con análogos de la somatostatina: Falso; la somatostatina se reserva para tumores neuroendocrinos metastásicos o síndrome carcinoide funcionante, no para microcarcinoides gástricos tipo 1 benignos resecables."
    },
    "anki": "**Frente:** ¿Cuál es la cirugía indicada en microcarcinoides gástricos tipo 1 múltiples asociados a gastritis atrófica si fracasa el control endoscópico?\n**Reverso:** **Antrectomía (gastrectomía distal)** (elimina las células G que producen la hipergastrinemia trófica sobre las células ECL)."
}

# Q40 (Acierto frágil · Isquemia mesentérica aguda)
CLINICAL_DATA[36] = {
    "enun_bold": "Paciente de 67 años ingresa por presentar bruscamente hace 1,5 horas **dolor abdominal periumbilical constante**... antecedentes de **fibrilación auricular paroxística**... exploración con corazón arrítmico a 135 lpm y **abdomen blando con ruidos conservados pero dolor desproporcionado**. ¿Cuál de las siguientes pruebas le daría MÁS información?",
    "espejo": {
        "premisa": "Identificaste de forma inmediata la sospecha de isquemia mesentérica aguda de origen embólico por la FA y acertaste marcando la arteriografía.",
        "trampa": "Dudabas si el Angio-TC era la única opción; en la pregunta clásica MIR la arteriografía mesentérica aporta la máxima información diagnóstica y terapéutica (permite infundir vasodilatadores como papaverina o realizar embolectomía percutánea).",
        "regla": "Dolor periumbilical atroz con exploración física abdominal anodina («dolor desproporcionado a los hallazgos») en paciente con arritmia (FA) = ISQUEMIA MESENTÉRICA AGUDA EMBÓLICA hasta demostrar lo contrario."
    },
    "descartes": {
        "A": "Ecografía abdominal: Totalmente inútil por la interposición de gas intestinal y baja resolución de ramas arteriales mesentéricas.",
        "B": "TC abdominal simple sin contraste vascular: No define la luz arterial de la AMS ni la viabilidad de la mucosa.",
        "C": "Gastroscopia: Solo explora estómago y duodeno proximal; no evalúa vascularización mesentérica ni asas de delgado."
    },
    "anki": "**Frente:** Dolor abdominal periumbilical brusco desproporcionado a la exploración física en paciente con fibrilación auricular → Diagnóstico y prueba más resolutiva:\n**Reverso:** **Isquemia mesentérica aguda embólica** → **Angio-TC / Arteriografía mesentérica** (visualiza el stop de flujo en AMS)."
}

# Q41 (Acierto frágil · Neoplasia de colon no obstructiva)
CLINICAL_DATA[37] = {
    "enun_bold": "º 2. En el paciente anterior (con síndrome constitucional, **anemia microcítica sin sintomatología obstructiva**), cuál sería la **actitud a seguir a continuación**:",
    "espejo": {
        "premisa": "Razonaste que la sonda rectal o el stent no tienen ningún sentido en colon derecho no oclusivo y acertaste la colonoscopia diagnóstica.",
        "trampa": "Pensaste en colocar un stent («yo le pondría un stent también»); los stents colónicos están indicados en tumores obstructivos de COLON IZQUIERDO para evitar colostomía urgente, jamás en tumores de ciego/colon derecho sin obstrucción.",
        "regla": "Sospecha de neoplasia colorrectal hemodinámicamente estable sin perforación ni obstrucción aguda = Pancolonoscopia con toma de biopsias para confirmación histológica."
    },
    "descartes": {
        "A": "Sonda nasogástrica: Solo indicada si existe vómito y distensión por obstrucción intestinal mecánica franca.",
        "B": "Drenaje percutáneo: Indicado para colecciones de pus o abscesos intraabdominales (diverticulitis Hinchey II, apendicitis coleccionada).",
        "D": "Sonda rectal: Absurda en colon derecho; solo descomprime la ampolla rectal y sigma bajo en vólvulos o fecalomas."
    },
    "anki": "**Frente:** Paciente con sospecha clínica de neoplasia de colon derecho por anemia ferropénica y síndrome constitucional sin oclusión → Primer paso:\n**Reverso:** **Pancolonoscopia total con toma de biopsias** (diagnóstico histológico antes de estadificar y operar)."
}

# Q42 (Acierto frágil · Cirugía en EII / Diferencias CU vs Crohn)
CLINICAL_DATA[38] = {
    "enun_bold": "En relación con las **indicaciones de cirugía en la enfermedad inflamatoria intestinal**, señalar la respuesta **INCORRECTA**:",
    "consolidacion": "La Colitis Ulcerosa es una enfermedad exclusiva de la mucosa colónica y rectal. Por ello, la cirugía con intención curativa exige una PROCTOCOLECTOMÍA TOTAL con reservorio ileoanal en J. Hacer una resección segmentaria del colon en CU es un error garrafal, porque la mucosa remanente enferma inexorablemente y persiste el riesgo de degeneración neoplásica. En cambio, en la Enfermedad de Crohn las resecciones deben ser estrictamente segmentarias y lo más conservadoras posible para evitar el intestino corto.",
    "descartes": {
        "A": "Muchos pacientes con Crohn requieren cirugía: Cierto; hasta un 70-80% se operan de complicaciones a lo largo de su vida.",
        "B": "Indicaciones de Crohn se limitan a complicaciones: Cierto; no se opera para «curar» la enfermedad, solo ante estenosis, fístulas o abscesos refractarios.",
        "C": "Megacolon tóxico refractario requiere cirugía: Cierto; la perforación ensombrece drásticamente el pronóstico.",
        "E": "Espondilitis anquilosante y daño hepático no remiten tras cirugía: Cierto; son manifestaciones independientes del curso intestinal."
    },
    "anki": "**Frente:** ¿Por qué en la Colitis Ulcerosa la cirugía curativa exige PROCTOCOLECTOMÍA TOTAL y no resección segmentaria?\n**Reverso:** **Porque la CU afecta difusamente al colon y recto**; dejar recto o colon residual mantiene la enfermedad y el riesgo de cáncer."
}

# Q44 (Fallo · Megacolon tóxico urgente / Cirugía)
CLINICAL_DATA[39] = {
    "enun_bold": "La **cirugía de elección** en un paciente con un brote grave de colitis ulcerosa que desarrolla un **megacolon tóxico** es:",
    "concepto_clave": "En la urgencia vital del megacolon tóxico, el paciente está séptico y desnutrido con un colon friable a punto de estallar. La intervención más rápida y segura que salva la vida es la COLECTOMÍA TOTAL CON ILEOSTOMÍA TERMINAL (y cierre o fístula mucosa del muñón rectal tipo Hartmann). Jamás se realiza una anastomosis primaria (ileorrectal o reservorio) en este contexto porque la tasa de dehiscencia y muerte por peritonitis fecaloidea es inasumible.",
    "descartes": {
        "A": "Proctocolectomía total + reservorio ileoanal urgente: Reservada para cirugía electiva programada en paciente estable y sin corticoides.",
        "B": "Proctocolectomía total + ileostomía: Resecar el recto en una pelvis inflamada y séptica en urgencias prolonga innecesariamente el tiempo quirúrgico y multiplica el sangrado.",
        "D": "Colectomía total + anastomosis ileorrectal: Hacer una sutura (anastomosis) sobre un recto gravemente inflamado en un paciente séptico está formalmente proscrito (dehiscencia segura)."
    },
    "anki": "**Frente:** Cirugía de elección URGENTE en un brote de colitis ulcerosa complicado con MEGACOLON TÓXICO refractario:\n**Reverso:** **Colectomía total con ileostomía terminal y fístula mucosa rectal (Hartmann)** (sin anastomosis primaria)."
}

# Q45 (Acierto frágil · Hemorragia digestiva alta / Forrest IIa)
CLINICAL_DATA[40] = {
    "enun_bold": "Hombre de 43 años... 4 deposiciones melénicas en 12 horas tras toma de AINEs. TA 95/65, FC 110. Tras estabilización, la endoscopia urgente muestra úlcera de 2 cm en antro gástrico con coágulo y protuberancia blanco-grisácea de 3 mm en el centro (**trombo plaquetar o «vaso visible» - Forrest IIa**). ¿Qué actitud le parece más correcta?",
    "consolidacion": "La úlcera péptica con vaso visible no sangrante (clasificación Forrest IIa) presenta un riesgo de resangrado espontáneo del 40-50%. El estándar de oro terapéutico obligado es la terapia endoscópica combinada (inyección de adrenalina + método mecánico con clips o térmico) asociada a perfusión de IBP a dosis altas durante 72 horas.",
    "descartes": {
        "A": "Alta precoz con IBP oral: Gravísima negligencia; una úlcera Forrest IIa tiene casi 50% de resangrado y mortalidad si no se trata endoscópicamente.",
        "B": "Retirar endoscopio y poner sonda nasogástrica: La SNG no coagula ni previene el sangrado de una arteria visible.",
        "C": "Tomar biopsia y tratamiento médico solo: Desprendería el trombo plaquetario provocando una hemorragia pulsátil cataclísmica.",
        "D": "Cirugía urgente directa: Solo se indica si fracasan dos intentos consecutivos de hemostasia endoscópica."
    },
    "anki": "**Frente:** Úlcera gástrica con vaso visible no sangrante (Forrest IIa) en endoscopia digestiva urgente → Manejo obligado:\n**Reverso:** **Terapia endoscópica dual (adrenalina + clips/termocoagulación) + IBP intravenosos a dosis altas**."
}

# Q46 (Acierto frágil · Obstrucción de intestino delgado)
CLINICAL_DATA[41] = {
    "enun_bold": "º 1. Mujer de 83 años con antecedente de **herniorrafia inguinal bilateral**... dolor cólico con náuseas, vómitos y estreñimiento de 48h. Abdomen distendido sin peritonismo. Analítica: alcalosis hipopotasémica. Rx de abdomen: **dilatación de asas de intestino delgado con ausencia de gas en marco cólico**. Su sospecha diagnóstica sería:",
    "espejo": {
        "premisa": "Acertaste la opción de obstrucción mecánica a nivel de íleon.",
        "trampa": "Dudaste diciendo que era «un cuadro raro que no sé explicar»; es el caso más canónico de la medicina: antecedente de cirugía abdominal previa (bridas) + clínica oclusiva + radiografía con asas centrales en pila de monedas y ausencia de gas en ampolla rectal.",
        "regla": "Cirugía abdominal previa + parada de heces y gases con vómitos + Rx con dilatación de delgado y marco cólico vacío = Obstrucción mecánica de intestino delgado por BRIDAS/ADHERENCIAS."
    },
    "descartes": {
        "A": "Estreñimiento por hierro: El hierro produce heces duras y oscuras, nunca dilatación masiva de delgado con niveles hidroaéreos y vómitos.",
        "B": "Pancreatitis aguda: Presenta dolor epigástrico transfictivo y amilasa >3 veces el valor normal (aquí solo está discretamente elevada a 150 por la oclusión).",
        "D": "Íleo paralítico: Cursa con silencio auscultatorio y presencia de gas repartido por TODO el tubo digestivo (delgado y colon)."
    },
    "anki": "**Frente:** Paciente con cirugía abdominal previa que presenta vómitos, distensión y Rx con dilatación de delgado sin gas en colon → Causa más frecuente:\n**Reverso:** **Obstrucción intestinal mecánica por bridas / adherencias peritoneales** (íleon distal)."
}

# Q47 (Acierto frágil · Acalasia tipo III)
CLINICAL_DATA[42] = {
    "enun_bold": "Varón de 48 años... **disfagia progresiva a casi todo (sólidos y líquidos) desde hace seis meses**, dolor opresivo precordial, pérdida de 6 kg. Gastroscopia normal. **Manometría: relajación incompleta del EEI y contracciones prematuras espásticas en el cuerpo esofágico en el 50% de las degluciones**. ¿Cuál sería su sospecha diagnóstica?",
    "consolidacion": "Según la Clasificación de Chicago para trastornos motores esofágicos: Relajación integrada del EEI patológica (IRP elevado >15 mmHg) + contracciones prematuras espásticas (DL <4,5s) en >20% de las degluciones define de forma estricta la ACALASIA TIPO III (antigua acalasia vigorosa o espástica).",
    "descartes": {
        "A": "Espasmo esofágico distal/difuso: En el espasmo la relajación del EEI es NORMAL (IRP conservado); solo hay espasmo en el cuerpo esofágico.",
        "B": "Acalasia tipo I (clásica): Cursa con ausencia completa de contractilidad esofágica (aperistalsis sin presurización pan-esofágica).",
        "D": "Esclerodermia: Cursa con hipotonía y apertura patológica del EEI (hipotonía de músculo liso) con reflujo severo, no con hipertonía o contracciones espásticas."
    },
    "anki": "**Frente:** Disfagia mixta + dolor torácico + manometría de alta resolución con relajación incompleta del EEI y contracciones prematuras/espásticas (>20%) → Diagnóstico:\n**Reverso:** **Acalasia Tipo III (espástica)**."
}

# Q48 (Acierto frágil · Colangitis aguda litiásica)
CLINICAL_DATA[43] = {
    "enun_bold": "Varón de 75 años colecistectomizado hace 10 años... **dolor progresivo en hipocondrio derecho desde hace 48 horas, náuseas, vómitos y fiebre de 39 ºC**. Analítica: **leucocitos 20.000 con neutrofilia, PCR 100, bilirrubina total 6 mg/dL**, FA 400, GGT 200. Ecografía: vía biliar dilatada. ¿Cuál sería la sospecha diagnóstica?",
    "consolidacion": "El paciente presenta la clásica TRÍADA DE CHARCOT: 1. Dolor en hipocondrio derecho + 2. Ictericia obstructiva (bilirrubina 6 con FA/GGT disparadas) + 3. Fiebre alta en picos (39 ºC con leucocitosis 20.000). Es la definición patognomónica de COLANGITIS AGUDA bacteriana.",
    "descartes": {
        "A": "Colecistitis aguda: El paciente está colecistectomizado hace 10 años; no puede tener colecistitis por ausencia anatómica de vesícula biliar.",
        "B": "Coledocolitiasis no complicada: Cursa con cólico biliar e ictericia, pero SIN fiebre alta de 39 ºC ni leucocitosis neutrofílica severa.",
        "D": "Pancreatitis aguda: La lipasa sérica es estrictamente normal (16 U/L)."
    },
    "anki": "**Frente:** Dolor en hipocondrio derecho + Ictericia + Fiebre alta de 39 ºC con leucocitosis en anciano colecistectomizado → Sospecha:\n**Reverso:** **Colangitis aguda bacteriana** (Tríada de Charcot; requiere antibioterapia urgente y descompresión biliar por CPRE)."
}

# Q49 (Acierto frágil · Leiomioma esofágico)
CLINICAL_DATA[44] = {
    "enun_bold": "Los **tumores benignos MÁS frecuentes del esófago** son:",
    "consolidacion": "El tumor benigno esofágico más frecuente con diferencia (más del 60% de las lesiones benignas) es el LEIOMIOMA. Se origina en la capa muscular propia, predomina en los dos tercios distales del esófago y típicamente se observa como una lesión submucosa redondeada y bien delimitada con mucosa suprayacente sana en la endoscopia y ecoendoscopia.",
    "descartes": {
        "A": "Pólipos fibrovasculares: Infrecuentes; son lesiones pedunculadas intraluminales del esófago cervical que pueden regurgitarse hacia la orofaringe.",
        "C": "Papilomas escamosos: Lesiones epiteliales verrucosas raras ligadas ocasionalmente al VPH o reflujo crónico.",
        "D": "Hemangiomas: Lesiones vasculares muy infrecuentes en el esófago."
    },
    "anki": "**Frente:** ¿Cuál es el tumor benigno más frecuente del esófago y de qué capa histológica procede?\n**Reverso:** **Leiomioma esofágico** (procede de la capa muscular propia; submucoso)."
}

# Q50 (Acierto frágil · Cirrosis terminal / Indicación de Trasplante)
CLINICAL_DATA[45] = {
    "enun_bold": "Mujer de 52 años, con **cirrosis biliar primaria (colangitis biliar primaria)** de 15 años de evolución, estadio IV, y varios episodios de **encefalopatía hepática y ascitis**, que acude por **sangrado por varices esofágicas**, ascitis moderada y albúmina 2,3 g/dL. Una vez resuelto el episodio de sangrado, ¿qué medida terapéutica recomendaría?",
    "consolidacion": "La paciente presenta una hepatopatía terminal descompensada con múltiples fallos orgánicos (ascitis, encefalopatía, hemorragia varicosa e hipoalbuminemia grave = Child-Pugh C). Ningún fármaco médico puede revertir esta fase fibrótica terminal; la única medida curativa que prolonga la supervivencia es el TRASPLANTE HEPÁTICO.",
    "descartes": {
        "B": "D-penicilamina: Quelante de cobre usado en la enfermedad de Wilson, totalmente ineficaz en CBP.",
        "C": "Esteroides: Ineficaces en la cirrosis biliar primaria y agravan de forma crítica la osteoporosis que sufren estas pacientes.",
        "D": "Ácido ursodesoxicólico (AUDC): Es el tratamiento farmacológico de elección en fases precoces de la CBP para retrasar la progresión, pero en cirrosis terminal descompensada no evita el trasplante."
    },
    "anki": "**Frente:** Paciente con cirrosis por colangitis biliar primaria que ha desarrollado ascitis, encefalopatía y hemorragia varicosa (Child C) → Tratamiento definitivo:\n**Reverso:** **Trasplante hepático** (única terapia que prolonga la supervivencia en hepatopatía terminal descompensada)."
}

# Q51 (Acierto frágil · Profilaxis postexposición VHB)
CLINICAL_DATA[46] = {
    "enun_bold": "Acude a consulta un hombre de 70 años refiriendo que hace una hora se ha **pinchado de forma accidental en el parque con una aguja con restos de sangre**. El paciente **no ha padecido hepatitis B ni ha recibido vacunación previa**. ¿Cuál es la actitud MÁS correcta?",
    "consolidacion": "Tras una exposición accidental percutánea a sangre potencialmente infectada por VHB en una persona susceptible no vacunada, se debe instaurar INMEDIATAMENTE inmunoprofilaxis combinada PASIVA + ACTIVA: 1 dosis de Inmunoglobulina específica anti-VHB (máximo en las primeras 24-72h) + pauta de Vacunación completa (0, 1 y 6 meses).",
    "descartes": {
        "A": "Gammaglobulina + solo una dosis de vacuna: Falso; una sola dosis de vacuna no confiere títulos protectores de anti-HBs a largo plazo; la vacunación debe ser completa.",
        "C": "Gammaglobulina y antisepsia sin vacuna: Falso; la inmunoglobulina solo confiere protección pasiva transitoria durante 3-4 semanas; sin vacuna el paciente queda desprotegido.",
        "D": "Vacunación completa sin gammaglobulina: Error; la vacuna tarda varias semanas en generar anticuerpos protectores, por lo que en las primeras semanas el virus puede infectar los hepatocitos si no se neutraliza con inmunoglobulina."
    },
    "anki": "**Frente:** Pinchazo accidental con aguja con restos biológicos en individuo NO vacunado ni inmune frente a VHB → Protocolo de profilaxis postexposición:\n**Reverso:** **Inmunoglobulina anti-VHB (inmunoprofilaxis pasiva inmediata) + Pauta de vacunación completa (0, 1 y 6 meses)**."
}

# Q52 (Fallo · Coledocolitiasis / Algoritmo diagnóstico)
CLINICAL_DATA[47] = {
    "enun_bold": "Paciente de 45 años con colecistitis previa y colelitiasis vesicular conocida... Ahora presenta **fosfatasa alcalina alta** y en ecografía litiasis vesiculares con **vía biliar dilatada a 1 cm de diámetro sin visualizarse cálculo**. ¿Qué exploración de las siguientes realizaría **antes de la intervención quirúrgica**?:",
    "espejo": {
        "premisa": "Sabías que la CPRE es el procedimiento terapéutico estándar de la coledocolitiasis.",
        "trampa": "Marcaste CPRE de forma precipitada («la marco porque es la típica pero no sé qué quiero ver»); el paciente tiene una PROBABILIDAD INTERMEDIA de coledocolitiasis (FA alta y colédoco dilatado >6 mm, pero sin ictericia franca, colangitis ni cálculo visible). En probabilidad intermedia, la prueba de elección es la COLANGIO-RM o la ecoendoscopia para confirmar antes de someter al paciente a los riesgos de la CPRE (pancreatitis 5-10%).",
        "regla": "Sospecha de coledocolitiasis: Alta (cálculo en eco o colangitis) -> CPRE directa. Intermedia (colédoco dilatado o alteración analítica aislada) -> Colangio-RM o Ecoendoscopia previa."
    },
    "descartes": {
        "A": "CPRE: Es invasiva y conlleva un 5-10% de riesgo de pancreatitis aguda; no se debe realizar con fines puramente diagnósticos en probabilidad intermedia.",
        "B": "Ecoendoscopia: Excelente opción diagnóstica equivalente a la CRM, pero en el examen MIR ante vía biliar dilatada la Colangiorresonancia es la técnica no invasiva de referencia.",
        "C": "Colangiografía transparietohepática (CTPH): Indicada exclusivamente cuando la vía biliar está muy dilatada y la CPRE ha fracasado o la anatomía está alterada (gastrectomía previa Billroth II o Y de Roux)."
    },
    "anki": "**Frente:** Paciente con litiasis vesicular y sospecha INTERMEDIA de coledocolitiasis (colédoco dilatado 1 cm pero sin cálculo visible ni colangitis) → Siguiente paso:\n**Reverso:** **Colangiorresonancia magnética (o ecoendoscopia)** (confirmar cálculo antes de indicar CPRE terapéutica invasiva)."
}

# Q53 (Acierto frágil · Divertículo de Zenker)
CLINICAL_DATA[48] = {
    "enun_bold": "¿Cuál de las siguientes afirmaciones es **CORRECTA** en relación con el **divertículo faringoesofágico de Zenker**?",
    "consolidacion": "El divertículo de Zenker es un pseudodivertículo por PULSIÓN que se hernia en la pared posterior de la hipofaringe a través del TRIÁNGULO DE KILLIAN (área de debilidad entre las fibras tirofaríngeas y cricofaríngeas del músculo constrictor inferior). Su tríada clínica característica en ancianos es: DISFAGIA + REGURGITACIÓN de alimentos no digeridos + HALITOSIS fétida (por fermentación del contenido en el saco).",
    "descartes": {
        "A": "Divertículo por tracción: Falso; es por pulsión (hiperpresión por incoordinación motora faringoesfinteriana). Los de tracción son los mediotorácicos por adenopatías tuberculosas/inflamatorias.",
        "B": "Más frecuente en jóvenes: Falso; es una patología típica de ancianos (>65-70 años).",
        "D": "Localizado en el triángulo de Farabeuf: Falso; Farabeuf es un triángulo vascular del cuello; la localización anatómica exacta es el triángulo de KILLIAN."
    },
    "anki": "**Frente:** Tríada clínica típica del Divertículo faringoesofágico de Zenker y localización anatómica de su cuello:\n**Reverso:** **Disfagia + Regurgitación no ácida + Halitosis**; se hernia a través del **Triángulo de Killian** (pulsión)."
}

# Q55 (Acierto frágil · Fisiopatología de Hepatitis Fulminante vs Alcohólica)
CLINICAL_DATA[49] = {
    "enun_bold": "Mujer de 25 años con mal estado general, ictericia y confusión... Analítica: **GOT 3.560 U/mL, GPT 4.520 U/mL, bilirrubina 35 mg/dL con directa de 20 mg/dL**, tiempo de protrombina 20%. ¿Cuál es el diagnóstico **MENOS probable**?",
    "espejo": {
        "premisa": "Diferenciaste perfectamente que una necrosis masiva con transaminasas en miles y GPT > GOT descarta por completo una hepatitis alcohólica.",
        "trampa": "Planteaste una duda conceptual clínica brillante: «¿Por qué tiene la bilirrubina DIRECTA elevada en la hepatitis si el hepatocito está dañado?». La respuesta es que el hepatocito necrosado y tumefacto colapsa los canalículos biliares intrahepáticos y altera las bombas de exportación (MRP2), por lo que la bilirrubina ya conjugada refluye hacia los sinusoides y la sangre venosa, produciendo hiperbilirrubinemia mixta con claro predominio directo y coluria.",
        "regla": "Hepatitis alcohólica: GOT > GPT, pero transaminasas NUNCA superan las 300-500 U/L. Transaminasas >1.000-3.000 U/L = Solo 4 causas: Vírica aguda, Tóxica/Fármacos (paracetamol), Isquémica (shock) o Autoinmune fulminante."
    },
    "descartes": {
        "A": "Hepatitis fulminante por VHA: Causa típica de fallo hepático con transaminasas en miles y necrosis masiva.",
        "B": "Intoxicación por setas (Amanita phalloides): Cursa con transaminasas >3.000-5.000 U/L, coagulopatía grave y coma hepático a las 48-72h.",
        "D": "Hepatitis fulminante autoinmune: Cuadro grave con hipertransaminasemia extrema y fallo de la coagulación que requiere trasplante urgente."
    },
    "anki": "**Frente:** ¿Por qué en una necrosis hepatocelular aguda masiva (hepatitis aguda) se eleva la bilirrubina DIRECTA (conjugada)?\n**Reverso:** **Por tumefacción celular y rotura de canalículos biliares**, que impide el flujo hacia el polo biliar y hace que la bilirrubina conjugada refluya al sinusoide."
}

# Q56 (Acierto frágil · Vesícula de porcelana / Colecistectomía profiláctica)
CLINICAL_DATA[50] = {
    "enun_bold": "En una mujer de 72 años con **litiasis biliar asintomática** se indicaría colecistectomía laparoscópica en caso de:",
    "consolidacion": "La litiasis biliar asintomática NO se opera por norma general, ya que solo el 15-20% desarrollará síntomas a 20 años. La cirugía profiláctica está justificada exclusivamente ante un alto riesgo de degeneración a Adenocarcinoma de vesícula biliar: 1. Vesícula en porcelana (calcificación parietal extensa), 2. Pólipos vesiculares adenomatosos >10 mm, 3. Cálculos gigantes >3 cm, o 4. Anomalía de la unión biliopancreática.",
    "descartes": {
        "A": "Microlitiasis: Aumenta el riesgo de pancreatitis aguda litiásica, pero si es asintomática no es indicación quirúrgica reglada preventiva.",
        "B": "Litiasis mayor de 2,5 cm: El punto de corte clásico reconocido en consensos para considerar riesgo tumoral en cálculos gigantes es a partir de >3 cm.",
        "D": "Cálculos de bilirrubina (pigmentarios): Se asocian a anemias hemolíticas (esferocitosis), pero no aumentan per se el riesgo de carcinoma vesicular."
    },
    "anki": "**Frente:** Paciente con colelitiasis totalmente ASINTOMÁTICA → ¿En qué situación anatómica parietal de la vesícula es obligada la colecistectomía profiláctica?\n**Reverso:** **Vesícula con paredes calcificadas («vesícula de porcelana»)** (riesgo elevado de degeneración a adenocarcinoma de vesícula)."
}

# Q57 (Fallo · Diagnóstico diferencial Colitis Ulcerosa vs Enfermedad de Crohn)
CLINICAL_DATA[51] = {
    "enun_bold": "La colitis ulcerosa (CU) y la enfermedad de Crohn (EC) son dos trastornos inflamatorios crónicos y diferenciados de causa desconocida. Para establecer el diagnóstico diferencial entre ambas hay que tener en cuenta las siguientes consideraciones **EXCEPTO una**:",
    "concepto_clave": "El Ministerio dio como FALSA la opción D («La colonoscopia y la biopsia definen la extensión, siendo posible realizar el diagnóstico diferencial entre ambas») porque la BIOPSIA por sí sola solo aporta datos histológicos locales (distorsión de criptas, granulomas no caseificantes o infiltrado transmural), pero NO puede definir la extensión anatómica macroscópica de la enfermedad a lo largo del tubo digestivo (la extensión se establece por la exploración endoscópica macroscópica completa y las pruebas de imagen como entero-RM).",
    "descartes": {
        "A": "CU afecta solo a colon y EC puede afectar a todo el tubo digestivo: Verdadero; es la gran diferencia topográfica anatómica.",
        "B": "En EC las lesiones son segmentarias y asimétricas («skip areas»): Verdadero; la CU en cambio presenta afectación continua desde el recto.",
        "C": "Tres patrones clínicos en Crohn (inflamatorio, fistulizante, estenosante): Verdadero; clasificación de Montreal clásica.",
        "E": "Diagnóstico diferencial con el linfoma intestinal: Verdadero; especialmente en Crohn de intestino delgado con estenosis y engrosamiento mural ulcerado."
    },
    "anki": "**Frente:** En el diagnóstico diferencial entre Colitis Ulcerosa y Enfermedad de Crohn, ¿por qué la biopsia histológica NO define la extensión?\n**Reverso:** **Porque la biopsia solo evalúa la histología microscópica local**; la extensión la definen la visualización macroscópica endoscópica y las pruebas de imagen (entero-RM)."
}

# Q59 (Acierto frágil · Acalasia / Megasófago)
CLINICAL_DATA[52] = {
    "enun_bold": "Mujer de 36 años... cuadro de años de evolución de **detención alimentaria retroesternal con sólidos y líquidos** (disfagia mixta) y **pérdida de peso progresiva**. En la radiografía de tórax se observa **ensanchamiento mediastínico**. La TC torácica muestra **gran dilatación esofágica con abundante contenido alimentario retenido («patrón en miga de pan»)**. ¿Cuál es el diagnóstico MÁS probable?",
    "consolidacion": "La historia crónica de disfagia de curso insidioso para sólidos y líquidos desde el inicio (disfagia motora) con regurgitación y pérdida de peso, junto con un ensanchamiento mediastínico por retención masiva alimentaria («megasófago descompensado») en paciente joven es el cuadro clínico por excelencia de la ACALASIA. En fases avanzadas, el esófago pierde todo su tono y acumula litros de comida.",
    "descartes": {
        "B": "Gran divertículo de Zenker: Se ubica en el cuello (área hipofaríngea cervical posterior), no produce dilatación mediastínica de todo el esófago torácico.",
        "C": "Espasmo esofágico difuso: Provoca contracciones espásticas de gran amplitud («esófago en sacacorchos»), pero no retención masiva con megaesófago ni ensanchamiento mediastínico.",
        "D": "Leiomioma esofágico obstructivo: Tumor submucoso benigno focal; no causa una dilatación aneurismática difusa de todo el esófago con aperistalsis motora."
    },
    "anki": "**Frente:** Disfagia mixta para sólidos y líquidos de años de evolución + ensanchamiento mediastínico en Rx y dilatación esofágica masiva con restos de comida en TC → Diagnóstico:\n**Reverso:** **Acalasia esofágica en fase de megaesófago**."
}

print("Batch 4 (Q39-Q59) ready. Total clinical records:", len(CLINICAL_DATA))
