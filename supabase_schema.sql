-- Esquema para MIR Prep App
-- Ejecutar en Supabase → SQL Editor → New query

-- 1. Entradas del cronómetro (horas trabajadas)
create table if not exists tracker_entries (
  id text primary key,
  descripcion text,
  especialidad text,
  tema text,
  bloque_id text,
  repaso_id text,
  inicio bigint not null,
  fin bigint,
  duracion_segundos integer not null default 0,
  fecha text not null,
  created_at timestamp with time zone default now()
);

-- 2. Repasos (spaced repetition)
create table if not exists repasos (
  id bigint primary key,
  titulo text,
  especialidad text,
  tema text,
  destino_guardado text,
  minutos_repaso integer,
  fase integer default 0,
  fecha_proximo_repaso bigint,
  confianza integer,
  created_at timestamp with time zone default now()
);

-- 3. Bloques completados del calendario
create table if not exists bloques_completados (
  id text primary key,
  created_at timestamp with time zone default now()
);

-- 4. Bloques descartados del calendario
create table if not exists bloques_descartados (
  id text primary key,
  created_at timestamp with time zone default now()
);

-- 5. Planes adicionales (eventos añadidos manualmente)
create table if not exists planes_adicionales (
  id text primary key,
  fecha text not null,
  inicio text,
  fin text,
  titulo text,
  especialidad text,
  tema text,
  created_at timestamp with time zone default now()
);

-- Acceso público de solo lectura (para el blog público)
alter table tracker_entries enable row level security;
alter table repasos enable row level security;
alter table bloques_completados enable row level security;
alter table bloques_descartados enable row level security;
alter table planes_adicionales enable row level security;

-- Cualquiera puede leer (blog público)
create policy "public read tracker_entries" on tracker_entries for select using (true);
create policy "public read repasos" on repasos for select using (true);
create policy "public read bloques_completados" on bloques_completados for select using (true);
create policy "public read bloques_descartados" on bloques_descartados for select using (true);
create policy "public read planes_adicionales" on planes_adicionales for select using (true);

-- Solo escritura con service role (desde la app con tu clave)
create policy "service write tracker_entries" on tracker_entries for all using (true);
create policy "service write repasos" on repasos for all using (true);
create policy "service write bloques_completados" on bloques_completados for all using (true);
create policy "service write bloques_descartados" on bloques_descartados for all using (true);
create policy "service write planes_adicionales" on planes_adicionales for all using (true);
