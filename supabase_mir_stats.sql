-- ─── TABLAS DE ESTADÍSTICAS MIR ──────────────────────────────────────────────
-- Ejecutar en Supabase → SQL Editor → New query
-- Fuentes: Desglose MIR 2025 y 2026 (oficial) + Guía Temas Rentables CTO

-- 1. Desglose por convocatoria (preguntas por asignatura y año)
create table if not exists mir_desglose (
  id serial primary key,
  especialidad text not null,
  anio integer not null,
  preguntas integer not null default 0,
  tipo text not null default 'normal',  -- 'normal' | 'radiodiag'
  created_at timestamp with time zone default now(),
  unique(especialidad, anio, tipo)
);

-- 2. Rentabilidad y temas clave (guía de estudio)
create table if not exists mir_rentabilidad (
  id serial primary key,
  especialidad text not null unique,
  prioridad text not null,              -- 'alta' | 'media_alta' | 'media' | 'baja'
  preguntas_10y_min integer,
  preguntas_10y_max integer,
  temas_clave jsonb,                    -- [{tema, peso}]
  notas text,
  created_at timestamp with time zone default now()
);

-- RLS: lectura pública
alter table mir_desglose enable row level security;
alter table mir_rentabilidad enable row level security;

create policy "public read mir_desglose"      on mir_desglose     for select using (true);
create policy "public read mir_rentabilidad"  on mir_rentabilidad for select using (true);
create policy "service write mir_desglose"    on mir_desglose     for all using (true);
create policy "service write mir_rentabilidad" on mir_rentabilidad for all using (true);


-- ─── INSERT: DESGLOSE MIR 2025 ───────────────────────────────────────────────
insert into mir_desglose (especialidad, anio, preguntas, tipo) values
  ('Cardiología',                    2025, 16, 'normal'),
  ('Neurología y Neurocirugía',      2025, 15, 'normal'),
  ('Cirugía General',                2025, 13, 'normal'),
  ('Infecciosas',                    2025, 13, 'normal'),
  ('Endocrinología y Metabolismo',   2025, 12, 'normal'),
  ('Reumatología',                   2025, 11, 'normal'),
  ('Traumatología',                  2025, 11, 'normal'),
  ('Ginecología y Obstetricia',      2025,  9, 'normal'),
  ('Digestivo',                      2025,  8, 'normal'),
  ('Pediatría',                      2025,  8, 'normal'),
  ('Psiquiatría',                    2025,  8, 'normal'),
  ('Hematología',                    2025,  7, 'normal'),
  ('Nefrología',                     2025,  7, 'normal'),
  ('Neumología',                     2025,  7, 'normal'),
  ('Otorrinolaringología',           2025,  7, 'normal'),
  ('Bioética y Medicina Legal',      2025,  6, 'normal'),
  ('Estadística y Epidemiología',    2025,  6, 'normal'),
  ('Oncología',                      2025,  6, 'normal'),
  ('Urología',                       2025,  6, 'normal'),
  ('Oftalmología',                   2025,  5, 'normal'),
  ('Urgencias',                      2025,  5, 'normal'),
  ('Dermatología',                   2025,  4, 'normal'),
  ('Anatomía Patológica',            2025,  3, 'normal'),
  ('Anestesiología',                 2025,  3, 'normal'),
  ('Geriatría',                      2025,  3, 'normal'),
  ('Inmunología',                    2025,  3, 'normal'),
  ('Alergología',                    2025,  2, 'normal'),
  ('Fisiología',                     2025,  2, 'normal'),
  ('Bioquímica',                     2025,  1, 'normal'),
  ('Farmacología',                   2025,  1, 'normal'),
  ('Genética',                       2025,  1, 'normal'),
  ('Medicina Familiar y Comunitaria',2025,  1, 'normal')
on conflict (especialidad, anio, tipo) do update set preguntas = excluded.preguntas;

