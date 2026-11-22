// Vendas: orçamentos, ordens de serviço, vendas diretas e pagamentos
import { sb, q, cache, procById, procsAtivos, pacientesLeves, totalVenda } from '../db.js?v=202611220031';
import { $, $$, esc, openSheet, closeSheet, toast, fail, opt, fd, iso, addDays, brl, money, kpi, pct, empty, icon, waLink, first, busy, confirmar } from '../ui.js?v=202611220031';
import { seletorPaciente, formPaciente } from '../comp/paciente.js?v=202611220031';
import { registrarAtendimento } from '../comp/atendimento.js?v=202611220031';
import { agendar } from '../comp/agendar.js?v=202611220031';
import { elementoParaPDF, salvarPDF, abrirDocumento } from '../comp/documentos.js?v=202611220031';

const ETAPAS = [['orcamento', 'Orçamentos', 'Aguardando resposta'], ['aprovado', 'Ordens de serviço', 'Aprovadas, a realizar'], ['realizado', 'Realizados', 'Aguardando pagamento'], ['pago', 'Pagos', 'Últimos 30 dias']];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência'];
const n4 = n => String(n).padStart(4, '0');
export const rotulo = v => v.os_numero ? `OS ${n4(v.os_numero)}` : `Orçamento ${n4(v.numero)}`;
let rerender = null;

export async function render(el, [id]) {
  rerender = () => render(el, []);
  const desde = iso(addDays(new Date(), -30));
  const vendas = await q(sb.from('vendas').select('*, venda_itens(*), pacientes(id,nome,telefone,cpf)').or(`status.in.(orcamento,aprovado,realizado),and(status.eq.pago,pago_em.gte.${desde}),and(status.eq.perdido,criado_em.gte.${desde})`).order('criado_em', { ascending: false }));
  const mes = await q(sb.from('vendas').select('status,origem,criado_em').gte('criado_em', addDays(new Date(), -30).toISOString()));
  const orcs = mes.filter(v => v.origem === 'orcamento'), fechou = orcs.filter(v => ['aprovado', 'realizado', 'pago'].includes(v.status));
  const soma = s => vendas.filter(v => v.status === s).reduce((a, v) => a + totalVenda(v), 0);
  el.innerHTML = `<div class="head"><div><div class="eyebrow">Orçamentos e ordens de serviço</div><h1>Vendas</h1><p class="sub">Orçamento aprovado vira ordem de serviço. Use <b>Nova venda</b> quando a paciente decide na hora. Ao registrar o atendimento, o estoque baixa e o pós-venda começa sozinho.</p></div>
    <div class="btns"><button class="btn" id="vOrc">${icon.plus}Novo orçamento</button><button class="btn gold" id="vVenda">${icon.plus}Nova venda</button></div></div>
    <div class="kpis">
      ${kpi('Orçamentos em aberto', money(soma('orcamento')), `${vendas.filter(v => v.status === 'orcamento').length} aguardando resposta`, true)}
      ${kpi('Conversão · 30 dias', orcs.length ? pct(fechou.length / orcs.length) : '—', `${fechou.length} de ${orcs.length} orçamentos fecharam`)}
      ${kpi('OS a realizar', money(soma('aprovado')), `${vendas.filter(v => v.status === 'aprovado').length} ordem(ns) de serviço`)}
      ${kpi('A receber', money(soma('realizado')), `${vendas.filter(v => v.status === 'realizado').length} atendimento(s) sem pagamento`)}
    </div>
    <div class="pipe">${ETAPAS.map(([k, t, s]) => { const l = vendas.filter(v => v.status === k);
      return `<div class="col"><div class="col-h"><h3>${t}</h3><span class="num">${l.length} · ${brl(l.reduce((a, v) => a + totalVenda(v), 0))}</span></div><div class="col-list">${l.length ? l.map(card).join('') : `<div class="empty" style="padding:14px 4px">${s}</div>`}</div></div>`; }).join('')}</div>
    ${vendas.some(v => v.status === 'perdido') ? `<div class="panel" style="margin-top:16px"><div class="panel-h"><h2>Não fecharam</h2><h3>Entram no pós-venda em 30 dias</h3></div><div class="list">${vendas.filter(v => v.status === 'perdido').map(v => `<div class="row click" data-v="${v.id}"><div class="grow"><div class="t">${esc(v.pacientes?.nome)} · ${brl(totalVenda(v))}</div><div class="s">${rotulo(v)} · ${esc(v.motivo_perda || '')}</div></div><span class="chip mute">${fd(v.criado_em)}</span></div>`).join('')}</div></div>` : ''}`;
  $('#vOrc').onclick = () => novaVenda({ origem: 'orcamento' });
  $('#vVenda').onclick = () => novaVenda({ origem: 'direta' });
  el.onclick = e => { const c = e.target.closest('[data-v]'); if (c) abrirVenda(c.dataset.v); };
  if (id) abrirVenda(id);
}

