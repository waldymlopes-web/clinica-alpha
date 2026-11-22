// Painel: resumo do mês, comparativos, agenda de hoje e previsões
import { sb, q, cache, procById } from '../db.js?v=202611220013';
import { esc, brl, money, kpi, MES, MES_C, longDate, fh, first, iso, addDays, pct, empty } from '../ui.js?v=202611220013';

export function barrasMensais(atual, anterior, rotulos, destaque) {
  const W = 720, H = 280, L = 52, R = 10, T = 16, B = 30;
  const mx = Math.max(1000, ...atual.filter(v => v != null), ...anterior);
  const passo = mx > 40000 ? 10000 : mx > 15000 ? 5000 : mx > 6000 ? 2000 : 1000; const max = Math.ceil(mx / passo) * passo;
  const n = rotulos.length, cw = (W - L - R) / n, x = i => L + cw * i + cw / 2, y = v => T + (H - T - B) * (1 - v / max), bw = cw * 0.52;
  let g = '';
  for (let v = 0; v <= max; v += passo) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(201,164,92,.10)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#776f5e">${v >= 1000 ? v / 1000 + 'k' : v}</text>`;
  atual.forEach((v, i) => { if (v == null) return; g += `<rect x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${Math.max(0, y(0) - y(v))}" fill="url(#gg)" opacity="${i === destaque ? 1 : .75}"><title>${rotulos[i]}: ${brl(v)}</title></rect>`; });
  g += `<polyline fill="none" stroke="#6b6354" stroke-width="1.6" stroke-dasharray="4 4" points="${anterior.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>`;
  anterior.forEach((v, i) => g += `<circle cx="${x(i)}" cy="${y(v)}" r="2.4" fill="#6b6354"><title>${rotulos[i]} ano anterior: ${brl(v)}</title></circle>`);
  rotulos.forEach((m, i) => g += `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="11" fill="${i === destaque ? '#ecd39a' : '#776f5e'}">${m}</text>`);
  if (destaque != null && atual[destaque]) g += `<text x="${x(destaque)}" y="${y(atual[destaque]) - 8}" text-anchor="middle" font-size="12" font-weight="600" fill="#ecd39a">${(atual[destaque] / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento mensal"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd39a"/><stop offset="1" stop-color="#8a6a2e"/></linearGradient></defs>${g}</svg>`;
}

const delta = (a, b) => { if (!b) return '<span class="faint">sem base</span>'; const d = (a - b) / b; return `<b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</b>`; };

