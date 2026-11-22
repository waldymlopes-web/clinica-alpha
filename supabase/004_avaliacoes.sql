-- Clínica Alpha · avaliações (questionário, plano e fotos marcadas)

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,   -- queixas, intensidade, contexto
  plano jsonb not null default '{}'::jsonb,       -- procedimentos sugeridos, fases, observações
  marcacoes jsonb not null default '[]'::jsonb,   -- descrição dos pontos marcados nas fotos
  venda_id uuid references public.vendas(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.avaliacoes (paciente_id, criado_em desc);

alter table public.avaliacoes enable row level security;
create policy equipe_total on public.avaliacoes for all to authenticated using (public.is_staff()) with check (public.is_staff());
create trigger aud_avaliacoes after insert or update or delete on public.avaliacoes for each row execute function public.tg_auditoria();

alter table public.fotos add column avaliacao_id uuid references public.avaliacoes(id) on delete set null;
alter table public.fotos add column original_caminho text;   -- foto sem marcação, quando a salva é a marcada
alter table public.fotos drop constraint fotos_momento_check;
alter table public.fotos add constraint fotos_momento_check check (momento in ('antes','depois','retorno','avaliacao'));
create index on public.fotos (avaliacao_id);
