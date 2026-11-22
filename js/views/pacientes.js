// Pacientes e prontuário completo
import { sb, q, cache, procById, pacientesLeves, totalVenda } from '../db.js?v=202611220031';
import { $, $$, esc, ini, age, fd, fdt, brl, nfmt, empty, icon, waLink, first, fail, toast, confirmar } from '../ui.js?v=202611220031';
import { formPaciente, formAnamnese, ANAMNESE, alertasAnamnese } from '../comp/paciente.js?v=202611220031';
import { registrarAtendimento, verAtendimento } from '../comp/atendimento.js?v=202611220031';
import { enviarFotos, galeria } from '../comp/fotos.js?v=202611220031';
import { assinarDocumento, abrirDocumento, TIPOS } from '../comp/documentos.js?v=202611220031';
import { agendar } from '../comp/agendar.js?v=202611220031';
import { novaVenda } from './vendas.js?v=202611220031';

const ABAS = { resumo: 'Resumo', atendimentos: 'Atendimentos', fotos: 'Fotos', documentos: 'Documentos', anamnese: 'Anamnese', financeiro: 'Financeiro' };
let busca = '';

export async function render(el, [id, aba = 'resumo']) {
  const pacs = await pacientesLeves(true);
  el.innerHTML = `<div class="head"><div><div class="eyebrow">Prontuários</div><h1>Pacientes</h1></div><button class="btn gold" id="novaPac">${icon.plus}Nova paciente</button></div>
    <div class="pt-layout"><div class="panel" style="padding:14px"><input class="search" id="ptBusca" type="search" placeholder="Buscar por nome, CPF ou telefone" value="${esc(busca)}" aria-label="Buscar paciente"><div id="ptList" role="listbox" aria-label="Pacientes" style="margin-top:8px;max-height:70vh;overflow-y:auto"></div></div>
    <div id="ptDetail"></div></div>`;
  const lista = () => {
    const s = busca.toLowerCase().trim(), sd = s.replace(/\D/g, '');
    const f = pacs.filter(p => !s || p.nome.toLowerCase().includes(s) || (sd && ((p.cpf || '').replace(/\D/g, '').includes(sd) || (p.telefone || '').replace(/\D/g, '').includes(sd))));
    $('#ptList').innerHTML = f.map(p => `<button class="pt-item" role="option" aria-selected="${p.id === id}" data-id="${p.id}"><span class="avatar">${esc(ini(p.nome))}</span><span style="min-width:0;flex:1"><span class="t" style="display:block">${esc(p.nome)}</span><span class="s" style="display:block">${esc(p.telefone || '')}${p.ativo === false ? ' · inativa' : ''}</span></span></button>`).join('') || empty(pacs.length ? 'Nenhuma paciente encontrada' : 'Nenhuma paciente ainda', pacs.length ? '' : 'Cadastre a primeira em "Nova paciente".');
  };
  lista();
  $('#ptBusca').oninput = e => { busca = e.target.value; lista(); };
  $('#ptList').onclick = e => { const b = e.target.closest('[data-id]'); if (b) location.hash = '#/pacientes/' + b.dataset.id; };
  $('#novaPac').onclick = () => formPaciente({}, p => location.hash = '#/pacientes/' + p.id);
  if (id) { await prontuario($('#ptDetail'), id, aba); if (innerWidth <= 1100) $('#ptDetail').scrollIntoView({ block: 'start' }); }
  else $('#ptDetail').innerHTML = `<div class="panel">${empty('Escolha uma paciente', 'O prontuário completo aparece aqui: dados, anamnese, atendimentos, fotos, documentos e financeiro.')}</div>`;
}

