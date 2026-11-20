-- Clínica Alpha · automações (estoque, pós-venda, numeração) e regras de acesso

-- ---------------------------------------------------------------
-- Baixa de estoque quando uma aplicação usa um lote
-- ---------------------------------------------------------------
create or replace function public.tg_aplicacao_estoque() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_at uuid;
begin
  if tg_op = 'INSERT' and new.lote_id is not null and new.quantidade > 0 then
    update public.lotes set saldo = greatest(0, saldo - new.quantidade),
      aberto_em = coalesce(aberto_em, current_date)
      where id = new.lote_id;
    insert into public.movimentos(lote_id, tipo, quantidade, atendimento_id, aplicacao_id, observacao)
      values (new.lote_id, 'saida', -new.quantidade, new.atendimento_id, new.id, new.area);
  elsif tg_op = 'DELETE' and old.lote_id is not null and old.quantidade > 0 then
    update public.lotes set saldo = saldo + old.quantidade where id = old.lote_id;
    delete from public.movimentos where aplicacao_id = old.id;
  end if;
  return coalesce(new, old);
end $$;
create trigger aplicacao_estoque after insert or delete on public.aplicacoes
  for each row execute function public.tg_aplicacao_estoque();

-- Movimento de entrada ao cadastrar lote
create or replace function public.tg_lote_entrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.saldo > 0 then
    insert into public.movimentos(lote_id, tipo, quantidade, observacao)
      values (new.id, 'entrada', new.saldo, coalesce('Entrada · ' || new.fornecedor, 'Entrada'));
  end if;
  return new;
end $$;
create trigger lote_entrada after insert on public.lotes
  for each row execute function public.tg_lote_entrada();