function card(v) {
  const venc = v.status === 'orcamento' && v.validade && v.validade < iso(new Date());
  const chip = { orcamento: venc ? '<span class="chip bad">Validade vencida</span>' : `<span class="chip mute">Válido até ${fd(v.validade).slice(0, 5)}</span>`, aprovado: '<span class="chip warn">A realizar</span>', realizado: '<span class="chip bad">A receber</span>', pago: `<span class="chip ok">Pago ${fd(v.pago_em).slice(0, 5)}</span>` }[v.status];
  return `<button class="so" data-v="${v.id}"><span class="top"><span>${rotulo(v)}${v.origem === 'direta' ? ' · direta' : ''}</span><span>${fd(v.criado_em).slice(0, 5)}</span></span><span class="t">${esc(v.pacientes?.nome)}</span><span class="s">${esc(v.venda_itens.map(i => (Number(i.quantidade) !== 1 ? `${Number(i.quantidade).toLocaleString('pt-BR')}× ` : '') + i.descricao).join(' + '))}</span><span class="bot"><span class="v num">${brl(totalVenda(v))}</span>${chip}</span></button>`;
}

const textoPag = v => { const t = totalVenda(v); return v.parcelas > 1 ? `${v.forma_pagamento} em ${v.parcelas}x de ${brl(t / v.parcelas, 2)}` : (v.forma_pagamento || '—'); };

function papel(v) {
  const c = cache.config, os = !!v.os_numero, p = v.pacientes;
  return `<div class="paper" id="vPaper" style="font-size:13.5px"><img class="logo" src="img/logo.webp" alt="Clínica Alpha" style="width:90px">
    <h2>${os ? 'Ordem de serviço' : 'Orçamento'}</h2><div class="docno">Nº ${n4(os ? v.os_numero : v.numero)}${os && v.origem === 'orcamento' ? ' · referente ao orçamento ' + n4(v.numero) : os ? ' · venda direta' : ''}</div>
    <div class="meta"><div><small>Paciente</small>${esc(p?.nome)}</div><div><small>CPF</small>${esc(p?.cpf || '—')}</div><div><small>Emitido em</small>${fd(v.criado_em)}</div><div><small>${os ? 'Situação' : 'Válido até'}</small>${os ? { aprovado: 'A realizar', realizado: 'Realizado', pago: 'Pago' }[v.status] || '' : fd(v.validade)}</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Procedimento</th><th>Qtd</th><th class="right">Unitário</th><th class="right">Total</th></tr></thead><tbody>${v.venda_itens.map(i => `<tr><td>${esc(i.descricao)}</td><td class="num">${Number(i.quantidade).toLocaleString('pt-BR')} ${esc(procById(i.procedimento_id)?.modo_preco === 'por_unidade' ? procById(i.procedimento_id).unidade : '')}</td><td class="right num">${brl(i.preco_unit, 2)}</td><td class="right num">${brl(i.quantidade * i.preco_unit, 2)}</td></tr>`).join('')}</tbody></table></div>
    <div class="tot num"><div><span>Subtotal</span><span>${brl(totalVenda(v) + Number(v.desconto), 2)}</span></div>${Number(v.desconto) ? `<div><span>Desconto</span><span>− ${brl(v.desconto, 2)}</span></div>` : ''}<div class="g"><span>Total</span><span>${brl(totalVenda(v), 2)}</span></div></div>
    <p style="margin-top:12px"><b>Pagamento:</b> ${esc(textoPag(v))}</p>${v.observacoes ? `<p><b>Observações:</b> ${esc(v.observacoes)}</p>` : ''}
    <p style="text-align:center;margin-top:30px;border-top:1px solid #2b2620;padding-top:6px;max-width:320px;margin-inline:auto;font-size:12px;color:#6a5f4f">${esc(c.profissional || '')} · Biomédica esteta · registro ${esc(c.registro || '')}</p>
    <div class="foot">${esc((c.clinica || 'Clínica Alpha').toUpperCase())} · ${esc(c.telefone || '')}</div></div>`;
}

