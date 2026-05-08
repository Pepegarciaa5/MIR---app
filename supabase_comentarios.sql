-- ── Tabla de comentarios públicos ───────────────────────────────────────────
-- Ejecutar en Supabase SQL Editor antes de usar el foro/comentarios

create table if not exists comentarios (
  id         bigint generated always as identity primary key,
  autor      text not null,
  texto      text not null,
  tipo       text not null default 'foro',   -- 'foro' | 'timeline'
  ref_id     text,                            -- null = foro general, o id de entry/post
  created_at timestamptz default now()
);

-- RLS: lectura pública, inserción pública, borrado solo con service_role (admin)
alter table comentarios enable row level security;

create policy "public read comentarios"
  on comentarios for select using (true);

create policy "public insert comentarios"
  on comentarios for insert with check (
    length(trim(autor)) >= 1 and
    length(trim(texto)) >= 1 and
    length(trim(texto)) <= 1000
  );

-- Solo service_role puede borrar (el admin usa VITE_SUPABASE_SERVICE_KEY)
create policy "service delete comentarios"
  on comentarios for delete using (true);
