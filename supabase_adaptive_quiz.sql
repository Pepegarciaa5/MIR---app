-- Esquema para el Motor de Cuestionarios Adaptativo (Rojo, Naranja, Verde)

-- 1. Estadísticas individuales por pregunta y usuario
CREATE TABLE IF NOT EXISTS user_question_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL, -- O uuid si usas Supabase Auth
  question_id text NOT NULL,
  subject text NOT NULL DEFAULT 'General',
  
  -- Estado actual en el algoritmo SRS
  status text NOT NULL CHECK (status IN ('mastered', 'needs_review')),
  
  -- Para el repaso espaciado
  next_review_date timestamp with time zone,
  
  -- Historial de respuestas (Verde, Naranja, Rojo) para analíticas
  confidence_history jsonb DEFAULT '[]'::jsonb,

  -- Nota personal del usuario para esta pregunta
  note text DEFAULT '',
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  -- Evitar duplicados por usuario y pregunta
  UNIQUE (user_id, question_id)
);


-- 2. Rendimiento por asignatura para el motor de recomendaciones
CREATE TABLE IF NOT EXISTS user_subject_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  subject text NOT NULL,
  
  -- Para calcular qué asignaturas son más prioritarias
  net_score_last_simulacro numeric(5,2) DEFAULT 0,
  profitability_index numeric(5,2) DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  UNIQUE (user_id, subject)
);

-- Políticas RLS básicas
ALTER TABLE user_question_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subject_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read stats" ON user_question_stats FOR SELECT USING (true);
CREATE POLICY "service write stats" ON user_question_stats FOR ALL USING (true);

CREATE POLICY "public read performance" ON user_subject_performance FOR SELECT USING (true);
CREATE POLICY "service write performance" ON user_subject_performance FOR ALL USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_question_stats_modtime
BEFORE UPDATE ON user_question_stats
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_subject_performance_modtime
BEFORE UPDATE ON user_subject_performance
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