export async function abrirVenda(id) {
  const v = await q(sb.from('vendas').select('*, venda_itens(*), pacientes(*)').eq('id', id).single());
  const p = v.pacientes, nome = first(p.nome), c = cache.config;
  const lista = v.venda_itens.map(i => `• ${Number(i.quantidade) !== 1 ? Number(i.quantidade).toLocaleString('pt-BR') + '× ' : ''}${i.descricao}`).join('\n');
  const [ats, ags] = await Promise.all([q(sb.from('atendimentos').select('id,procedimento_id').eq('venda_id', id)), q(sb.from('agendamentos').select('id,inicio,status').eq('venda_id', id).neq('status', 'cancelado'))]);
  let acoes = '';
  if (v.status === 'orcamento') acoes = `<div class="panel stack"><h3>Próximo passo</h3>
      <div class="btns"><a class="btn gold" target="_blank" rel="noopener" href="${waLink(p.telefone, `Oi, ${nome}! Segue seu orçamento da ${c.clinica || 'Clínica Alpha'}:\n\n${lista}\n\nTotal: ${brl(totalVenda(v), 2)}\n${textoPag(v)}\nVálido até ${fd(v.validade)}.\n\nQualquer dúvida, estou à disposição. ✨`)}">${icon.wa}Enviar pelo WhatsApp</a><button class="btn" id="vPdf">${icon.doc}Gerar PDF</button><button class="btn" id="vEdit">${icon.edit}Editar</button></div>
      <div class="btns"><button class="btn gold" id="vAprovar">Aprovado · gerar OS</button></div>
      <div class="btns" style="align-items:flex-end"><label class="field" style="flex:1;min-width:200px"><span>Se não fechou, motivo</span><select id="vMotivo">${['Achou caro', 'Vai pensar', 'Escolheu outro lugar', 'Sem disponibilidade agora', 'Sem resposta', 'Outro'].map(o => opt(o)).join('')}</select></label><button class="btn" id="vPerdido">Não fechou</button></div></div>`;
  else if (v.status === 'aprovado') acoes = `<div class="panel stack"><h3>Realizar</h3>
      <p class="muted small" style="margin:0">${ags.length ? `Agendado: ${ags.map(a => fd(a.inicio) + ' ' + new Date(a.inicio).toTimeString().slice(0, 5)).join(', ')}.` : 'Ainda sem horário na agenda.'} ${ats.length ? `${ats.length} de ${v.venda_itens.length} item(ns) já registrados.` : ''}</p>
      <div class="btns"><button class="btn" id="vAgendar">Agendar</button><button class="btn gold" id="vAtender">Registrar atendimento</button>${ats.length ? '<button class="btn" id="vRealizado">Marcar como realizado</button>' : ''}<button class="btn" id="vPdf">${icon.doc}PDF da OS</button></div></div>`;
  else if (v.status === 'realizado') acoes = `<div class="panel stack"><h3>Registrar pagamento</h3>
      <div class="fields f3"><label class="field"><span>Forma</span><select id="pgForma">${FORMAS.map(f => opt(f, null, v.forma_pagamento)).join('')}</select></label><label class="field"><span>Parcelas</span><input type="number" id="pgParc" min="1" max="18" value="${v.parcelas}"></label><label class="field"><span>Taxa da maquininha (%)</span><input type="number" id="pgTaxa" step="0.01" min="0"></label><label class="field"><span>Data</span><input type="date" id="pgData" value="${iso(new Date())}"></label></div>
      <div class="btns end"><button class="btn gold" id="vPagar">Registrar ${brl(totalVenda(v), 2)}</button></div><p class="hint" style="margin:0">No cartão de crédito, cada parcela entra em Contas a receber com vencimento mês a mês.</p></div>`;
  else if (v.status === 'pago') acoes = `<div class="panel"><p class="muted" style="margin:0">Pago em ${fd(v.pago_em)} · ${esc(textoPag(v))}.</p><div class="btns" style="margin-top:12px"><a class="btn" target="_blank" rel="noopener" href="${waLink(p.telefone, `Oi, ${nome}! Obrigada pela confiança. Seu pagamento de ${brl(totalVenda(v), 2)} foi confirmado. Qualquer coisa nos próximos dias, me chama aqui. 🤍`)}">${icon.wa}Enviar agradecimento</a><button class="btn" id="vPdf">${icon.doc}PDF</button></div></div>`;
  else acoes = `<div class="panel"><p class="muted" style="margin:0">Não fechou: ${esc(v.motivo_perda || '')}. A paciente volta no pós-venda em 30 dias.</p><div class="btns" style="margin-top:12px"><button class="btn" id="vReabrir">Reabrir orçamento</button></div></div>`;

  const b = openSheet({ eyebrow: { orcamento: 'Orçamento', aprovado: 'Ordem de serviço', realizado: 'Realizado · a receber', pago: 'Pago', perdido: 'Não fechou' }[v.status], title: `${rotulo(v)} · ${nome}`, body: `${papel(v)}<div class="stack" style="margin-top:18px">${acoes}${v.status !== 'pago' ? '<div class="btns end"><button class="btn danger sm" id="vDel">Excluir</button></div>' : ''}</div>` });
  const re = () => { rerender && location.hash.startsWith('#/vendas') && rerender(); abrirVenda(id); };
  const on = (sel, fn) => { const x = $(sel, b); if (x) x.onclick = fn; };
  on('#vPdf', async e => busy(e.currentTarget, async () => { try { const blob = await elementoParaPDF($('#vPaper', b)); const d = await salvarPDF({ paciente_id: p.id, tipo: v.os_numero ? 'os' : 'orcamento', titulo: rotulo(v), blob }); abrirDocumento(d.pdf_caminho); toast('PDF salvo nos documentos da paciente.'); } catch (err) { fail(err); } }));
  on('#vEdit', () => novaVenda({ venda: v }));
  on('#vAprovar', async () => { try { await q(sb.from('vendas').update({ status: 'aprovado' }).eq('id', id)); toast('Aprovado. Ordem de serviço gerada.'); agendar({ paciente_id: p.id, procedimento_id: v.venda_itens[0]?.procedimento_id, venda_id: id, onSaved: re }); } catch (err) { fail(err); } });
  on('#vPerdido', async () => { try { await q(sb.from('vendas').update({ status: 'perdido', motivo_perda: $('#vMotivo', b).value }).eq('id', id)); toast('Registrado. Volta no pós-venda em 30 dias.'); closeSheet(); rerender && rerender(); } catch (err) { fail(err); } });
  on('#vReabrir', async () => { try { await q(sb.from('vendas').update({ status: 'orcamento', motivo_perda: null, validade: iso(addDays(new Date(), 15)) }).eq('id', id)); re(); } catch (err) { fail(err); } });
  on('#vAgendar', () => agendar({ paciente_id: p.id, procedimento_id: v.venda_itens[0]?.procedimento_id, venda_id: id, onSaved: re }));
  on('#vRealizado', async () => { try { await q(sb.from('vendas').update({ status: 'realizado' }).eq('id', id)); toast('Marcado como realizado.'); re(); } catch (err) { fail(err); } });
  on('#vAtender', () => {
    const feitos = new Set(ats.map(a => a.procedimento_id)); const faltam = v.venda_itens.filter(i => !feitos.has(i.procedimento_id));
    const fila = faltam.length ? faltam : v.venda_itens;
    const passo = k => {
      const it = fila[k];
      registrarAtendimento({ paciente: p, procedimento_id: it.procedimento_id, valor: Number(it.quantidade) * Number(it.preco_unit) - (k === 0 ? Number(v.desconto) : 0), venda_id: id, agendamento_id: ags.find(a => a.status !== 'realizado')?.id,
        proximo: k + 1 < fila.length ? () => passo(k + 1) : null,
        depois: async () => { if (k + 1 >= fila.length) { await q(sb.from('vendas').update({ status: 'realizado' }).eq('id', id)); toast('OS realizada. Falta registrar o pagamento.'); re(); } } });
    };
    passo(0);
  });
  on('#vPagar', async e => busy(e.currentTarget, async () => {
    try {
      const forma = $('#pgForma', b).value;
      let taxa = $('#pgTaxa', b).value; if (taxa === '') taxa = forma === 'Cartão de crédito' ? (Number($('#pgParc', b).value) > 1 ? c.taxa_credito_parcelado : c.taxa_credito_avista) : forma === 'Cartão de débito' ? c.taxa_debito : 0;
      await q(sb.rpc('registrar_pagamento', { p_venda: id, p_forma: forma, p_parcelas: Number($('#pgParc', b).value) || 1, p_taxa_pct: Number(taxa) || 0, p_data: $('#pgData', b).value }));
      toast('Pagamento registrado.'); re();
    } catch (err) { fail(err); }
  }));
  on('#vDel', async () => {
    if (!(await confirmar('Excluir esta venda?', ats.length ? 'Os atendimentos registrados continuam no prontuário; só a venda é excluída.' : 'Esta ação não pode ser desfeita.', 'Excluir', true))) return;
    try { await q(sb.from('vendas').delete().eq('id', id)); closeSheet(); toast('Venda excluída.'); rerender && rerender(); } catch (err) { fail(err); }
  });
}

