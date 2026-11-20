-- Clínica Alpha · esquema do banco de dados
-- Tudo protegido por RLS: só quem está na tabela "equipe" lê ou grava.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Equipe e acesso
-- ---------------------------------------------------------------
create table public.equipe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text not null default 'dona' check (papel in ('dona','secretaria')),
  criado_em timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where user_id = auth.uid());
$$;

-- O primeiro usuário a entrar vira a dona da clínica. Depois disso, ninguém mais entra sozinho.
create or replace function public.reivindicar_clinica(p_nome text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.equipe where user_id = auth.uid()) then return true; end if;
  if exists (select 1 from public.equipe) then return false; end if;
  insert into public.equipe(user_id, nome, papel) values (auth.uid(), p_nome, 'dona');
  return true;
end $$;
revoke all on function public.reivindicar_clinica(text) from public, anon;
grant execute on function public.reivindicar_clinica(text) to authenticated;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------
-- Configurações da clínica (uma linha)
-- ---------------------------------------------------------------
create table public.config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Catálogo de procedimentos
-- ---------------------------------------------------------------
create table public.procedimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'Injetável',
  unidade text not null default 'sessão',          -- U, ml, frasco, seringa, sessão
  modo_preco text not null default 'fixo' check (modo_preco in ('fixo','por_unidade')),
  preco numeric(10,2) not null default 0,           -- preço fixo, ou preço por unidade
  custo_estimado numeric(10,2) not null default 0,  -- insumos que não estão no estoque
  duracao_min int not null default 60,
  ciclo_dias int,                                   -- tempo médio de efeito (manutenção)
  revisao_dias int,                                 -- retorno de revisão (ex.: 15)
  sessoes int not null default 1,
  intervalo_sessoes_dias int,
  categoria_estoque text,                           -- liga ao estoque (Toxina, Preenchedor...)
  areas text[] not null default '{}',
  termo text,                                       -- termo sugerido
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Pacientes e prontuário
-- ---------------------------------------------------------------
create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  nascimento date,
  sexo text,
  telefone text,
  email text,
  endereco text,
  bairro text,
  cidade text default 'Fortaleza',
  cep text,
  profissao text,
  origem text,
  observacoes text,
  uso_imagem boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.pacientes (lower(nome));

create table public.anamneses (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index on public.anamneses (paciente_id, criado_em desc);

-- ---------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,                          -- Toxina, Preenchedor, Bioestimulador...
  fabricante text,
  unidade text not null default 'un',               -- unidade de consumo: U, ml, un, frasco, seringa
  conteudo numeric(10,2) not null default 1,        -- quanto 1 embalagem tem nessa unidade (Botox 100U = 100)
  embalagem text not null default 'frasco',
  estoque_minimo numeric(10,2) not null default 0,  -- em embalagens
  prazo_aberto_dias int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  lote text not null,
  validade date,
  fornecedor text,
  custo_embalagem numeric(10,2) not null default 0,
  saldo numeric(10,2) not null default 0,           -- na unidade de consumo do produto
  aberto_em date,
  entrada_em date not null default current_date,
  criado_em timestamptz not null default now()
);
create index on public.lotes (produto_id, validade);

-- ---------------------------------------------------------------
-- Vendas: orçamentos, ordens de serviço, vendas diretas
-- ---------------------------------------------------------------
create sequence public.seq_orcamento start 1;
create sequence public.seq_os start 1;

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  numero int not null default nextval('public.seq_orcamento'),
  os_numero int,
  origem text not null default 'orcamento' check (origem in ('orcamento','direta')),
  status text not null default 'orcamento' check (status in ('orcamento','aprovado','realizado','pago','perdido')),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  desconto numeric(10,2) not null default 0,
  forma_pagamento text default 'Pix',
  parcelas int not null default 1,
  validade date,
  motivo_perda text,
  observacoes text,
  pago_em date,
  criado_em timestamptz not null default now()
);
create index on public.vendas (status);
create index on public.vendas (paciente_id);

create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  descricao text not null,
  quantidade numeric(10,2) not null default 1,
  preco_unit numeric(10,2) not null default 0
);