-- Radiodiagnóstico MIR 2025
insert into mir_desglose (especialidad, anio, preguntas, tipo) values
  ('Cardiología',               2025, 3, 'radiodiag'),
  ('Cirugía General',           2025, 2, 'radiodiag'),
  ('Neumología',                2025, 1, 'radiodiag'),
  ('Ginecología y Obstetricia', 2025, 1, 'radiodiag'),
  ('Hematología',               2025, 1, 'radiodiag'),
  ('Infecciosas',               2025, 1, 'radiodiag'),
  ('Nefrología',                2025, 1, 'radiodiag'),
  ('Neurología y Neurocirugía', 2025, 3, 'radiodiag'),
  ('Oftalmología',              2025, 2, 'radiodiag'),
  ('Otorrinolaringología',      2025, 2, 'radiodiag'),
  ('Reumatología',              2025, 1, 'radiodiag'),
  ('Traumatología',             2025, 4, 'radiodiag'),
  ('Urología',                  2025, 1, 'radiodiag'),
  ('Digestivo',                 2025, 2, 'radiodiag'),
  ('Anatomía Patológica',       2025, 1, 'radiodiag')
on conflict (especialidad, anio, tipo) do update set preguntas = excluded.preguntas;


-- ─── INSERT: DESGLOSE MIR 2026 ───────────────────────────────────────────────
insert into mir_desglose (especialidad, anio, preguntas, tipo) values
  ('Cardiología',                    2026, 18, 'normal'),
  ('Digestivo',                      2026, 17, 'normal'),
  ('Pediatría',                      2026, 11, 'normal'),
  ('Estadística y Epidemiología',    2026, 10, 'normal'),
  ('Neurología y Neurocirugía',      2026, 10, 'normal'),
  ('Reumatología',                   2026,  9, 'normal'),
  ('Ginecología y Obstetricia',      2026,  9, 'normal'),
  ('Neumología',                     2026,  9, 'normal'),
  ('Bioética y Medicina Legal',      2026,  8, 'normal'),
  ('Infecciosas',                    2026,  8, 'normal'),
  ('Cirugía General',                2026,  7, 'normal'),
  ('Endocrinología y Metabolismo',   2026,  7, 'normal'),
  ('Hematología',                    2026,  7, 'normal'),
  ('Nefrología',                     2026,  7, 'normal'),
  ('Psiquiatría',                    2026,  7, 'normal'),
  ('Dermatología',                   2026,  6, 'normal'),
  ('Geriatría',                      2026,  6, 'normal'),
  ('Urología',                       2026,  6, 'normal'),
  ('Oncología',                      2026,  5, 'normal'),
  ('Traumatología',                  2026,  5, 'normal'),
  ('Oftalmología',                   2026,  4, 'normal'),
  ('Otorrinolaringología',           2026,  4, 'normal'),
  ('Genética',                       2026,  3, 'normal'),
  ('Urgencias',                      2026,  3, 'normal'),
  ('Angiología y Cirugía Vascular',  2026,  2, 'normal'),
  ('Cirugía Plástica',               2026,  2, 'normal'),
  ('Medicina Familiar y Comunitaria',2026,  2, 'normal'),
  ('Farmacología',                   2026,  2, 'normal'),
  ('Fisiología',                     2026,  2, 'normal'),
  ('Inmunología',                    2026,  2, 'normal'),
  ('Neurocirugía',                   2026,  2, 'normal'),
  ('Anestesiología',                 2026,  2, 'normal'),
  ('Anatomía Patológica',            2026,  1, 'normal'),
  ('Anatomía',                       2026,  1, 'normal'),
  ('Bioquímica',                     2026,  1, 'normal'),
  ('Cirugía Cardíaca',               2026,  1, 'normal'),
  ('Cirugía Torácica',               2026,  1, 'normal'),
  ('Cirugía Maxilofacial',           2026,  1, 'normal'),
  ('Rehabilitación',                 2026,  1, 'normal'),
  ('Alergología',                    2026,  1, 'normal')
on conflict (especialidad, anio, tipo) do update set preguntas = excluded.preguntas;