export async function render(el) {
  const hoje = new Date(), y = hoje.getFullYear(), m = hoje.getMonth();
  const ini24 = new Date(y - 1, 0, 1), iniMes = new Date(y, m, 1), fimMes = new Date(y, m + 1, 1);
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = addDays(d0, 1);
  const [ats, contas, agHoje, pvHoje, manut, lotes] = await Promise.all([
    q(sb.from('atendimentos').select('data,valor,procedimento_id,paciente_id').gte('data', ini24.toISOString())),
    q(sb.from('contas').select('valor,vencimento').gte('vencimento', iso(new Date(y, m - 1, 1))).lt('vencimento', iso(fimMes))),
    q(sb.from('agendamentos').select('id,inicio,status,procedimento_id,pacientes(nome)').gte('inicio', d0.toISOString()).lt('inicio', d1.toISOString()).neq('status', 'cancelado').order('inicio')),
    sb.from('posvenda').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lte('data_prevista', iso(d0)),
    q(sb.from('posvenda').select('data_prevista,atendimentos(procedimento_id,valor)').eq('tipo', 'manutencao').eq('status', 'pendente').gte('data_prevista', iso(iniMes)).lt('data_prevista', iso(new Date(y, m + 3, 1)))),
    q(sb.from('lotes').select('produto_id,saldo,validade').gt('saldo', 0)),
  ]);
  const porMes = (ano) => { const a = Array(12).fill(0); ats.forEach(t => { const d = new Date(t.data); if (d.getFullYear() === ano) a[d.getMonth()] += Number(t.valor); }); return a; };
  const atual = porMes(y).map((v, i) => i > m ? null : v), ant = porMes(y - 1);
  const fatMes = atual[m], fatAnt = m ? atual[m - 1] : ant[11], fatAnoPass = ant[m];
  const doMes = ats.filter(t => new Date(t.data) >= iniMes && new Date(t.data) < fimMes);
  const despMes = contas.filter(c => c.vencimento >= iso(iniMes)).reduce((a, c) => a + Number(c.valor), 0);
  const ticket = doMes.length ? fatMes / new Set(doMes.map(t => t.paciente_id + iso(new Date(t.data)))).size : 0;
  const novas = new Set(); const vistas = new Set();
  ats.filter(t => new Date(t.data) < iniMes).forEach(t => vistas.add(t.paciente_id));
  doMes.forEach(t => { if (!vistas.has(t.paciente_id)) novas.add(t.paciente_id); });
  const pacMes = new Set(doMes.map(t => t.paciente_id)).size;

  const porProc = {}; doMes.forEach(t => porProc[t.procedimento_id] = (porProc[t.procedimento_id] || 0) + Number(t.valor));
  const procList = Object.entries(porProc).sort((a, b) => b[1] - a[1]); const pmx = procList[0]?.[1] || 1;

  const prev = [0, 1, 2].map(k => { const mm = new Date(y, m + k, 1), mf = new Date(y, m + k + 1, 1); const l = manut.filter(p => p.data_prevista >= iso(mm) && p.data_prevista < iso(mf)); return { mes: MES[mm.getMonth()], n: l.length, v: l.reduce((a, p) => a + Number(p.atendimentos?.valor || procById(p.atendimentos?.procedimento_id)?.preco || 0), 0) }; });

  const lim = addDays(d0, 60); const saldo = {}; lotes.forEach(l => saldo[l.produto_id] = (saldo[l.produto_id] || 0) + Number(l.saldo));
  const baixos = cache.produtos.filter(p => p.ativo && p.estoque_minimo > 0 && (saldo[p.id] || 0) / p.conteudo < p.estoque_minimo);
  const vencendo = lotes.filter(l => l.validade && new Date(l.validade) <= lim);
  const h = hoje.getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = first(cache.config.nome_curto?.replace(/^Dra?\.\s*/, '') || 'Vanessa');

  el.innerHTML = `
    <div class="head"><div><div class="eyebrow">${longDate(hoje)}</div><h1>${saud}, <em>${esc(nome)}</em></h1>
      <p class="sub">${agHoje.length ? `${agHoje.length} atendimento${agHoje.length > 1 ? 's' : ''} na agenda hoje` : 'Agenda livre hoje'}${pvHoje.count ? ` e ${pvHoje.count} contato${pvHoje.count > 1 ? 's' : ''} de pós-venda para fazer.` : '.'}</p></div>
      <div class="btns"><a class="btn" href="#/agenda">Agenda</a><a class="btn gold" href="#/posvenda">Contatos de hoje${pvHoje.count ? ' · ' + pvHoje.count : ''}</a></div></div>
    <div class="kpis">
      ${kpi('Faturamento · ' + MES[m], money(fatMes), `${delta(fatMes, fatAnt)} vs ${MES_C[(m + 11) % 12]} · ${delta(fatMes, fatAnoPass)} vs ${MES_C[m]}/${String(y - 1).slice(2)}`, true)}
      ${kpi('Resultado do mês', money(fatMes - despMes), `Despesas do mês ${brl(despMes)}`)}
      ${kpi('Ticket médio', money(ticket), `${doMes.length} procedimento${doMes.length !== 1 ? 's' : ''} no mês`)}
      ${kpi('Pacientes no mês', String(pacMes), `${novas.size} nova${novas.size !== 1 ? 's' : ''} · ${pacMes - novas.size} retorno${pacMes - novas.size !== 1 ? 's' : ''}`)}
    </div>
    <div class="cols">
      <div class="panel chart"><div class="panel-h"><h2>Faturamento mensal</h2><div class="legend"><span><i style="background:var(--gold)"></i>${y}</span><span><i style="background:#6b6354;height:2px"></i>${y - 1}</span></div></div>
        ${ats.length ? barrasMensais(atual, ant, MES_C, m) : empty('Ainda sem atendimentos', 'O gráfico se forma conforme os atendimentos são registrados.')}</div>
      <div class="panel"><div class="panel-h"><h2>Por procedimento</h2><h3>${MES[m]}</h3></div>
        ${procList.length ? `<div class="bars">${procList.map(([id, v]) => `<div class="bar-row"><span>${esc(procById(id)?.nome || 'Outro')}</span><span class="val num">${brl(v)} · ${pct(v / fatMes)}</span><div class="track"><i style="width:${v / pmx * 100}%"></i></div></div>`).join('')}</div>` : empty('Nada este mês ainda')}</div>
    </div>
    <div class="cols" style="margin-top:16px">
      <div class="panel"><div class="panel-h"><h2>Receita prevista</h2><h3>Manutenções vencendo</h3></div>
        <div class="kpis k3" style="margin:0">${prev.map(p => `<div class="kpi"><h3>${p.mes}</h3><div class="v num">${money(p.v)}</div><div class="d">${p.n} paciente${p.n !== 1 ? 's' : ''} no tempo de voltar</div></div>`).join('')}</div>
        <p class="hint" style="margin:12px 0 0">Calculado pelo tempo de efeito de cada procedimento. Os contatos aparecem no Pós-venda na data certa.</p></div>
      <div class="panel"><div class="panel-h"><h2>Hoje</h2><a class="btn sm" href="#/agenda">Abrir agenda</a></div>
        <div class="list">${agHoje.length ? agHoje.map(a => `<div class="row"><span class="num gold-t" style="width:52px">${fh(a.inicio)}</span><div class="grow"><div class="t">${esc(a.pacientes?.nome)}</div><div class="s">${esc(procById(a.procedimento_id)?.nome || 'Avaliação')}</div></div><span class="chip ${a.status === 'confirmado' ? 'ok' : a.status === 'realizado' ? 'mute' : ''}">${a.status}</span></div>`).join('') : empty('Nenhum horário hoje')}</div>
        ${baixos.length || vencendo.length ? `<div class="alert gold" style="margin-top:14px"><b>Estoque</b><span>${baixos.length ? baixos.map(p => esc(p.nome)).join(', ') + ' abaixo do mínimo. ' : ''}${vencendo.length ? vencendo.length + ' lote(s) vencem em até 60 dias.' : ''} <a href="#/estoque">Ver estoque</a></span></div>` : ''}
      </div>
    </div>`;
}