// Formulário de orçamento / venda direta
export async function novaVenda({ origem = 'orcamento', paciente_id = null, venda = null } = {}) {
  const pacs = await pacientesLeves();
  const d = venda ? { origem: venda.origem, paciente_id: venda.paciente_id, itens: venda.venda_itens.map(i => ({ procedimento_id: i.procedimento_id, descricao: i.descricao, quantidade: Number(i.quantidade), preco_unit: Number(i.preco_unit) })), desconto: Number(venda.desconto), forma: venda.forma_pagamento, parcelas: venda.parcelas, validade: venda.validade, obs: venda.observacoes || '' }
    : { origem, paciente_id, itens: [], desconto: 0, forma: 'Pix', parcelas: 1, validade: iso(addDays(new Date(), 15)), obs: '' };
  const procs = procsAtivos();
  const novoItem = pid => { const p = procById(pid) || procs[0]; return { procedimento_id: p?.id, descricao: p?.nome || '', quantidade: 1, preco_unit: Number(p?.preco || 0) }; };
  if (!d.itens.length) d.itens.push(novoItem());
  const direta = d.origem === 'direta';
  const b = openSheet({ eyebrow: venda ? 'Editar orçamento' : direta ? 'Venda direta · sem orçamento' : 'Orçamento para enviar', title: venda ? rotulo(venda) : direta ? 'Nova venda' : 'Novo orçamento', body: `
    <div class="panel stack">
      <div class="fields f3"><div class="field w2"><span>Paciente *</span><div style="display:flex;gap:8px">${seletorPaciente(pacs, d.paciente_id)}<button class="btn icon" id="nvPac" aria-label="Nova paciente" title="Nova paciente">${icon.plus}</button></div></div>
        ${direta ? '' : `<label class="field"><span>Válido até</span><input type="date" id="nvVal" value="${d.validade}"></label>`}</div>
      <div><h3>Procedimentos</h3><div class="items" id="nvItens"></div><button class="btn sm" id="nvAdd">+ Procedimento</button></div>
      <div class="fields"><label class="field"><span>Desconto (R$)</span><input type="number" id="nvDesc" min="0" step="10" value="${d.desconto}"></label>
        <label class="field"><span>Forma de pagamento</span><select id="nvForma">${FORMAS.map(f => opt(f, null, d.forma)).join('')}</select></label>
        <label class="field"><span>Parcelas</span><input type="number" id="nvParc" min="1" max="18" value="${d.parcelas}"></label>
        <label class="field"><span>Observações</span><input id="nvObs" value="${esc(d.obs)}" placeholder="ex.: protocolo de 3 sessões"></label></div>
      <div class="totals num" id="nvTot"></div>
      <div class="btns end"><button class="btn" id="nvCancel">Cancelar</button><button class="btn gold" id="nvSave">${venda ? 'Salvar' : direta ? 'Registrar venda' : 'Salvar orçamento'}</button></div>
    </div>` });
  const tot = () => { const s = d.itens.reduce((a, i) => a + i.quantidade * i.preco_unit, 0), t = Math.max(0, s - d.desconto); $('#nvTot', b).innerHTML = `<span>Subtotal ${brl(s, 2)}${d.desconto ? ' · desconto ' + brl(d.desconto, 2) : ''}</span><span class="g">${brl(t, 2)}</span><span>${d.parcelas > 1 ? `${d.parcelas}x de ${brl(t / d.parcelas, 2)}` : d.forma}</span>`; };
  const itens = () => {
    $('#nvItens', b).innerHTML = d.itens.map((it, k) => { const p = procById(it.procedimento_id); return `<div class="item"><select data-k="${k}" data-f="procedimento_id" aria-label="Procedimento">${procs.map(x => opt(x.id, x.nome, it.procedimento_id)).join('')}</select>
      <input type="number" min="0" step="${p?.modo_preco === 'por_unidade' ? '0.1' : '1'}" data-k="${k}" data-f="quantidade" value="${it.quantidade}" aria-label="Quantidade" title="${p?.modo_preco === 'por_unidade' ? 'Quantidade em ' + p.unidade : 'Quantidade'}">
      <input type="number" min="0" step="0.01" data-k="${k}" data-f="preco_unit" value="${it.preco_unit}" aria-label="Valor unitário" title="${p?.modo_preco === 'por_unidade' ? 'Preço por ' + p.unidade : 'Valor'}">
      <button class="rm" data-rm="${k}" aria-label="Remover">×</button></div>`; }).join('');
    tot();
  };
  itens();
  $('#nvItens', b).addEventListener('input', e => { const k = e.target.dataset.k; if (k == null) return; const it = d.itens[+k], f = e.target.dataset.f;
    if (f === 'procedimento_id') { Object.assign(it, novoItem(e.target.value)); itens(); return; } it[f] = Number(e.target.value) || 0; tot(); });
  $('#nvItens', b).addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { if (d.itens.length > 1) { d.itens.splice(+r.dataset.rm, 1); itens(); } else toast('Inclua pelo menos um procedimento.', true); } });
  $('#nvAdd', b).onclick = () => { d.itens.push(novoItem()); itens(); };
  $('#nvDesc', b).oninput = e => { d.desconto = Number(e.target.value) || 0; tot(); };
  $('#nvForma', b).onchange = e => { d.forma = e.target.value; tot(); };
  $('#nvParc', b).oninput = e => { d.parcelas = Math.max(1, Number(e.target.value) || 1); tot(); };
  $('#nvCancel', b).onclick = closeSheet;
  $('#nvPac', b).onclick = () => formPaciente({}, p => novaVenda({ origem: d.origem, paciente_id: p.id }));
  $('#nvSave', b).onclick = async e => {
    const pid = $('[name="paciente_id"]', b).value; if (!pid) { toast('Escolha a paciente.', true); return; }
    await busy(e.currentTarget, async () => {
      try {
        const row = { paciente_id: pid, desconto: d.desconto, forma_pagamento: d.forma, parcelas: d.parcelas, observacoes: $('#nvObs', b).value.trim() || null, validade: direta ? iso(new Date()) : $('#nvVal', b).value };
        let vid;
        if (venda) { await q(sb.from('vendas').update(row).eq('id', venda.id)); await q(sb.from('venda_itens').delete().eq('venda_id', venda.id)); vid = venda.id; }
        else { const nv = await q(sb.from('vendas').insert({ ...row, origem: d.origem, status: direta ? 'aprovado' : 'orcamento' }).select().single()); vid = nv.id; }
        await q(sb.from('venda_itens').insert(d.itens.map(i => ({ venda_id: vid, procedimento_id: i.procedimento_id, descricao: i.descricao || procById(i.procedimento_id)?.nome, quantidade: i.quantidade, preco_unit: i.preco_unit }))));
        toast(venda ? 'Orçamento atualizado.' : direta ? 'Venda registrada como ordem de serviço.' : 'Orçamento salvo. Envie pelo WhatsApp.');
        if (location.hash.startsWith('#/vendas')) rerender && rerender();
        abrirVenda(vid);
      } catch (err) { fail(err); }
    });
  };
}