-- Radiodiagnóstico MIR 2026
insert into mir_desglose (especialidad, anio, preguntas, tipo) values
  ('Dermatología',          2026, 6, 'radiodiag'),
  ('Cardiología',           2026, 3, 'radiodiag'),
  ('Cirugía General',       2026, 2, 'radiodiag'),
  ('Digestivo',             2026, 2, 'radiodiag'),
  ('Hematología',           2026, 2, 'radiodiag'),
  ('Traumatología',         2026, 2, 'radiodiag'),
  ('Anatomía Patológica',   2026, 1, 'radiodiag'),
  ('Cirugía Cardíaca',      2026, 1, 'radiodiag'),
  ('Genética',              2026, 1, 'radiodiag'),
  ('Neumología',            2026, 1, 'radiodiag'),
  ('Oftalmología',          2026, 1, 'radiodiag'),
  ('Oncología',             2026, 1, 'radiodiag'),
  ('Otorrinolaringología',  2026, 1, 'radiodiag'),
  ('Reumatología',          2026, 1, 'radiodiag')
on conflict (especialidad, anio, tipo) do update set preguntas = excluded.preguntas;


-- ─── INSERT: RENTABILIDAD (fuente: Guía CTO) ─────────────────────────────────
insert into mir_rentabilidad (especialidad, prioridad, preguntas_10y_min, preguntas_10y_max, notas, temas_clave) values

('Alergología', 'baja', 0, 10,
 'Asignatura poco preguntada. Estudio basado en desgloses y simulacros.',
 '[{"tema":"Mastocitosis","peso":"alta"},{"tema":"Anafilaxia","peso":"baja"}]'),

('Anatomía', 'baja', 0, 5,
 'Poco relevante por sí misma. Fundamental para comprensión fisiopatológica.',
 '[]'),

('Anatomía Patológica', 'baja', 5, 20,
 'Peso moderado, incluida en radiodiagnóstico.',
 '[]'),

('Anestesiología', 'baja', 0, 10,
 '0-1 preguntas/año en los últimos 10 años.',
 '[]'),

('Bioética y Medicina Legal', 'media_alta', 30, 80,
 'Peso creciente en las últimas convocatorias. Muy amplia.',
 '[{"tema":"T4 Ética final de vida. Paciente terminal","peso":"alta"},{"tema":"Relación clínica y consentimiento informado","peso":"alta"}]'),

('Bioquímica', 'baja', 0, 10,
 'Pocas preguntas propias.',
 '[]'),

('Cardiología', 'alta', 120, 180,
 'De las asignaturas con más preguntas. Constante en todas las convocatorias.',
 '[{"tema":"T6 Valvulopatías","peso":"alta"},{"tema":"T13 Enfermedad coronaria","peso":"alta"},{"tema":"T14 HTA","peso":"alta"},{"tema":"T10 Arritmias","peso":"alta"},{"tema":"T5 Insuficiencia cardíaca","peso":"alta"}]'),

('Cirugía General', 'alta', 50, 100,
 '5-10 preguntas/año. Politraumatismos y abdomen agudo son los más preguntados.',
 '[{"tema":"Politraumatismos y traumatismos abdominales/torácicos","peso":"alta"},{"tema":"Abdomen agudo","peso":"alta"},{"tema":"Pared abdominal (hernias)","peso":"media"}]'),

('Dermatología', 'media', 30, 60,
 'Más de 5 preguntas en los últimos 10 años. Alta en radiodiagnóstico 2026.',
 '[{"tema":"T21 Melanoma maligno","peso":"alta"},{"tema":"Psoriasis","peso":"alta"},{"tema":"Enfermedades ampollosas","peso":"alta"}]'),

('Digestivo', 'alta', 70, 130,
 'Muy alta en MIR 2026 (17 preguntas). Muy variado temáticamente.',
 '[{"tema":"T10 Úlcera péptica","peso":"alta"},{"tema":"T16 EII","peso":"alta"},{"tema":"T32 Cirrosis y complicaciones","peso":"alta"},{"tema":"T36 Vía biliar","peso":"alta"},{"tema":"T35 Pancreatitis","peso":"alta"}]'),

('Endocrinología y Metabolismo', 'alta', 100, 160,
 'Más de 15 preguntas/año. Diabetes es el tema más rentable.',
 '[{"tema":"T5 Diabetes mellitus","peso":"alta"},{"tema":"T3 Tiroides","peso":"alta"},{"tema":"T4 Suprarrenales","peso":"alta"},{"tema":"T8 Metabolismo óseo","peso":"alta"},{"tema":"T2 Hipófisis","peso":"alta"}]'),