async function prontuario(el, id, aba) {
  const [p, anam, ats, docs, pv] = await Promise.all([
    q(sb.from('pacientes').select('*').eq('id', id).single()),
    q(sb.from('anamneses').select('*').eq('paciente_id', id).order('criado_em', { ascending: false })),
    q(sb.from('atendimentos').select('*, aplicacoes(area,quantidade,unidade,lotes(lote))').eq('paciente_id', id).order('data', { ascending: false })),
    q(sb.from('documentos').select('id,tipo,titulo,assinado_em,pdf_caminho').eq('paciente_id', id).order('assinado_em', { ascending: false })),
    q(sb.from('posvenda').select('*').eq('paciente_id', id).eq('status', 'pendente').order('data_prevista')),
  ]);
  const ultima = anam[0], alertas = alertasAnamnese(ultima?.respostas);
  const recarregar = (a = aba) => { if (location.hash === `#/pacientes/${id}/${a}`) render(el.closest('.view'), [id, a]); else location.hash = `#/pacientes/${id}/${a}`; };
  const total = ats.reduce((s, a) => s + Number(a.valor), 0);
  el.innerHTML = `<div class="panel">
    <div class="profile-top"><span class="avatar lg">${esc(ini(p.nome))}</span>
      <div class="grow"><h2 style="font-size:30px">${esc(p.nome)}</h2><div class="sub" style="margin-top:2px">${[age(p.nascimento) != null ? age(p.nascimento) + ' anos' : null, p.origem ? 'veio por ' + p.origem.toLowerCase() : null, ats.length ? `${ats.length} atendimento${ats.length > 1 ? 's' : ''} · ${brl(total)}` : 'sem atendimentos'].filter(Boolean).join(' · ')}</div>
      <div class="btns" style="margin-top:8px">${p.uso_imagem ? '<span class="chip ok">Autoriza uso de imagem</span>' : '<span class="chip mute">Sem autorização de imagem</span>'}${!ultima ? '<span class="chip warn">Anamnese pendente</span>' : ''}${p.ativo === false ? '<span class="chip bad">Inativa</span>' : ''}</div></div>
      <div class="btns">
        ${p.telefone ? `<a class="btn icon" href="${waLink(p.telefone, `Oi, ${first(p.nome)}! `)}" target="_blank" rel="noopener" title="WhatsApp" aria-label="Abrir WhatsApp">${icon.wa}</a>` : ''}
        <button class="btn icon" id="pEdit" title="Editar cadastro" aria-label="Editar cadastro">${icon.edit}</button>
        <a class="btn" href="#/avaliacao/nova/${p.id}">Avaliação</a>
        <button class="btn" id="pAgendar">Agendar</button>
        <button class="btn" id="pVenda">Orçamento / venda</button>
        <button class="btn gold" id="pAtender">Registrar atendimento</button>
      </div></div>
    ${alertas.length ? `<div class="alert" style="margin-bottom:14px"><b>Atenção</b><span>${alertas.map(esc).join(' · ')}</span></div>` : ''}
    <div class="subnav" role="tablist">${Object.entries(ABAS).map(([k, v]) => `<button role="tab" aria-selected="${k === aba}" data-aba="${k}">${v}${k === 'documentos' && docs.length ? ` · ${docs.length}` : ''}${k === 'atendimentos' && ats.length ? ` · ${ats.length}` : ''}</button>`).join('')}</div>
    <div id="aba"></div></div>`;
  $$('[data-aba]', el).forEach(b => b.onclick = () => recarregar(b.dataset.aba));
  $('#pEdit', el).onclick = () => formPaciente(p, () => recarregar());
  $('#pAgendar', el).onclick = () => agendar({ paciente_id: p.id, onSaved: () => toast('Veja na Agenda.') });
  $('#pVenda', el).onclick = () => novaVenda({ paciente_id: p.id });
  $('#pAtender', el).onclick = () => registrarAtendimento({ paciente: p, depois: () => recarregar('atendimentos') });
  const A = $('#aba', el);

  if (aba === 'resumo') {
    A.innerHTML = `<dl class="facts">
      <div class="fact"><dt>CPF</dt><dd class="num">${esc(p.cpf || '—')}</dd></div>
      <div class="fact"><dt>Nascimento</dt><dd class="num">${p.nascimento ? fd(p.nascimento) : '—'}</dd></div>
      <div class="fact"><dt>WhatsApp</dt><dd class="num">${esc(p.telefone || '—')}</dd></div>
      <div class="fact"><dt>E-mail</dt><dd>${esc(p.email || '—')}</dd></div>
      <div class="fact"><dt>Endereço</dt><dd>${esc([p.endereco, p.bairro, p.cidade].filter(Boolean).join(' · ') || '—')}</dd></div>
      <div class="fact"><dt>Profissão</dt><dd>${esc(p.profissao || '—')}</dd></div>
      ${ultima?.respostas?.objetivo ? `<div class="fact" style="grid-column:1/-1"><dt>Objetivo da paciente</dt><dd>${esc(ultima.respostas.objetivo)}</dd></div>` : ''}
      ${p.observacoes ? `<div class="fact" style="grid-column:1/-1"><dt>Observações</dt><dd style="white-space:pre-wrap">${esc(p.observacoes)}</dd></div>` : ''}
    </dl>
    <div class="cols even" style="margin-top:24px">
      <div><div class="panel-h"><h2>Últimos procedimentos</h2></div>${resumoProcs(ats)}</div>
      <div><div class="panel-h"><h2>Próximos contatos</h2><a class="btn sm" href="#/posvenda">Pós-venda</a></div><div class="list">${pv.length ? pv.slice(0, 5).map(x => `<div class="row"><div class="grow"><div class="t">${esc(x.titulo)}</div><div class="s">${esc(x.contexto || '')}</div></div><span class="chip ${new Date(x.data_prevista) <= new Date() ? 'warn' : 'mute'} num">${fd(x.data_prevista)}</span></div>`).join('') : empty('Nenhum contato programado')}</div></div>
    </div>`;
  }

  if (aba === 'atendimentos') {
    A.innerHTML = ats.length ? `<div class="timeline">${ats.map(a => { const pr = procById(a.procedimento_id); const tot = {}; a.aplicacoes.forEach(x => tot[x.unidade] = (tot[x.unidade] || 0) + Number(x.quantidade));
      return `<button class="tl" style="text-align:left;width:100%" data-at="${a.id}"><div class="tl-h"><div><b style="font-weight:500">${esc(pr?.nome || 'Procedimento')}</b>${pr?.sessoes > 1 ? ` <span class="chip mute">sessão ${a.sessao} de ${pr.sessoes}</span>` : ''}</div><span class="num muted small">${fdt(a.data)} · ${brl(a.valor)}</span></div>
      <div class="apps">${a.aplicacoes.map(x => `<span class="chip mute">${esc(x.area)}${Number(x.quantidade) ? ` · ${nfmt(x.quantidade)} ${esc(x.unidade)}` : ''}${x.lotes ? ` · lote ${esc(x.lotes.lote)}` : ''}</span>`).join('')}${Object.entries(tot).filter(([, v]) => v).map(([u, v]) => `<span class="chip">Total ${nfmt(v)} ${esc(u)}</span>`).join('')}</div>
      ${a.intercorrencias ? `<div class="small bad-t" style="margin-top:8px">Intercorrência: ${esc(a.intercorrencias)}</div>` : ''}${a.observacoes ? `<div class="small muted" style="margin-top:6px">${esc(a.observacoes)}</div>` : ''}</button>`; }).join('')}</div>`
      : empty('Nenhum atendimento registrado', 'Use "Registrar atendimento" para lançar procedimento, áreas, quantidades e lote.');
    A.onclick = e => { const t = e.target.closest('[data-at]'); if (t) verAtendimento(t.dataset.at, () => recarregar()); };
  }

  if (aba === 'fotos') {
    A.innerHTML = `<div class="btns" style="margin-bottom:14px"><button class="btn gold" id="fAdd">${icon.cam}Adicionar fotos</button><span class="hint">Toque duas vezes numa foto para ampliar.</span></div><div id="gal"></div>`;
    $('#fAdd', A).onclick = () => enviarFotos({ paciente: p, onDone: () => recarregar('fotos') });
    try { await galeria($('#gal', A), { pacienteId: p.id, paciente: p }); } catch (e) { fail(e); }
  }

  if (aba === 'documentos') {
    A.innerHTML = `<div class="doc-grid" style="margin-bottom:22px">${Object.entries(TIPOS).map(([k, t]) => `<button class="doc-card" data-tipo="${k}"><span class="t">${esc(t.nome)}</span><span class="s">${esc(t.desc)}</span><span class="go">Preencher e assinar →</span></button>`).join('')}</div>
      <div class="panel-h"><h2>Documentos assinados</h2></div>
      <div class="list">${docs.length ? docs.map(d => `<div class="row"><div class="grow"><div class="t">${esc(d.titulo)}</div><div class="s num">Assinado em ${fdt(d.assinado_em)}</div></div><button class="btn sm" data-pdf="${esc(d.pdf_caminho)}">${icon.doc}Abrir PDF</button></div>`).join('') : empty('Nenhum documento assinado')}</div>`;
    A.onclick = e => {
      const t = e.target.closest('[data-tipo]'); if (t) assinarDocumento({ paciente: p, tipo: t.dataset.tipo, procedimento: procById(ats[0]?.procedimento_id), onDone: () => recarregar('documentos') });
      const d = e.target.closest('[data-pdf]'); if (d) abrirDocumento(d.dataset.pdf);
    };
  }

  if (aba === 'anamnese') {
    const r = ultima?.respostas || {};
    A.innerHTML = `<div class="btns" style="margin-bottom:14px"><button class="btn gold" id="anNova">${ultima ? 'Atualizar anamnese' : 'Preencher anamnese'}</button>${ultima ? `<span class="hint">Versão de ${fd(ultima.criado_em)} · ${anam.length} versão(ões) no histórico</span>` : ''}</div>
      ${ultima ? `<div class="tbl-wrap"><table><tbody>${ANAMNESE.filter(c => r[c.k]).map(c => `<tr><td style="width:55%">${esc(c.t)}</td><td>${r[c.k] === 'sim' ? '<b class="warn-t">Sim</b>' : r[c.k] === 'nao' ? 'Não' : esc(r[c.k])}${r[c.k + '_d'] ? `<div class="s">${esc(r[c.k + '_d'])}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('Anamnese ainda não preenchida', 'Preencha antes do primeiro procedimento.')}
      ${anam.length > 1 ? `<details style="margin-top:16px"><summary class="muted small" style="cursor:pointer">Versões anteriores</summary><div class="list">${anam.slice(1).map(x => `<div class="row"><div class="grow small">${fd(x.criado_em)} · ${alertasAnamnese(x.respostas).map(esc).join(' · ') || 'sem alertas'}</div></div>`).join('')}</div></details>` : ''}`;
    $('#anNova', A).onclick = () => formAnamnese(p, ultima, () => recarregar('anamnese'));
  }

  if (aba === 'financeiro') {
    const [vendas, rec] = await Promise.all([
      q(sb.from('vendas').select('*, venda_itens(*)').eq('paciente_id', id).order('criado_em', { ascending: false })),
      q(sb.from('recebimentos').select('*').eq('paciente_id', id).is('recebido_em', null).order('vencimento')),
    ]);
    const st = { orcamento: ['Orçamento', 'mute'], aprovado: ['OS aberta', 'warn'], realizado: ['A receber', 'bad'], pago: ['Pago', 'ok'], perdido: ['Não fechou', 'mute'] };
    A.innerHTML = `<div class="kpis k3" style="margin-bottom:16px">
        <div class="kpi lead"><h3>Total investido</h3><div class="v num">${brl(total)}</div><div class="d">${ats.length} procedimentos</div></div>
        <div class="kpi"><h3>Ticket médio</h3><div class="v num">${brl(ats.length ? total / ats.length : 0)}</div><div class="d">por procedimento</div></div>
        <div class="kpi"><h3>Parcelas a receber</h3><div class="v num">${brl(rec.reduce((a, r) => a + Number(r.valor), 0))}</div><div class="d">${rec.length} parcela(s)</div></div></div>
      <div class="list">${vendas.length ? vendas.map(v => `<a class="row click" href="#/vendas/${v.id}" style="text-decoration:none;color:inherit"><div class="grow"><div class="t">${v.os_numero ? 'OS ' + String(v.os_numero).padStart(4, '0') : 'Orçamento ' + String(v.numero).padStart(4, '0')} · ${brl(totalVenda(v))}</div><div class="s">${esc(v.venda_itens.map(i => i.descricao).join(' + '))} · ${fd(v.criado_em)}</div></div><span class="chip ${st[v.status][1]}">${st[v.status][0]}</span></a>`).join('') : empty('Nenhuma venda ou orçamento')}</div>`;
  }
}

function resumoProcs(ats) {
  if (!ats.length) return empty('Nenhum ainda');
  const m = {}; ats.forEach(a => { const k = a.procedimento_id; if (!m[k]) m[k] = { n: 0, ult: a.data, q: {} }; m[k].n++; a.aplicacoes.forEach(x => m[k].q[x.unidade] = (m[k].q[x.unidade] || 0) + Number(x.quantidade)); });
  return `<div class="list">${Object.entries(m).map(([k, v]) => { const pr = procById(k); const dias = Math.round((Date.now() - new Date(v.ult)) / 864e5);
    return `<div class="row"><div class="grow"><div class="t">${esc(pr?.nome || 'Procedimento')}</div><div class="s">${v.n}× · último há ${dias} dias${Object.entries(v.q).filter(([, x]) => x).map(([u, x]) => ` · ${nfmt(x)} ${esc(u)} no total`).join('')}</div></div>${pr?.ciclo_dias ? `<span class="chip ${dias >= pr.ciclo_dias - 10 ? 'warn' : 'ok'}">${dias >= pr.ciclo_dias - 10 ? 'Hora de manutenção' : 'Em dia'}</span>` : ''}</div>`; }).join('')}</div>`;
}