-- ---------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------
create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  venda_id uuid references public.vendas(id) on delete set null,
  inicio timestamptz not null,
  duracao_min int not null default 60,
  status text not null default 'agendado' check (status in ('agendado','confirmado','realizado','faltou','cancelado')),
  observacoes text,
  criado_em timestamptz not null default now()
);
create index on public.agendamentos (inicio);

-- ---------------------------------------------------------------
-- Atendimentos (registro técnico) e aplicações por área
-- ---------------------------------------------------------------
create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  venda_id uuid references public.vendas(id) on delete set null,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  data timestamptz not null default now(),
  sessao int not null default 1,
  valor numeric(10,2) not null default 0,
  tecnica text,
  observacoes text,
  intercorrencias text,
  criado_em timestamptz not null default now()
);
create index on public.atendimentos (paciente_id, data desc);
create index on public.atendimentos (data);

create table public.aplicacoes (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  area text not null,
  quantidade numeric(10,2) not null default 0,
  unidade text not null,
  produto_id uuid references public.produtos(id) on delete set null,
  lote_id uuid references public.lotes(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.aplicacoes (atendimento_id);

create table public.movimentos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste','perda')),
  quantidade numeric(10,2) not null,                -- positiva soma, negativa tira
  atendimento_id uuid references public.atendimentos(id) on delete set null,
  aplicacao_id uuid references public.aplicacoes(id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now()
);
create index on public.movimentos (criado_em desc);

-- ---------------------------------------------------------------
-- Fotos de antes e depois · documentos assinados
-- ---------------------------------------------------------------
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  atendimento_id uuid references public.atendimentos(id) on delete set null,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  area text,
  angulo text,                                      -- Frente, Perfil direito, 45° esquerdo...
  momento text not null default 'antes' check (momento in ('antes','depois','retorno')),
  caminho text not null,
  tirada_em date not null default current_date,
  observacao text,
  criado_em timestamptz not null default now()
);
create index on public.fotos (paciente_id, tirada_em desc);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  atendimento_id uuid references public.atendimentos(id) on delete set null,
  tipo text not null,
  titulo text not null,
  dados jsonb not null default '{}'::jsonb,
  pdf_caminho text,
  sha256 text,
  assinado_em timestamptz not null default now()
);
create index on public.documentos (paciente_id, assinado_em desc);

-- ---------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------
create table public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid references public.vendas(id) on delete cascade,
  paciente_id uuid references public.pacientes(id) on delete set null,
  descricao text,
  parcela int not null default 1,
  total_parcelas int not null default 1,
  valor numeric(10,2) not null,
  taxa numeric(10,2) not null default 0,            -- taxa da maquininha
  forma text,
  vencimento date not null,
  recebido_em date,
  criado_em timestamptz not null default now()
);
create index on public.recebimentos (vencimento);

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null default 'Fixa',
  fornecedor text,
  valor numeric(10,2) not null,
  vencimento date not null,
  pago_em date,
  recorrente boolean not null default false,
  lote_id uuid references public.lotes(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.contas (vencimento);

-- ---------------------------------------------------------------
-- Pós-venda
-- ---------------------------------------------------------------
create table public.posvenda (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  atendimento_id uuid references public.atendimentos(id) on delete cascade,
  venda_id uuid references public.vendas(id) on delete cascade,
  tipo text not null check (tipo in ('d1','revisao','manutencao','sessao','orcamento','reativacao','outro')),
  titulo text not null,
  contexto text,
  data_prevista date not null,
  status text not null default 'pendente' check (status in ('pendente','feito','cancelado')),
  resultado text,
  feito_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on public.posvenda (status, data_prevista);

-- ---------------------------------------------------------------
-- Registro de acesso e alterações (LGPD)
-- ---------------------------------------------------------------
create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  operacao text not null,
  registro_id uuid,
  user_id uuid default auth.uid(),
  em timestamptz not null default now()
);

create or replace function public.tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria(tabela, operacao, registro_id)
  values (tg_table_name, tg_op, coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null));
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['pacientes','anamneses','atendimentos','aplicacoes','fotos','documentos'] loop
    execute format('create trigger aud_%1$s after insert or update or delete on public.%1$I for each row execute function public.tg_auditoria()', t);
  end loop;
end $$;