('Estadística y Epidemiología', 'alta', 150, 250,
 '20-25 preguntas/año. Una de las asignaturas con más preguntas absolutas.',
 '[{"tema":"T1 Estudio de un test (Se, Sp, VPP, VPN)","peso":"alta"},{"tema":"T6 Tipos de estudios epidemiológicos","peso":"alta"},{"tema":"T19 Evaluación económica","peso":"alta"},{"tema":"T4-5 Ensayo clínico y metaanálisis","peso":"alta"}]'),

('Farmacología', 'baja', 0, 15,
 'Pocas preguntas propias. Farmacología transversal muy útil.',
 '[]'),

('Fisiología', 'baja', 5, 20,
 'Conocimiento transversal. Pocas preguntas propias.',
 '[]'),

('Genética', 'baja', 5, 25,
 'Peso creciente. Estudio centrado en herencia y enfermedades genéticas.',
 '[{"tema":"Herencia y enfermedades genéticas","peso":"alta"}]'),

('Geriatría', 'media', 20, 50,
 'Peso moderado. Síndromes geriátricos y fragilidad son los más preguntados.',
 '[{"tema":"Síndromes geriátricos","peso":"alta"},{"tema":"Valoración geriátrica integral","peso":"alta"}]'),

('Ginecología y Obstetricia', 'media_alta', 70, 110,
 'Asignatura de peso constante. Obstetricia patológica y ginecología oncológica son clave.',
 '[{"tema":"T15 Diagnóstico prenatal","peso":"alta"},{"tema":"T7 Patología uterina maligna","peso":"alta"},{"tema":"T2 Amenorreas","peso":"alta"},{"tema":"T18 Preeclampsia","peso":"alta"}]'),

('Hematología', 'media_alta', 70, 110,
 'Más de 10 preguntas/año. Plaquetas y hemostasia son los temas estrella.',
 '[{"tema":"T17 Alteraciones plaquetarias (PTI, PTT)","peso":"alta"},{"tema":"T15 Mieloma múltiple","peso":"alta"},{"tema":"T7 Anemias hemolíticas","peso":"alta"},{"tema":"T19 Terapia antitrombótica","peso":"alta"}]'),

('Infecciosas', 'alta', 90, 150,
 'Más de 10 preguntas/año. Antibióticos y VIH son los temas más preguntados.',
 '[{"tema":"T2 Antibióticos","peso":"alta"},{"tema":"T17 VIH","peso":"alta"},{"tema":"T6 Tuberculosis","peso":"alta"},{"tema":"T8 Infecciones digestivas","peso":"alta"}]'),

('Inmunología', 'baja', 10, 30,
 'Pocas preguntas propias. Conocimiento transversal útil.',
 '[]'),

('Medicina Familiar y Comunitaria', 'baja', 5, 20,
 'Pocas preguntas. Centrado en prevención y maltrato.',
 '[{"tema":"Prevención y atención al maltrato","peso":"alta"},{"tema":"Factores de riesgo cardiovascular","peso":"alta"}]'),

('Nefrología', 'media_alta', 80, 120,
 'Más de 10 preguntas/año. Hidroelectrolíticos es el tema más complejo y preguntado.',
 '[{"tema":"T2 Trastornos hidroelectrolíticos (Na, K, gasometría)","peso":"alta"},{"tema":"T7 Glomerulonefritis","peso":"alta"},{"tema":"T5 ERC y trasplante renal","peso":"alta"}]'),

('Neumología', 'alta', 150, 220,
 'Más de 20 preguntas/año. Una de las asignaturas con más preguntas.',
 '[{"tema":"T18 Neoplasias pulmonares","peso":"alta"},{"tema":"T4 EPOC","peso":"alta"},{"tema":"T6 Asma","peso":"alta"},{"tema":"T11 TEP","peso":"alta"},{"tema":"T16 Pleura","peso":"alta"},{"tema":"T12 SAHS","peso":"alta"}]'),

