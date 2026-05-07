-- Actualizar seguridad + tabla de diario
-- Ejecutar en Supabase → SQL Editor → New query

-- 1. ELIMINAR políticas de escritura pública
drop policy if exists "service write tracker_entries" on tracker_entries;
drop policy if exists "service write repasos" on repasos;
drop policy if exists "service write bloques_completados" on bloques_completados;
drop policy if exists "service write bloques_descartados" on bloques_descartados;
drop policy if exists "service write planes_adicionales" on planes_adicionales;

-- 2. Crear tabla de posts del diario
create table if not exists diario_posts (
  id bigint primary key,
  titulo text not null,
  contenido text not null,
  emoji text default '📖',
  horas_estudiadas real default 0,
  asignaturas text[] default '{}',
  fecha text not null,
  created_at timestamp with time zone default now()
);

-- 3. Lectura pública del diario
alter table diario_posts enable row level security;
create policy "public read diario_posts" on diario_posts for select using (true);