-- Ajuste manual de saldo (perda, contagem, aplicação sem registro)
create or replace function public.ajustar_lote(p_lote uuid, p_quantidade numeric, p_tipo text, p_obs text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'sem acesso'; end if;
  if p_tipo not in ('ajuste','perda','entrada','saida') then raise exception 'tipo inválido'; end if;
  update public.lotes set saldo = greatest(0, saldo + p_quantidade) where id = p_lote;
  insert into public.movimentos(lote_id, tipo, quantidade, observacao) values (p_lote, p_tipo, p_quantidade, p_obs);
end $$;
revoke all on function public.ajustar_lote(uuid, numeric, text, text) from public, anon;
grant execute on function public.ajustar_lote(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------
-- Pós-venda automático a cada atendimento
-- ---------------------------------------------------------------
create or replace function public.tg_atendimento_posvenda() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; v_dia date := (new.data at time zone 'America/Sao_Paulo')::date;
begin
  select * into p from public.procedimentos where id = new.procedimento_id;
  insert into public.posvenda(paciente_id, atendimento_id, tipo, titulo, contexto, data_prevista)
    values (new.paciente_id, new.id, 'd1', 'Como você está? · D+1', coalesce(p.nome, 'Atendimento'), v_dia + 1);
  if p.revisao_dias is not null then
    insert into public.posvenda(paciente_id, atendimento_id, tipo, titulo, contexto, data_prevista)
      values (new.paciente_id, new.id, 'revisao', 'Revisão · D+' || p.revisao_dias, p.nome, v_dia + p.revisao_dias);
  end if;
  if p.sessoes > 1 and new.sessao < p.sessoes and p.intervalo_sessoes_dias is not null then
    insert into public.posvenda(paciente_id, atendimento_id, tipo, titulo, contexto, data_prevista)
      values (new.paciente_id, new.id, 'sessao', 'Próxima sessão · ' || (new.sessao + 1) || ' de ' || p.sessoes, p.nome, v_dia + p.intervalo_sessoes_dias - 3);
  end if;
  if p.ciclo_dias is not null then
    -- encerra lembretes de manutenção antigos do mesmo procedimento
    update public.posvenda pv set status = 'cancelado', resultado = 'Substituído por novo atendimento'
      where pv.paciente_id = new.paciente_id and pv.tipo = 'manutencao' and pv.status = 'pendente'
        and pv.atendimento_id in (select a.id from public.atendimentos a where a.procedimento_id = new.procedimento_id and a.id <> new.id);
    insert into public.posvenda(paciente_id, atendimento_id, tipo, titulo, contexto, data_prevista)
      values (new.paciente_id, new.id, 'manutencao', 'Hora da manutenção', p.nome || ' · efeito médio de ' || p.ciclo_dias || ' dias', v_dia + p.ciclo_dias - 10);
  end if;
  return new;
end $$;
create trigger atendimento_posvenda after insert on public.atendimentos
  for each row execute function public.tg_atendimento_posvenda();

-- ---------------------------------------------------------------
-- Vendas: número de OS, follow-up de orçamento, recebimentos
-- ---------------------------------------------------------------
create or replace function public.tg_venda_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('aprovado','realizado','pago') and new.os_numero is null then
    new.os_numero := nextval('public.seq_os');
  end if;
  return new;
end $$;
create trigger venda_status before insert or update of status on public.vendas
  for each row execute function public.tg_venda_status();

create or replace function public.tg_venda_posvenda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'orcamento' then
    insert into public.posvenda(paciente_id, venda_id, tipo, titulo, contexto, data_prevista)
      values (new.paciente_id, new.id, 'orcamento', 'Orçamento sem resposta', 'Orçamento nº ' || new.numero, current_date + 3);
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if old.status = 'orcamento' then
      update public.posvenda set status = 'cancelado', resultado = 'Orçamento respondido'
        where venda_id = new.id and tipo = 'orcamento' and status = 'pendente';
    end if;
    if new.status = 'perdido' then
      insert into public.posvenda(paciente_id, venda_id, tipo, titulo, contexto, data_prevista)
        values (new.paciente_id, new.id, 'reativacao', 'Retomar orçamento não fechado', coalesce(new.motivo_perda, 'Não fechou'), current_date + 30);
    end if;
  end if;
  return new;
end $$;
create trigger venda_posvenda after insert or update of status on public.vendas
  for each row execute function public.tg_venda_posvenda();

-- Registra o pagamento de uma venda e gera as parcelas a receber
create or replace function public.registrar_pagamento(p_venda uuid, p_forma text, p_parcelas int, p_taxa_pct numeric, p_data date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare v record; v_total numeric; v_parc numeric; i int;
begin
  if not public.is_staff() then raise exception 'sem acesso'; end if;
  select * into v from public.vendas where id = p_venda;
  select coalesce(sum(quantidade * preco_unit), 0) - v.desconto into v_total from public.venda_itens where venda_id = p_venda;
  delete from public.recebimentos where venda_id = p_venda and recebido_em is null;
  p_parcelas := greatest(1, coalesce(p_parcelas, 1));
  v_parc := round(v_total / p_parcelas, 2);
  for i in 1..p_parcelas loop
    insert into public.recebimentos(venda_id, paciente_id, descricao, parcela, total_parcelas, valor, taxa, forma, vencimento, recebido_em)
    values (p_venda, v.paciente_id, 'Venda nº ' || v.numero, i, p_parcelas,
      case when i = p_parcelas then v_total - v_parc * (p_parcelas - 1) else v_parc end,
      round((case when i = p_parcelas then v_total - v_parc * (p_parcelas - 1) else v_parc end) * coalesce(p_taxa_pct, 0) / 100, 2),
      p_forma,
      case when p_forma = 'Cartão de crédito' then p_data + 30 * i else p_data end,
      case when p_forma = 'Cartão de crédito' then null else p_data end);
  end loop;
  update public.vendas set status = 'pago', pago_em = p_data, forma_pagamento = p_forma, parcelas = p_parcelas where id = p_venda;
end $$;
revoke all on function public.registrar_pagamento(uuid, text, int, numeric, date) from public, anon;
grant execute on function public.registrar_pagamento(uuid, text, int, numeric, date) to authenticated;

-- ---------------------------------------------------------------
-- RLS: tudo fechado, só a equipe acessa
-- ---------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['config','procedimentos','pacientes','anamneses','produtos','lotes','vendas','venda_itens',
    'agendamentos','atendimentos','aplicacoes','movimentos','fotos','documentos','recebimentos','contas','posvenda'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy equipe_total on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

alter table public.equipe enable row level security;
create policy equipe_ve_a_si on public.equipe for select to authenticated using (user_id = auth.uid() or public.is_staff());

alter table public.auditoria enable row level security;
create policy auditoria_leitura on public.auditoria for select to authenticated using (public.is_staff());

grant usage on sequence public.seq_orcamento, public.seq_os to authenticated;

-- ---------------------------------------------------------------
-- Arquivos privados: fotos e documentos
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('fotos', 'fotos', false, 15728640), ('documentos', 'documentos', false, 15728640)
on conflict (id) do nothing;

create policy clinica_arquivos_ler on storage.objects for select to authenticated
  using (bucket_id in ('fotos','documentos') and public.is_staff());
create policy clinica_arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id in ('fotos','documentos') and public.is_staff());
create policy clinica_arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_staff());