('Neurología y Neurocirugía', 'alta', 120, 180,
 'Más de 15 preguntas/año. Ictus es el tema más importante de toda la neurología.',
 '[{"tema":"T4 Ictus y enfermedades vasculares cerebrales","peso":"alta"},{"tema":"T7 Epilepsia","peso":"alta"},{"tema":"T5 Cefaleas","peso":"alta"},{"tema":"T10 Esclerosis múltiple","peso":"alta"},{"tema":"T12 Alzheimer y Parkinson","peso":"alta"}]'),

('Oftalmología', 'media_alta', 60, 100,
 'Más de 10 preguntas/año. Vítreo y retina es el tema estrella.',
 '[{"tema":"T11 Vítreo y retina","peso":"alta"},{"tema":"T10 Uveítis","peso":"alta"},{"tema":"T6 Glaucoma","peso":"alta"}]'),

('Oncología', 'media', 40, 70,
 'Peso moderado. Estudio transversal junto con asignaturas orgánicas.',
 '[{"tema":"Principios generales y estadificación TNM","peso":"alta"},{"tema":"Tratamientos oncológicos","peso":"alta"}]'),

('Otorrinolaringología', 'media_alta', 90, 150,
 'Más de 15 preguntas/año. Otología es el tema más preguntado.',
 '[{"tema":"T2 Otología (hipoacusia, Menière, colesteatoma, vértigo)","peso":"alta"},{"tema":"Pruebas Rinne y Weber","peso":"alta"},{"tema":"Patología nasosinusal","peso":"media"}]'),

('Pediatría', 'alta', 110, 170,
 'Más de 15 preguntas/año. Muy alta en MIR 2026 (11 preguntas).',
 '[{"tema":"T4 Patología digestiva pediátrica","peso":"alta"},{"tema":"T10 Vacunas","peso":"alta"},{"tema":"Patología respiratoria pediátrica","peso":"alta"},{"tema":"Neonatología","peso":"alta"}]'),

('Psiquiatría', 'alta', 150, 220,
 'Más de 20 preguntas/año. Trastornos del ánimo y esquizofrenia son los más preguntados.',
 '[{"tema":"T2 Trastornos del estado de ánimo (litio, antidepresivos)","peso":"alta"},{"tema":"T1 Esquizofrenia y psicosis","peso":"alta"},{"tema":"T6 Trastornos de ansiedad y TOC","peso":"alta"},{"tema":"T8 TCA (anorexia, bulimia)","peso":"alta"}]'),

('Reumatología', 'alta', 100, 160,
 'Más de 15 preguntas/año. Vasculitis y patología musculoesquelética son clave.',
 '[{"tema":"T8 Vasculitis","peso":"alta"},{"tema":"T1 Artritis reumatoide","peso":"alta"},{"tema":"T3 Espondiloartropatías","peso":"alta"},{"tema":"T5 LES","peso":"alta"},{"tema":"T7 Gota","peso":"alta"},{"tema":"T2 Osteoporosis","peso":"alta"}]'),

('Traumatología', 'media_alta', 100, 150,
 '~15 preguntas en los últimos 10 años. Fracturas es el tema central.',
 '[{"tema":"T1 Fracturas (cadera, húmero, radio, escafoides)","peso":"alta"},{"tema":"T3 Lesiones partes blandas","peso":"media"}]'),

('Urgencias', 'media', 20, 50,
 'Situaciones emergentes. Intoxicaciones y triaje son los más preguntados.',
 '[{"tema":"Intoxicaciones agudas","peso":"alta"},{"tema":"Triaje","peso":"alta"}]'),

('Urología', 'media_alta', 50, 100,
 '~10 preguntas en los últimos 10 años. Próstata y litiasis son lo más preguntado.',
 '[{"tema":"T5 HBP y cáncer de próstata","peso":"alta"},{"tema":"T2 ITU","peso":"alta"},{"tema":"T3 Litiasis renal","peso":"alta"}]')

on conflict (especialidad) do update
  set prioridad = excluded.prioridad,
      preguntas_10y_min = excluded.preguntas_10y_min,
      preguntas_10y_max = excluded.preguntas_10y_max,
      notas = excluded.notas,
      temas_clave = excluded.temas_clave;
