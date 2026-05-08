/**
 * mirStats.js — Estadísticas históricas del examen MIR
 *
 * Fuentes:
 *  - Desglose MIR 2025 (imágenes oficiales)
 *  - Desglose MIR 2026 (imágenes oficiales)
 *  - Guía de Temas Rentables CTO (preguntas en los últimos 10 años)
 *
 * Claves de prioridad:
 *  'alta'       → media reciente ≥ 10 preguntas/convocatoria o >150 en 10 años
 *  'media_alta' → media reciente 5-9 preguntas/convocatoria
 *  'media'      → media reciente 2-4 preguntas/convocatoria
 *  'baja'       → media reciente 0-1 preguntas/convocatoria
 *
 * Las claves de `especialidad` coinciden con los nombres usados en especialidadesMIR.js
 */

// ─── Desglose por convocatoria ────────────────────────────────────────────────
// preguntas: número de preguntas en la convocatoria normal (sin radiodiagnóstico)

export const desgloseAnual = {
  2025: {
    'Cardiología':                    16,
    'Neurología y Neurocirugía':      15,
    'Cirugía General':                13,
    'Infecciosas':                    13,
    'Endocrinología y Metabolismo':   12,
    'Reumatología':                   11,
    'Traumatología':                  11,
    'Ginecología y Obstetricia':       9,
    'Digestivo':                       8,
    'Pediatría':                       8,
    'Psiquiatría':                     8,
    'Hematología':                     7,
    'Nefrología':                      7,
    'Neumología':                      7,
    'Otorrinolaringología':            7,
    'Bioética y Medicina Legal':       6,
    'Estadística y Epidemiología':     6,
    'Oncología':                       6,
    'Urología':                        6,
    'Oftalmología':                    5,
    'Urgencias':                       5,
    'Dermatología':                    4,
    'Anatomía Patológica':             3,
    'Anestesiología':                  3,
    'Geriatría':                       3,
    'Inmunología':                     3,
    'Alergología':                     2,
    'Fisiología':                      2,
    'Bioquímica':                      1,
    'Farmacología':                    1,
    'Genética':                        1,
    'Medicina Familiar y Comunitaria': 1,
  },
  2026: {
    'Cardiología':                    18,
    'Digestivo':                      17,
    'Pediatría':                      11,
    'Estadística y Epidemiología':    10,
    'Neurología y Neurocirugía':      10,
    'Reumatología':                    9,
    'Ginecología y Obstetricia':       9,
    'Neumología':                      9,
    'Bioética y Medicina Legal':       8,
    'Infecciosas':                     8,
    'Cirugía General':                 7,
    'Endocrinología y Metabolismo':    7,
    'Hematología':                     7,
    'Nefrología':                      7,
    'Psiquiatría':                     7,
    'Dermatología':                    6,
    'Geriatría':                       6,
    'Urología':                        6,
    'Oncología':                       5,
    'Traumatología':                   5,
    'Oftalmología':                    4,
    'Otorrinolaringología':            4,
    'Genética':                        3,
    'Urgencias':                       3,
    'Angiología y Cirugía Vascular':   2,
    'Cirugía Plástica':                2,
    'Medicina Familiar y Comunitaria': 2,
    'Farmacología':                    2,
    'Fisiología':                      2,
    'Inmunología':                     2,
    'Neurocirugía':                    2,
    'Anestesiología':                  2,
    'Anatomía Patológica':             1,
    'Anatomía':                        1,
    'Bioquímica':                      1,
    'Cirugía Cardíaca':                1,
    'Cirugía Torácica':                1,
    'Cirugía Maxilofacial':            1,
    'Rehabilitación':                  1,
    'Alergología':                     1,
  },
}

