// Relatórios técnicos e de negócio por procedimento, quantidade aplicada e frequência
import { sb, q, cache, procById, prodById } from '../db.js';
import { $, $$, esc, iso, addDays, fd, brl, nfmt, money, kpi, MES_C, empty, opt, pct, icon } from '../ui.js';

let F = null;
const csv = (nome, linhas) => {
  const t = '﻿' + linhas.map(l => l.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = nome + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

function barras(rotulos, series, unidade = '') {
  const W = 720, H = 240, L = 46, R = 10, T = 18, B = 30, n = rotulos.length;
  const mx = Math.max(1, ...series); const passo = Math.pow(10, Math.floor(Math.log10(mx))) * (mx / Math.pow(10, Math.floor(Math.log10(mx))) > 5 ? 2 : 1); const max = Math.ceil(mx / passo) * passo || 1;
  const cw = (W - L - R) / n, x = i => L + cw * i + cw / 2, y = v => T + (H - T - B) * (1 - v / max), bw = Math.min(40, cw * .6);
  let g = ''; for (let v = 0; v <= max; v += passo) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(201,164,92,.1)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#776f5e">${nfmt(v)}</text>`;
  series.forEach((v, i) => { g += `<rect x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" fill="url(#rg)"><title>${rotulos[i]}: ${nfmt(v)} ${unidade}</title></rect>`; if (v) g += `<text x="${x(i)}" y="${y(v) - 5}" text-anchor="middle" font-size="10.5" fill="#a59c8a">${nfmt(v)}</text>`; });
  rotulos.forEach((r, i) => { if (n <= 14 || i % 2 === 0) g += `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="11" fill="#776f5e">${r}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img"><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd39a"/><stop offset="1" stop-color="#8a6a2e"/></linearGradient></defs>${g}</svg>`;
}

export async function render(el) {
  if (!F) { const h = new Date(); F = { de: iso(new Date(h.getFullYear(), h.getMonth() - 11, 1)), ate: iso(h), proc: '', area: '' }; }
  const procs = cache.procs;
  el.innerHTML = `<div class="head"><div><div class="eyebrow">Relatórios</div><h1>Procedimentos <em>em números</em></h1><p class="sub">Quantas vezes cada procedimento foi feito, quanto foi aplicado em U, ml ou frascos, por área, por produto e por paciente.</p></div></div>
    <div class="panel" style="margin-bottom:16px"><div class="fields">
      <label class="field"><span>De</span><input type="date" id="rDe" value="${F.de}"></label>
      <label class="field"><span>Até</span><input type="date" id="rAte" value="${F.ate}"></label>
      <label class="field"><span>Procedimento</span><select id="rProc">${opt('', 'Todos', F.proc)}${procs.map(p => opt(p.id, p.nome, F.proc)).join('')}</select></label>
      <label class="field"><span>Área</span><input id="rArea" list="rAreas" value="${esc(F.area)}" placeholder="Todas"><datalist id="rAreas"></datalist></label>
    </div><div class="btns" style="margin-top:12px">${[['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['ano', 'Este ano']].map(([k, v]) => `<button class="btn sm" data-pre="${k}">${v}</button>`).join('')}</div></div>
    <div id="rOut"><div class="panel">${empty('Carregando…')}</div></div>`;
  const aplicar = () => { F = { de: $('#rDe').value, ate: $('#rAte').value, proc: $('#rProc').value, area: $('#rArea').value.trim() }; gerar($('#rOut')); };
  ['#rDe', '#rAte', '#rProc'].forEach(s => $(s).onchange = aplicar);
  $('#rArea').onchange = aplicar;
  $$('[data-pre]').forEach(b => b.onclick = () => { const h = new Date(); $('#rAte').value = iso(h); $('#rDe').value = b.dataset.pre === 'ano' ? iso(new Date(h.getFullYear(), 0, 1)) : iso(new Date(h.getFullYear(), h.getMonth() - Number(b.dataset.pre) + 1, 1)); aplicar(); });
  await gerar($('#rOut'));
}

async function gerar(out) {
  let query = sb.from('atendimentos').select('id,data,valor,sessao,procedimento_id,paciente_id,pacientes(nome),aplicacoes(area,quantidade,unidade,produto_id,lote_id,lotes(lote,validade,custo_embalagem))')
    .gte('data', new Date(F.de + 'T00:00').toISOString()).lte('data', new Date(F.ate + 'T23:59:59').toISOString()).order('data');
  if (F.proc) query = query.eq('procedimento_id', F.proc);
  const atsAll = await q(query);
  const areasProc = new Set(); atsAll.forEach(a => a.aplicacoes.forEach(x => areasProc.add(x.area)));
  $('#rAreas').innerHTML = [...areasProc].sort().map(a => `<option value="${esc(a)}">`).join('');
  const ats = F.area ? atsAll.filter(a => a.aplicacoes.some(x => x.area.toLowerCase() === F.area.toLowerCase())) : atsAll;
  const apls = ats.flatMap(a => a.aplicacoes.filter(x => !F.area || x.area.toLowerCase() === F.area.toLowerCase()).map(x => ({ ...x, at: a })));
  if (!ats.length) { out.innerHTML = `<div class="panel">${empty('Nenhum atendimento no período', 'Ajuste as datas ou o procedimento.')}</div>`; return; }

  // meses do período
  const d0 = new Date(F.de + 'T00:00'), d1 = new Date(F.ate + 'T00:00'); const meses = [];
  for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) meses.push(d);
  const mk = d => d.getFullYear() * 12 + d.getMonth();
  const idx = Object.fromEntries(meses.map((m, i) => [mk(m), i]));
  const rot = meses.map(m => MES_C[m.getMonth()] + (meses.length > 12 || m.getMonth() === 0 ? '/' + String(m.getFullYear()).slice(2) : ''));
  const qtdMes = Array(meses.length).fill(0), volMes = {}, fatMes = Array(meses.length).fill(0);
  ats.forEach(a => { const i = idx[mk(new Date(a.data))]; if (i != null) { qtdMes[i]++; fatMes[i] += Number(a.valor); } });
  apls.forEach(x => { const i = idx[mk(new Date(x.at.data))]; if (i == null) return; (volMes[x.unidade] = volMes[x.unidade] || Array(meses.length).fill(0))[i] += Number(x.quantidade); });
  const unidPrinc = Object.entries(volMes).sort((a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0))[0];

  // por procedimento
  const pp = {}; ats.forEach(a => { const k = a.procedimento_id; const o = pp[k] = pp[k] || { n: 0, pac: new Set(), fat: 0, vol: {}, custo: 0 }; o.n++; o.pac.add(a.paciente_id); o.fat += Number(a.valor);
    a.aplicacoes.forEach(x => { o.vol[x.unidade] = (o.vol[x.unidade] || 0) + Number(x.quantidade); const pr = prodById(x.produto_id); if (x.lotes && pr) o.custo += Number(x.quantidade) / (pr.conteudo || 1) * Number(x.lotes.custo_embalagem); }); });
  // por área
  const pa = {}; apls.forEach(x => { const k = x.area + '|' + x.unidade; const o = pa[k] = pa[k] || { area: x.area, un: x.unidade, tot: 0, n: 0 }; o.tot += Number(x.quantidade); o.n++; });
  // por produto/lote
  const pl = {}; apls.filter(x => x.lote_id).forEach(x => { const o = pl[x.lote_id] = pl[x.lote_id] || { prod: prodById(x.produto_id)?.nome, lote: x.lotes?.lote, val: x.lotes?.validade, un: x.unidade, tot: 0, pac: new Map() }; o.tot += Number(x.quantidade); o.pac.set(x.at.paciente_id, x.at.pacientes?.nome); });
  // por paciente
  const pc = {}; ats.forEach(a => { const o = pc[a.paciente_id] = pc[a.paciente_id] || { nome: a.pacientes?.nome, n: 0, fat: 0, vol: {}, datas: {} }; o.n++; o.fat += Number(a.valor); (o.datas[a.procedimento_id] = o.datas[a.procedimento_id] || []).push(new Date(a.data)); a.aplicacoes.forEach(x => o.vol[x.unidade] = (o.vol[x.unidade] || 0) + Number(x.quantidade)); });
  // intervalo médio de retorno por procedimento
  const inter = {}; Object.values(pc).forEach(o => Object.entries(o.datas).forEach(([pid, ds]) => { ds.sort((a, b) => a - b); for (let i = 1; i < ds.length; i++) (inter[pid] = inter[pid] || []).push((ds[i] - ds[i - 1]) / 864e5); }));
  const volTxt = v => Object.entries(v).filter(([, x]) => x).map(([u, x]) => `${nfmt(x)} ${esc(u)}`).join(' · ') || '—';
  const fat = ats.reduce((s, a) => s + Number(a.valor), 0), pacs = new Set(ats.map(a => a.paciente_id)).size;
  const voltaram = Object.values(pc).filter(o => Object.values(o.datas).some(d => d.length > 1)).length;

  out.innerHTML = `<div class="kpis">
      ${kpi('Procedimentos realizados', String(ats.length), `${pacs} paciente(s) · ${nfmt(ats.length / Math.max(1, meses.length))} por mês`, true)}
      ${kpi('Total aplicado', unidPrinc ? `${nfmt(unidPrinc[1].reduce((s, v) => s + v, 0))}<small style="margin-left:4px">${esc(unidPrinc[0])}</small>` : '—', Object.entries(volMes).slice(1).map(([u, v]) => `${nfmt(v.reduce((s, x) => s + x, 0))} ${esc(u)}`).join(' · ') || 'no período')}
      ${kpi('Faturamento', money(fat), `ticket de ${brl(fat / ats.length)}`)}
      ${kpi('Repetiram no período', pacs ? pct(voltaram / pacs) : '—', `${voltaram} de ${pacs} pacientes`)}
    </div>
    <div class="cols even">
      <div class="panel chart"><div class="panel-h"><h2>Vezes realizado por mês</h2><h3>${esc(F.proc ? procById(F.proc)?.nome : 'Todos')}</h3></div>${barras(rot, qtdMes, 'atendimentos')}</div>
      <div class="panel chart"><div class="panel-h"><h2>Quantidade aplicada por mês</h2><div class="tabs" style="margin:0" id="rUn">${Object.keys(volMes).map((u, i) => `<button class="sm" aria-pressed="${i === 0 ? 'true' : 'false'}" data-un="${esc(u)}">${esc(u)}</button>`).join('')}</div></div><div id="rVol">${unidPrinc ? barras(rot, volMes[Object.keys(volMes)[0]], Object.keys(volMes)[0]) : empty('Sem quantidades registradas')}</div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-h"><h2>Por procedimento</h2><button class="btn sm" data-csv="proc">${icon.dl}Planilha</button></div><div class="tbl-wrap"><table><thead><tr><th>Procedimento</th><th class="right">Vezes</th><th class="right">Pacientes</th><th>Total aplicado</th><th>Média por vez</th><th class="right">Faturamento</th><th class="right">Custo produto</th><th class="right">Margem</th><th class="right">Retorno médio</th></tr></thead><tbody>
      ${Object.entries(pp).sort((a, b) => b[1].n - a[1].n).map(([k, o]) => { const iv = inter[k]; return `<tr><td>${esc(procById(k)?.nome || 'Outro')}</td><td class="right num">${o.n}</td><td class="right num">${o.pac.size}</td><td class="num">${volTxt(o.vol)}</td><td class="num">${Object.entries(o.vol).filter(([, x]) => x).map(([u, x]) => `${nfmt(x / o.n)} ${esc(u)}`).join(' · ') || '—'}</td><td class="right num">${brl(o.fat)}</td><td class="right num">${brl(o.custo)}</td><td class="right num">${o.fat ? pct((o.fat - o.custo) / o.fat) : '—'}</td><td class="right num">${iv ? Math.round(iv.reduce((s, v) => s + v, 0) / iv.length) + ' dias' : '—'}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <div class="cols even" style="margin-top:16px">
      <div class="panel"><div class="panel-h"><h2>Por área</h2><button class="btn sm" data-csv="area">${icon.dl}Planilha</button></div>${Object.keys(pa).length ? `<div class="tbl-wrap"><table><thead><tr><th>Área</th><th class="right">Vezes</th><th class="right">Total</th><th class="right">Média</th></tr></thead><tbody>${Object.values(pa).sort((a, b) => b.n - a.n).map(o => `<tr><td>${esc(o.area)}</td><td class="right num">${o.n}</td><td class="right num">${nfmt(o.tot)} ${esc(o.un)}</td><td class="right num">${nfmt(o.tot / o.n)} ${esc(o.un)}</td></tr>`).join('')}</tbody></table></div>` : empty('Sem áreas registradas')}</div>
      <div class="panel"><div class="panel-h"><h2>Por produto e lote</h2><button class="btn sm" data-csv="lote">${icon.dl}Planilha</button></div>${Object.keys(pl).length ? `<div class="tbl-wrap"><table><thead><tr><th>Produto · lote</th><th class="right">Aplicado</th><th>Pacientes</th></tr></thead><tbody>${Object.values(pl).map(o => `<tr><td>${esc(o.prod)}<div class="s">lote ${esc(o.lote)} · val. ${fd(o.val)}</div></td><td class="right num">${nfmt(o.tot)} ${esc(o.un)}</td><td class="small">${[...o.pac.values()].map(esc).join(', ')}</td></tr>`).join('')}</tbody></table></div><p class="hint" style="margin:10px 0 0">Rastreabilidade: se um lote tiver problema, aqui estão todas as pacientes que o receberam.</p>` : empty('Sem lotes registrados')}</div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-h"><h2>Por paciente</h2><button class="btn sm" data-csv="pac">${icon.dl}Planilha</button></div><div class="tbl-wrap"><table><thead><tr><th>Paciente</th><th class="right">Vezes</th><th>Total aplicado</th><th class="right">Investido</th></tr></thead><tbody>
      ${Object.entries(pc).sort((a, b) => b[1].fat - a[1].fat).slice(0, 50).map(([id, o]) => `<tr class="click" onclick="location.hash='#/pacientes/${id}/atendimentos'"><td>${esc(o.nome)}</td><td class="right num">${o.n}</td><td class="num">${volTxt(o.vol)}</td><td class="right num">${brl(o.fat)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="btns end" style="margin-top:16px"><button class="btn" data-csv="tudo">${icon.dl}Baixar todos os atendimentos (planilha)</button></div>`;

  $$('#rUn [data-un]', out).forEach(b => b.onclick = () => { $$('#rUn [data-un]', out).forEach(x => x.setAttribute('aria-pressed', x === b)); $('#rVol', out).innerHTML = barras(rot, volMes[b.dataset.un], b.dataset.un); });
  out.onclick = e => {
    const c = e.target.closest('[data-csv]')?.dataset.csv; if (!c) return; const sfx = `${F.de}_a_${F.ate}`;
    if (c === 'proc') csv('procedimentos_' + sfx, [['Procedimento', 'Vezes', 'Pacientes', 'Total aplicado', 'Faturamento', 'Custo produto'], ...Object.entries(pp).map(([k, o]) => [procById(k)?.nome, o.n, o.pac.size, Object.entries(o.vol).map(([u, x]) => `${x} ${u}`).join(' + '), o.fat.toFixed(2).replace('.', ','), o.custo.toFixed(2).replace('.', ',')])]);
    if (c === 'area') csv('areas_' + sfx, [['Área', 'Unidade', 'Vezes', 'Total', 'Média'], ...Object.values(pa).map(o => [o.area, o.un, o.n, String(o.tot).replace('.', ','), (o.tot / o.n).toFixed(2).replace('.', ',')])]);
    if (c === 'lote') csv('lotes_' + sfx, [['Produto', 'Lote', 'Validade', 'Aplicado', 'Unidade', 'Pacientes'], ...Object.values(pl).map(o => [o.prod, o.lote, fd(o.val), String(o.tot).replace('.', ','), o.un, [...o.pac.values()].join(', ')])]);
    if (c === 'pac') csv('pacientes_' + sfx, [['Paciente', 'Vezes', 'Total aplicado', 'Investido'], ...Object.values(pc).map(o => [o.nome, o.n, Object.entries(o.vol).map(([u, x]) => `${x} ${u}`).join(' + '), o.fat.toFixed(2).replace('.', ',')])]);
    if (c === 'tudo') csv('atendimentos_' + sfx, [['Data', 'Paciente', 'Procedimento', 'Sessão', 'Área', 'Quantidade', 'Unidade', 'Lote', 'Valor do atendimento'], ...ats.flatMap(a => (a.aplicacoes.length ? a.aplicacoes : [{}]).map((x, i) => [fd(a.data), a.pacientes?.nome, procById(a.procedimento_id)?.nome, a.sessao, x.area || '', x.quantidade != null ? String(x.quantidade).replace('.', ',') : '', x.unidade || '', x.lotes?.lote || '', i === 0 ? String(a.valor).replace('.', ',') : '']))]);
  };
}
