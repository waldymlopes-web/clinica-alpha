// Agenda semanal e diária
import { sb, q, procById } from '../db.js?v=202611220013';
import { $, $$, esc, SEM_C, MES, MES_C, addDays, iso, fh, icon, empty, brl } from '../ui.js?v=202611220013';
import { agendar, STATUS_AG } from '../comp/agendar.js?v=202611220013';

let base = null, modo = null;

export async function render(el) {
  if (!base) base = new Date();
  if (!modo) modo = innerWidth < 760 ? 'dia' : 'semana';
  const d0 = new Date(base); d0.setHours(0, 0, 0, 0);
  const ini = modo === 'semana' ? addDays(d0, -((d0.getDay() + 6) % 7)) : d0;
  const fim = addDays(ini, modo === 'semana' ? 7 : 1);
  const ags = await q(sb.from('agendamentos').select('*, pacientes(nome,telefone)').gte('inicio', ini.toISOString()).lt('inicio', fim.toISOString()).order('inicio'));
  const hojeIso = iso(new Date());
  const titulo = modo === 'semana'
    ? `${ini.getDate()} ${MES_C[ini.getMonth()]} – ${addDays(fim, -1).getDate()} ${MES_C[addDays(fim, -1).getMonth()]}`
    : `${SEM_C[ini.getDay()]}, ${ini.getDate()} de ${MES[ini.getMonth()]}`;
  const ativos = ags.filter(a => !['cancelado', 'faltou'].includes(a.status));
  const prev = ativos.reduce((s, a) => s + Number(procById(a.procedimento_id)?.preco || 0), 0);

  el.innerHTML = `<div class="head"><div><div class="eyebrow">Agenda</div><h1>${modo === 'semana' ? 'Semana' : 'Dia'}</h1><p class="sub">${ativos.length} horário${ativos.length !== 1 ? 's' : ''}${prev ? ` · cerca de ${brl(prev)} previstos pela tabela` : ''}</p></div><button class="btn gold" id="agNovo">${icon.plus}Agendar</button></div>
    <div class="cal-head"><button class="btn icon" id="agPrev" aria-label="Anterior">${icon.back}</button><button class="btn sm" id="agHoje">Hoje</button><button class="btn icon" id="agNext" aria-label="Próximo">${icon.next}</button>
      <span class="title">${titulo}</span><span style="flex:1"></span>
      <span class="seg"><button aria-pressed="${modo === 'dia'}" data-m="dia">Dia</button><button aria-pressed="${modo === 'semana'}" data-m="semana">Semana</button></span></div>
    <div id="cal"></div>`;
  const ev = a => `<button class="ev ${a.status}" data-ag="${a.id}"><span class="h">${fh(a.inicio)}</span> <b>${esc(a.pacientes?.nome)}</b>${esc(procById(a.procedimento_id)?.nome || 'Avaliação')}</button>`;
  if (modo === 'semana') {
    $('#cal').innerHTML = `<div class="week">${[...Array(7)].map((_, i) => { const d = addDays(ini, i), k = iso(d); const lst = ags.filter(a => iso(new Date(a.inicio)) === k);
      return `<div class="day${k === hojeIso ? ' today' : ''}"><div class="day-h"><span>${SEM_C[d.getDay()]}</span><b>${d.getDate()}</b></div><div class="day-b">${lst.map(ev).join('')}<button class="add-ev" data-dia="${k}">+ agendar</button></div></div>`; }).join('')}</div>`;
  } else {
    $('#cal').innerHTML = `<div class="panel dayview stack" style="gap:8px">${ags.length ? ags.map(a => `<button class="ev ${a.status}" data-ag="${a.id}"><span class="h" style="font-size:18px">${fh(a.inicio)}</span><span><b>${esc(a.pacientes?.nome)}</b><span class="muted small">${esc(procById(a.procedimento_id)?.nome || 'Avaliação')} · ${a.duracao_min} min</span></span><span class="chip ${a.status === 'confirmado' ? 'ok' : a.status === 'agendado' ? '' : 'mute'}">${STATUS_AG[a.status]}</span></button>`).join('') : empty('Nenhum horário neste dia')}<button class="add-ev" data-dia="${iso(ini)}" style="padding:12px">+ agendar neste dia</button></div>`;
  }
  const re = () => render(el);
  $('#agPrev').onclick = () => { base = addDays(base, modo === 'semana' ? -7 : -1); re(); };
  $('#agNext').onclick = () => { base = addDays(base, modo === 'semana' ? 7 : 1); re(); };
  $('#agHoje').onclick = () => { base = new Date(); re(); };
  $$('[data-m]', el).forEach(b => b.onclick = () => { modo = b.dataset.m; re(); });
  $('#agNovo').onclick = () => agendar({ onSaved: re });
  $('#cal').onclick = e => {
    const a = e.target.closest('[data-ag]'); if (a) { agendar({ ag: ags.find(x => x.id === a.dataset.ag), onSaved: re }); return; }
    const d = e.target.closest('[data-dia]'); if (d) { const [y, m, dd] = d.dataset.dia.split('-').map(Number); agendar({ inicio: new Date(y, m - 1, dd, 9, 0), onSaved: re }); }
  };
}
