// Pós-venda: contatos do dia com mensagem pronta
import { sb, q, cache, procById, mensagem } from '../db.js?v=202611220031';
import { $, $$, esc, ini, fd, iso, addDays, today, waLink, first, copiar, toast, fail, empty, kpi, pct, icon, longDate, daysBetween } from '../ui.js?v=202611220031';
import { agendar } from '../comp/agendar.js?v=202611220031';
import { atualizarBadges } from '../main.js?v=202611220031';

const TIPO = { d1: ['Pós D+1', 'ok'], revisao: ['Revisão', 'ok'], sessao: ['Próxima sessão', 'info'], manutencao: ['Manutenção', 'warn'], orcamento: ['Orçamento', 'mute'], reativacao: ['Reativação', 'mute'], aniversario: ['Aniversário', ''], inativa: ['Sem vir há tempo', 'bad'], outro: ['Contato', 'mute'] };
let aba = 'hoje';

export async function render(el) {
  const hoje = today(), hIso = iso(hoje);
  const [pend, feitos, pacs, ultAt] = await Promise.all([
    q(sb.from('posvenda').select('*, pacientes(id,nome,telefone), atendimentos(procedimento_id,data)').eq('status', 'pendente').lte('data_prevista', iso(addDays(hoje, 30))).order('data_prevista')),
    q(sb.from('posvenda').select('tipo,resultado,feito_em').eq('status', 'feito').gte('feito_em', addDays(hoje, -90).toISOString())),
    q(sb.from('pacientes').select('id,nome,telefone,nascimento').eq('ativo', true)),
    q(sb.from('atendimentos').select('paciente_id,data,procedimento_id').order('data', { ascending: false }).limit(2000)),
  ]);
  // aniversários dos próximos 7 dias
  const aniv = pacs.filter(p => p.nascimento).map(p => { const n = new Date(p.nascimento + 'T00:00'); let d = new Date(hoje.getFullYear(), n.getMonth(), n.getDate()); if (d < hoje) d = new Date(hoje.getFullYear() + 1, n.getMonth(), n.getDate()); return { p, d, idade: d.getFullYear() - n.getFullYear() }; }).filter(x => daysBetween(hoje, x.d) <= 7).sort((a, b) => a.d - b.d);
  // pacientes sem vir há mais de 6 meses e sem contato pendente
  const ult = {}; ultAt.forEach(a => { if (!ult[a.paciente_id]) ult[a.paciente_id] = a; });
  const comPend = new Set(pend.map(x => x.paciente_id));
  const inativas = pacs.filter(p => ult[p.id] && daysBetween(new Date(ult[p.id].data), hoje) > 180 && !comPend.has(p.id)).map(p => ({ p, a: ult[p.id], dias: daysBetween(new Date(ult[p.id].data), hoje) })).sort((a, b) => a.dias - b.dias);

  const deHoje = pend.filter(x => x.data_prevista <= hIso), semana = pend.filter(x => x.data_prevista > hIso && x.data_prevista <= iso(addDays(hoje, 7)));
  const agendaram = feitos.filter(f => /agendou/i.test(f.resultado || '')).length;
  const cards = { hoje: deHoje, semana, aniversarios: aniv, inativas };

  el.innerHTML = `<div class="head"><div><div class="eyebrow">${longDate(hoje)}</div><h1>Contatos <em>de hoje</em></h1><p class="sub">Cada atendimento cria estes contatos sozinho: cuidado no dia seguinte, revisão, próxima sessão e o aviso de manutenção antes do efeito acabar.</p></div></div>
    <div class="kpis">
      ${kpi('Para hoje', String(deHoje.length), `${deHoje.filter(x => x.data_prevista < hIso).length} atrasado(s)`, true)}
      ${kpi('Próximos 7 dias', String(semana.length), 'já programados')}
      ${kpi('Retorno · 90 dias', feitos.length ? pct(agendaram / feitos.length) : '—', `${agendaram} de ${feitos.length} contatos viraram agendamento`)}
      ${kpi('Sem vir há 6 meses+', String(inativas.length), 'oportunidade de reativação')}
    </div>
    <div class="tabs">${[['hoje', 'Hoje'], ['semana', 'Próximos 7 dias'], ['aniversarios', 'Aniversários'], ['inativas', 'Reativar']].map(([k, v]) => `<button aria-pressed="${aba === k}" data-aba="${k}">${v} · ${cards[k].length}</button>`).join('')}</div>
    <div class="grid" id="pvList"></div>`;
  $$('[data-aba]', el).forEach(b => b.onclick = () => { aba = b.dataset.aba; render(el); });

  const L = $('#pvList', el), re = () => { render(el); atualizarBadges(); };
  const card = ({ key, pac, tipo, titulo, contexto, quando, msg, atrasado }) => `<article class="pv-card${atrasado ? ' late' : ''}" data-key="${key}">
    <div><div style="display:flex;gap:12px;align-items:flex-start"><span class="avatar">${esc(ini(pac.nome))}</span><div><a href="#/pacientes/${pac.id}" style="color:var(--text);text-decoration:none;font-weight:500">${esc(pac.nome)}</a><div class="small muted num">${esc(pac.telefone || 'sem telefone')}</div></div></div>
      <div class="btns" style="margin-top:12px"><span class="chip ${TIPO[tipo][1]}">${esc(titulo)}</span>${quando ? `<span class="chip ${atrasado ? 'warn' : 'mute'} num">${quando}</span>` : ''}</div>
      <div class="small faint" style="margin-top:8px">${esc(contexto || '')}</div></div>
    <div><textarea class="msg" data-msg>${esc(msg)}</textarea>
      <div class="btns" style="margin-top:10px">
        ${pac.telefone ? `<a class="btn gold sm" data-wa href="#" target="_blank" rel="noopener">${icon.wa}WhatsApp</a>` : ''}<button class="btn sm" data-copy>Copiar</button><span style="flex:1"></span>
        <button class="btn sm" data-r="Agendou">Agendou</button><button class="btn sm" data-r="Respondeu">Respondeu</button><button class="btn sm" data-r="Sem resposta">Sem resposta</button>${tipo !== 'aniversario' && tipo !== 'inativa' ? '<button class="btn sm" data-r="Não quer agora">Não quer</button>' : ''}
      </div></div></article>`;
  const procNome = x => procById(x.atendimentos?.procedimento_id)?.nome || x.contexto?.split(' · ')[0] || 'procedimento';
  let itens = [];
  if (aba === 'hoje' || aba === 'semana') itens = cards[aba].map(x => ({ key: 'pv:' + x.id, x, pac: x.pacientes, tipo: x.tipo, titulo: x.titulo, contexto: x.contexto, quando: x.data_prevista < hIso ? `atrasado desde ${fd(x.data_prevista)}` : fd(x.data_prevista), atrasado: x.data_prevista < hIso, msg: mensagem(x.tipo, { nome: first(x.pacientes?.nome), procedimento: procNome(x).toLowerCase() }) }));
  if (aba === 'aniversarios') itens = aniv.map(a => ({ key: 'an:' + a.p.id, pac: a.p, tipo: 'aniversario', titulo: daysBetween(hoje, a.d) === 0 ? 'Aniversário hoje' : `Aniversário em ${fd(a.d).slice(0, 5)}`, contexto: `Completa ${a.idade} anos`, msg: mensagem('aniversario', { nome: first(a.p.nome) }) }));
  if (aba === 'inativas') itens = inativas.map(a => ({ key: 'in:' + a.p.id, pac: a.p, tipo: 'inativa', titulo: `Última visita há ${Math.round(a.dias / 30)} meses`, contexto: `Último procedimento: ${procById(a.a.procedimento_id)?.nome || '—'} em ${fd(a.a.data)}`, msg: mensagem('reativacao', { nome: first(a.p.nome) }) }));
  L.innerHTML = itens.length ? itens.map(card).join('') : `<div class="panel">${empty(aba === 'hoje' ? 'Tudo em dia por hoje' : 'Nada aqui', aba === 'hoje' ? 'Novos contatos aparecem conforme os atendimentos são registrados.' : '')}</div>`;

  // link do WhatsApp sempre com o texto atual
  $$('[data-wa]', L).forEach(a => { const art = a.closest('[data-key]'); const it = itens.find(i => i.key === art.dataset.key); const upd = () => a.href = waLink(it.pac.telefone, $('[data-msg]', art).value); upd(); $('[data-msg]', art).addEventListener('input', upd); });
  L.onclick = async e => {
    const art = e.target.closest('[data-key]'); if (!art) return; const it = itens.find(i => i.key === art.dataset.key);
    if (e.target.closest('[data-copy]')) { copiar($('[data-msg]', art).value, $('[data-msg]', art)); return; }
    const r = e.target.closest('[data-r]')?.dataset.r; if (!r) return;
    try {
      if (it.x) {
        if (r === 'Sem resposta') { await q(sb.from('posvenda').update({ data_prevista: iso(addDays(hoje, 3)), resultado: 'Sem resposta em ' + fd(hoje) }).eq('id', it.x.id)); toast('Sem resposta: volta para a lista em 3 dias.'); }
        else { await q(sb.from('posvenda').update({ status: r === 'Não quer agora' ? 'cancelado' : 'feito', resultado: r, feito_em: new Date().toISOString() }).eq('id', it.x.id)); toast(`${first(it.pac.nome)}: ${r.toLowerCase()}.`); }
      } else if (r !== 'Sem resposta') {
        await q(sb.from('posvenda').insert({ paciente_id: it.pac.id, tipo: it.tipo === 'inativa' ? 'reativacao' : 'outro', titulo: it.titulo, contexto: it.contexto, data_prevista: hIso, status: 'feito', resultado: r, feito_em: new Date().toISOString() }));
        toast('Contato registrado.');
      } else toast('Ok, fica na lista.');
      if (r === 'Agendou') agendar({ paciente_id: it.pac.id, procedimento_id: it.x?.atendimentos?.procedimento_id || null, onSaved: re });
      else re();
    } catch (err) { fail(err); }
  };
}