// Desglose de radiodiagnóstico (imágenes) — 25 preguntas en 2025 y 2026
export const desgloseRadiodiag = {
  2025: {
    'Cardiología': 3, 'Cirugía General': 2, 'Neumología': 1,
    'Ginecología y Obstetricia': 1, 'Hematología': 1, 'Infecciosas': 1,
    'Nefrología': 1, 'Neurología y Neurocirugía': 3, 'Oftalmología': 2,
    'Otorrinolaringología': 2, 'Reumatología': 1, 'Traumatología': 4,
    'Urología': 1, 'Digestivo': 2, 'Anatomía Patológica': 1,
  },
  2026: {
    'Dermatología': 6, 'Cardiología': 3, 'Cirugía General': 2,
    'Digestivo': 2, 'Hematología': 2, 'Traumatología': 2,
    'Anatomía Patológica': 1, 'Cirugía Cardíaca': 1, 'Genética': 1,
    'Neumología': 1, 'Oftalmología': 1, 'Oncología': 1,
    'Otorrinolaringología': 1, 'Reumatología': 1,
  },
}

// ─── Rentabilidad (media últimos 10 años, fuente: CTO) ───────────────────────

export const rentabilidad = {
  'Alergología': {
    prioridad: 'baja',
    preguntas10y: { min: 0, max: 10 },
    notas: 'Asignatura poco preguntada. Estudio basado en desgloses y simulacros.',
    temasClave: [
      { tema: 'Mastocitosis', peso: 'alta' },
      { tema: 'Alergia a alimentos', peso: 'baja' },
      { tema: 'Anafilaxia', peso: 'baja' },
      { tema: 'Inmunoterapia específica', peso: 'baja' },
    ],
  },
  'Anatomía': {
    prioridad: 'baja',
    preguntas10y: { min: 0, max: 5 },
    notas: 'Poco relevante por sí misma. Fundamental para comprensión fisiopatológica.',
    temasClave: [],
  },
  'Anatomía Patológica': {
    prioridad: 'baja',
    preguntas10y: { min: 5, max: 20 },
    notas: 'Peso moderado, incluida en radiodiagnóstico.',
    temasClave: [],
  },
  'Anestesiología': {
    prioridad: 'baja',
    preguntas10y: { min: 0, max: 10 },
    notas: '0-1 preguntas/año en los últimos 10 años.',
    temasClave: [],
  },
  'Bioética y Medicina Legal': {
    prioridad: 'media_alta',
    preguntas10y: { min: 30, max: 80 },
    notas: 'Peso creciente en las últimas convocatorias. Muy amplia.',
    temasClave: [
      { tema: 'T4 Ética en el final de la vida. Paciente terminal', peso: 'alta' },
      { tema: 'Principios de bioética', peso: 'alta' },
      { tema: 'Relación clínica y consentimiento informado', peso: 'alta' },
      { tema: 'Medicina legal y forense', peso: 'media' },
    ],
  },
  'Bioquímica': {
    prioridad: 'baja',
    preguntas10y: { min: 0, max: 10 },
    notas: 'Pocas preguntas propias. Estudio transversal apoyando otras materias.',
    temasClave: [],
  },
  'Cardiología': {
    prioridad: 'alta',
    preguntas10y: { min: 120, max: 180 },
    notas: 'De las asignaturas con más preguntas. Constante en todas las convocatorias.',
    temasClave: [
      { tema: 'T6 Valvulopatías (estenosis aórtica y mitral)', peso: 'alta' },
      { tema: 'T5 Insuficiencia cardíaca y miocardiopatías', peso: 'alta' },
      { tema: 'T14 Hipertensión arterial', peso: 'alta' },
      { tema: 'T10 Arritmias y canalopatías', peso: 'alta' },
      { tema: 'T13 Enfermedad coronaria', peso: 'alta' },
      { tema: 'T16 Enfermedades de los vasos periféricos', peso: 'media' },
      { tema: 'T1 Biología cardiovascular y ciclo cardíaco', peso: 'media' },
      { tema: 'T12 Síncope', peso: 'media' },
      { tema: 'T7 Enfermedades del pericardio', peso: 'baja' },
    ],
  },
  'Cirugía General': {
    prioridad: 'alta',
    preguntas10y: { min: 50, max: 100 },
    notas: '5-10 preguntas/año. Politraumatismos y abdomen agudo son los más preguntados.',
    temasClave: [
      { tema: 'Politraumatismos y traumatismos abdominales/torácicos', peso: 'alta' },
      { tema: 'Abdomen agudo e infecciones intraabdominales', peso: 'alta' },
      { tema: 'Pared abdominal (hernias)', peso: 'media' },
      { tema: 'Cirugía plástica (básicos)', peso: 'media' },
      { tema: 'Complicaciones posoperatorias', peso: 'baja' },
    ],
  },
  'Dermatología': {
    prioridad: 'media',
    preguntas10y: { min: 30, max: 60 },
    notas: 'Más de 5 preguntas en los últimos 10 años. Alta en radiodiagnóstico 2026.',
    temasClave: [
      { tema: 'T21 Melanoma maligno (más preguntado)', peso: 'alta' },
      { tema: 'Psoriasis y enfermedades eritemato-descamativas', peso: 'alta' },
      { tema: 'Enfermedades ampollosas autoinmunitarias', peso: 'alta' },
      { tema: 'Tumores cutáneos benignos y precancerosos', peso: 'media' },
      { tema: 'Infecciones víricas cutáneas', peso: 'media' },
      { tema: 'Linfomas cutáneos', peso: 'baja' },
    ],
  },
  'Digestivo': {
    prioridad: 'alta',
    preguntas10y: { min: 70, max: 130 },
    notas: 'Muy alta en MIR 2026 (17 preguntas). Muy variado temáticamente.',
    temasClave: [
      { tema: 'T10 Úlcera péptica (H. pylori y AINEs)', peso: 'alta' },
      { tema: 'T16 Enfermedad inflamatoria intestinal', peso: 'alta' },
      { tema: 'T32 Complicaciones de la cirrosis (HTP, ascitis, EH)', peso: 'alta' },
      { tema: 'T14 Síndromes malabsortivos (celiaquía)', peso: 'alta' },
      { tema: 'T36 Vía biliar (colelitiasis, colangitis)', peso: 'alta' },
      { tema: 'T17-18 Cáncer colorrectal y pólipos', peso: 'alta' },
      { tema: 'T35 Pancreatitis aguda y crónica', peso: 'alta' },
      { tema: 'T27 Hepatitis víricas', peso: 'media' },
      { tema: 'T21 Patología perianal', peso: 'media' },
    ],
  },
  'Endocrinología y Metabolismo': {
    prioridad: 'alta',
    preguntas10y: { min: 100, max: 160 },
    notas: 'Más de 15 preguntas/año. Diabetes es el tema más rentable.',
    temasClave: [
      { tema: 'T5 Diabetes mellitus (diagnóstico, complicaciones, tratamiento)', peso: 'alta' },
      { tema: 'T3 Tiroides (hipo/hipertiroidismo, nódulo, cáncer)', peso: 'alta' },
      { tema: 'T4 Suprarrenales (Cushing, Addison, feocromocitoma)', peso: 'alta' },
      { tema: 'T8 Calcio y metabolismo óseo (osteoporosis, hiperPTH)', peso: 'alta' },
      { tema: 'T2 Hipófisis (acromegalia, prolactinoma, diabetes insípida)', peso: 'alta' },
      { tema: 'T11 Trastornos del desarrollo sexual', peso: 'media' },
      { tema: 'T1 Fisiología del sistema endocrino', peso: 'media' },
    ],
  },
  'Estadística y Epidemiología': {
    prioridad: 'alta',
    preguntas10y: { min: 150, max: 250 },
    notas: '20-25 preguntas/año. Una de las asignaturas con más preguntas absolutas.',
    temasClave: [
      { tema: 'T1 Estudio de un test (sensibilidad, especificidad, VPP, VPN)', peso: 'alta' },
      { tema: 'T6 Tipos de estudios epidemiológicos', peso: 'alta' },
      { tema: 'T19 Evaluación económica en salud', peso: 'alta' },
      { tema: 'T4-5 Ensayo clínico y metaanálisis', peso: 'alta' },
      { tema: 'T10 Niveles de evidencia científica', peso: 'alta' },
      { tema: 'T13 Estadística inferencial y contraste de hipótesis', peso: 'media' },
      { tema: 'T16 Salud y sistemas sanitarios (SNS)', peso: 'media' },
      { tema: 'T15 Tamaño muestral', peso: 'media' },
    ],
  },
  'Farmacología': {
    prioridad: 'baja',
    preguntas10y: { min: 0, max: 15 },
    notas: 'Pocas preguntas propias. Farmacología aplicada muy útil como conocimiento transversal.',
    temasClave: [],
  },
  'Fisiología': {
    prioridad: 'baja',
    preguntas10y: { min: 5, max: 20 },
    notas: 'Conocimiento transversal. Pocas preguntas propias.',
    temasClave: [],
  },
  'Genética': {
    prioridad: 'baja',
    preguntas10y: { min: 5, max: 25 },
    notas: 'Peso creciente. Estudio centrado en herencia y enfermedades genéticas.',
    temasClave: [
      { tema: 'Herencia y enfermedades genéticas', peso: 'alta' },
      { tema: 'Mecanismos mutacionales', peso: 'media' },
    ],
  },
  'Geriatría': {
    prioridad: 'media',
    preguntas10y: { min: 20, max: 50 },
    notas: 'Peso moderado. Síndromes geriátricos y fragilidad son los más preguntados.',
    temasClave: [
      { tema: 'Síndromes geriátricos (delirium, caídas, polifarmacia)', peso: 'alta' },
      { tema: 'Valoración geriátrica integral', peso: 'alta' },
      { tema: 'Fragilidad y sarcopenia', peso: 'media' },
    ],
  },
  'Ginecología y Obstetricia': {
    prioridad: 'media_alta',
    preguntas10y: { min: 70, max: 110 },
    notas: 'Asignatura de peso constante. Obstetricia patológica y ginecología oncológica son clave.',
    temasClave: [
      { tema: 'T15 Diagnóstico prenatal', peso: 'alta' },
      { tema: 'T7 Patología uterina maligna (endometrio, cérvix)', peso: 'alta' },
      { tema: 'T2 Amenorreas', peso: 'alta' },
      { tema: 'T5 Infertilidad y reproducción asistida', peso: 'alta' },
      { tema: 'T18 Trastornos hipertensivos gestación (preeclampsia)', peso: 'alta' },
      { tema: 'T13-14 Parto (normal, pretérmino, cesárea)', peso: 'media' },
      { tema: 'T8 Patología ovárica benigna', peso: 'media' },
      { tema: 'T3 Síndrome ovario poliquístico', peso: 'media' },
    ],
  },
  'Hematología': {
    prioridad: 'media_alta',
    preguntas10y: { min: 70, max: 110 },
    notas: 'Más de 10 preguntas/año. Plaquetas y hemostasia son los temas estrella.',
    temasClave: [
      { tema: 'T17 Alteraciones plaquetarias (PTI, PTT)', peso: 'alta' },
      { tema: 'T15 Mieloma múltiple y GMSI', peso: 'alta' },
      { tema: 'T7 Anemias hemolíticas', peso: 'alta' },
      { tema: 'T19 Terapia antitrombótica (acenocumarol, HBPM, ACOD)', peso: 'alta' },
      { tema: 'T10-11 Linfomas (Hodgkin y no Hodgkin)', peso: 'alta' },
      { tema: 'T10 Leucemias agudas', peso: 'media' },
      { tema: 'T3 Anemias ferropénica y por enfermedad crónica', peso: 'media' },
    ],
  },
  'Infecciosas': {
    prioridad: 'alta',
    preguntas10y: { min: 90, max: 150 },
    notas: 'Más de 10 preguntas/año. Antibióticos y VIH son los temas más preguntados.',
    temasClave: [
      { tema: 'T2 Antibióticos (familias, mecanismos de resistencia, toxicidades)', peso: 'alta' },
      { tema: 'T17 Infección por VIH (infecciones oportunistas, TAR)', peso: 'alta' },
      { tema: 'T6 Tuberculosis', peso: 'alta' },
      { tema: 'T8 Infecciones digestivas (C. difficile, Salmonella)', peso: 'alta' },
      { tema: 'T5 Endocarditis infecciosa', peso: 'media' },
      { tema: 'T3 Fiebre de origen desconocido', peso: 'media' },
      { tema: 'T18 Micosis sistémicas', peso: 'media' },
    ],
  },
  'Inmunología': {
    prioridad: 'baja',
    preguntas10y: { min: 10, max: 30 },
    notas: 'Pocas preguntas propias. Conocimiento transversal útil.',
    temasClave: [],
  },
  'Medicina Familiar y Comunitaria': {
    prioridad: 'baja',
    preguntas10y: { min: 5, max: 20 },
    notas: 'Pocas preguntas. Centrado en prevención y maltrato.',
    temasClave: [
      { tema: 'Prevención y atención al maltrato', peso: 'alta' },
      { tema: 'Factores de riesgo cardiovascular', peso: 'alta' },
    ],
  },
  'Nefrología': {
    prioridad: 'media_alta',
    preguntas10y: { min: 80, max: 120 },
    notas: 'Más de 10 preguntas/año. Hidroelectrolíticos es el tema más complejo y preguntado.',
    temasClave: [
      { tema: 'T2 Trastornos hidroelectrolíticos (Na, K, gasometría)', peso: 'alta' },
      { tema: 'T7 Glomerulonefritis', peso: 'alta' },
      { tema: 'T5 Enfermedad renal crónica y trasplante renal', peso: 'alta' },
      { tema: 'T11 Trasplante renal e inmunosupresión', peso: 'media' },
      { tema: 'T3 Nefropatía diabética e hipertensiva', peso: 'media' },
    ],
  },
  'Neumología': {
    prioridad: 'alta',
    preguntas10y: { min: 150, max: 220 },
    notas: 'Más de 20 preguntas/año. Una de las asignaturas con más preguntas.',
    temasClave: [
      { tema: 'T18 Neoplasias pulmonares (clasificación TNM, tratamiento)', peso: 'alta' },
      { tema: 'T16 Enfermedades de la pleura (derrame, neumotórax)', peso: 'alta' },
      { tema: 'T4 EPOC y enfisema', peso: 'alta' },
      { tema: 'T6 Asma', peso: 'alta' },
      { tema: 'T12 Síndrome de apnea del sueño (SAHS)', peso: 'alta' },
      { tema: 'T9 Enfermedades pulmonares intersticiales', peso: 'alta' },
      { tema: 'T14 Hipertensión pulmonar', peso: 'media' },
      { tema: 'T11 TEP y TVP', peso: 'alta' },
    ],
  },
  'Neurología y Neurocirugía': {
    prioridad: 'alta',
    preguntas10y: { min: 120, max: 180 },
    notas: 'Más de 15 preguntas/año. Ictus es el tema más importante de toda la neurología.',
    temasClave: [
      { tema: 'T4 Enfermedades vasculares cerebrales (ICTUS)', peso: 'alta' },
      { tema: 'T7 Epilepsia (epilepsia mioclónica juvenil, ausencias)', peso: 'alta' },
      { tema: 'T5 Cefaleas (migraña, cefalea en racimos)', peso: 'alta' },
      { tema: 'T10 Enfermedades desmielinizantes (esclerosis múltiple)', peso: 'alta' },
      { tema: 'T12 Enfermedades degenerativas (Alzheimer, Parkinson)', peso: 'alta' },
      { tema: 'T15 Traumatismos craneoencefálicos', peso: 'media' },
      { tema: 'T23 Neuroimagen (TC, RM)', peso: 'media' },
      { tema: 'T2 Coma y muerte encefálica', peso: 'media' },
    ],
  },
  'Oftalmología': {
    prioridad: 'media_alta',
    preguntas10y: { min: 60, max: 100 },
    notas: 'Más de 10 preguntas/año. Vítreo y retina es el tema estrella.',
    temasClave: [
      { tema: 'T11 Vítreo y retina (retinopatía diabética, DMAE, desprendimiento)', peso: 'alta' },
      { tema: 'T10 Uveítis (anterior y posterior)', peso: 'alta' },
      { tema: 'T6 Glaucoma', peso: 'alta' },
      { tema: 'T4 Conjuntivitis y patología corneal', peso: 'media' },
    ],
  },
  'Oncología': {
    prioridad: 'media',
    preguntas10y: { min: 40, max: 70 },
    notas: 'Peso moderado. Estudio transversal junto con las asignaturas orgánicas.',
    temasClave: [
      { tema: 'Principios generales de oncología (estadificación TNM)', peso: 'alta' },
      { tema: 'Tratamientos oncológicos (quimioterapia, radioterapia, inmunoterapia)', peso: 'alta' },
      { tema: 'Síndromes paraneoplásicos', peso: 'media' },
    ],
  },
  'Otorrinolaringología': {
    prioridad: 'media_alta',
    preguntas10y: { min: 90, max: 150 },
    notas: 'Más de 15 preguntas/año. Otología es el tema más preguntado.',
    temasClave: [
      { tema: 'T2 Otología (hipoacusia, Menière, colesteatoma, vértigo)', peso: 'alta' },
      { tema: 'Rinología y patología nasosinusal', peso: 'media' },
      { tema: 'Patología de laringe y faringe', peso: 'media' },
      { tema: 'Pruebas de Rinne y Weber', peso: 'alta' },
    ],
  },
  'Pediatría': {
    prioridad: 'alta',
    preguntas10y: { min: 110, max: 170 },
    notas: 'Más de 15 preguntas/año. Muy alta en MIR 2026 (11 preguntas).',
    temasClave: [
      { tema: 'T4 Patología digestiva pediátrica (invaginación, estenosis pilórica, celiaquía)', peso: 'alta' },
      { tema: 'T10 Vacunas y calendario vacunal', peso: 'alta' },
      { tema: 'Patología respiratoria pediátrica (bronquiolitis, neumonía, asma)', peso: 'alta' },
      { tema: 'Neonatología (RN, ictericia, prematuridad)', peso: 'alta' },
      { tema: 'T11 Metabolopatías', peso: 'media' },
      { tema: 'Cardiopatías congénitas', peso: 'media' },
    ],
  },
  'Psiquiatría': {
    prioridad: 'alta',
    preguntas10y: { min: 150, max: 220 },
    notas: 'Más de 20 preguntas/año. Trastornos del ánimo y esquizofrenia son los más preguntados.',
    temasClave: [
      { tema: 'T2 Trastornos del estado de ánimo (depresión, trastorno bipolar, litio)', peso: 'alta' },
      { tema: 'T1 Esquizofrenia y psicosis (antipsicóticos)', peso: 'alta' },
      { tema: 'T6 Trastornos de ansiedad y TOC', peso: 'alta' },
      { tema: 'T8 Trastornos de la conducta alimentaria (anorexia, bulimia)', peso: 'alta' },
      { tema: 'T7 Trastornos de la personalidad', peso: 'media' },
      { tema: 'Psicofarmacología (antidepresivos, ansiolíticos)', peso: 'alta' },
    ],
  },
  'Reumatología': {
    prioridad: 'alta',
    preguntas10y: { min: 100, max: 160 },
    notas: 'Más de 15 preguntas/año. Vasculitis y patología musculoesquelética son clave.',
    temasClave: [
      { tema: 'T8 Vasculitis (ACG, poliangeítis, PAN)', peso: 'alta' },
      { tema: 'T2 Enfermedades metabólicas óseas (osteoporosis, Paget)', peso: 'alta' },
      { tema: 'T1 Artritis reumatoide', peso: 'alta' },
      { tema: 'T3 Espondiloartropatías (espondilitis anquilosante)', peso: 'alta' },
      { tema: 'T5 Lupus eritematoso sistémico', peso: 'alta' },
      { tema: 'T7 Gota e hiperuricemia', peso: 'alta' },
      { tema: 'T6 Síndrome de Sjögren y esclerodermia', peso: 'media' },
    ],
  },
  'Traumatología': {
    prioridad: 'media_alta',
    preguntas10y: { min: 100, max: 150 },
    notas: '~15 preguntas en los últimos 10 años. Fracturas es el tema central.',
    temasClave: [
      { tema: 'T1 Fracturas (cadera, húmero, radio distal, escafoides)', peso: 'alta' },
      { tema: 'T3 Lesiones traumáticas e inflamatorias de partes blandas', peso: 'media' },
      { tema: 'Artroplastias y prótesis', peso: 'media' },
    ],
  },
  'Urgencias': {
    prioridad: 'media',
    preguntas10y: { min: 20, max: 50 },
    notas: 'Situaciones emergentes. Intoxicaciones y triaje son los más preguntados.',
    temasClave: [
      { tema: 'Intoxicaciones agudas', peso: 'alta' },
      { tema: 'Triaje y clasificación de urgencias', peso: 'alta' },
      { tema: 'Síndromes específicos de urgencias', peso: 'alta' },
    ],
  },
  'Urología': {
    prioridad: 'media_alta',
    preguntas10y: { min: 50, max: 100 },
    notas: '~10 preguntas en los últimos 10 años. Próstata y litiasis son lo más preguntado.',
    temasClave: [
      { tema: 'T5 HBP y cáncer de próstata (estadificación)', peso: 'alta' },
      { tema: 'T2 Infecciones del tracto urinario', peso: 'alta' },
      { tema: 'T3 Litiasis renal', peso: 'alta' },
      { tema: 'T4 Tumores renales (carcinoma de células claras)', peso: 'media' },
    ],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORIDAD_LABEL = {
  alta:       { label: '🔴 Alta',       color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  media_alta: { label: '🟠 Media-alta', color: '#c2410c', bg: '#fff7ed', border: '#fdba74' },
  media:      { label: '🟡 Media',      color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  baja:       { label: '⚪ Baja',       color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
}

/**
 * Devuelve la información de rentabilidad de una especialidad.
 * Si no existe, devuelve defaults seguros.
 */
export function getRentabilidad(especialidad) {
  return rentabilidad[especialidad] || {
    prioridad: 'baja',
    preguntas10y: { min: 0, max: 10 },
    notas: '',
    temasClave: [],
  }
}

/**
 * Devuelve los metadatos visuales de una prioridad (label, colores).
 */
export function getPrioridadMeta(prioridad) {
  return PRIORIDAD_LABEL[prioridad] || PRIORIDAD_LABEL.baja
}

/**
 * Devuelve la media de preguntas en los dos últimos MIR disponibles.
 */
export function getMediaReciente(especialidad) {
  const años = Object.keys(desgloseAnual).sort().reverse().slice(0, 2)
  const valores = años.map(a => desgloseAnual[a][especialidad] || 0)
  if (valores.length === 0) return 0
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
}

/**
 * Ranking de todas las especialidades por media reciente (descendente).
 */
export function getRankingEspecialidades() {
  const todos = new Set([
    ...Object.keys(desgloseAnual[2025] || {}),
    ...Object.keys(desgloseAnual[2026] || {}),
  ])
  return [...todos]
    .map(e => ({ especialidad: e, media: getMediaReciente(e) }))
    .sort((a, b) => b.media - a.media)
}
