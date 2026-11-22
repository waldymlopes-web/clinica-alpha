// Registro técnico do atendimento: procedimento, áreas, quantidades e lotes
import { sb, q, cache, procById, prodById, procsAtivos } from '../db.js?v=202611220013';
import { $, $$, esc, openSheet, closeSheet, toast, fail, opt, localInput, fd, nfmt, busy, brl, confirmar } from '../ui.js?v=202611220013';
import { enviarFotos } from './fotos.js?v=202611220013';
import { assinarDocumento } from './documentos.js?v=202611220013';

async function lotesDisponiveis() {
  return await q(sb.from('lotes').select('*').gt('saldo', 0).order('validade', { ascending: true, nullsFirst: false }));
}

/**
 * opts: { paciente, procedimento_id, data, valor, sessao, venda_id, agendamento_id, depois(atendimento) }
 */
export async function registrarAtendimento(opts) {
  const { paciente } = opts;
  const lotes = await lotesDisponiveis();
  let proc = procById(opts.procedimento_id) || null;
  const linhas = [];
  // sessão sugerida: quantas vezes já fez + 1 (dentro do protocolo)
  const sugerirSessao = async pid => {
    const p = procById(pid); if (!p || p.sessoes <= 1) return 1;
    const ult = await q(sb.from('atendimentos').select('sessao,data').eq('paciente_id', paciente.id).eq('procedimento_id', pid).order('data', { ascending: false }).limit(1));
    if (!ult.length) return 1; const s = ult[0].sessao; return s >= p.sessoes ? 1 : s + 1;
  };

  const b = openSheet({ eyebrow: 'Registro do atendimento', title: paciente.nome, body: `
    <div class="stack">
      <div class="panel"><div class="fields">
        <label class="field w2"><span>Procedimento *</span><select id="atProc">${opt('', 'Selecione', opts.procedimento_id)}${procsAtivos().map(p => opt(p.id, p.nome, opts.procedimento_id)).join('')}</select></label>
        <label class="field"><span>Data e hora</span><input type="datetime-local" id="atData" value="${localInput(opts.data || new Date())}"></label>
        <label class="field"><span>Sessão</span><input type="number" min="1" id="atSessao" value="${opts.sessao || 1}"></label>
        <label class="field"><span>Valor cobrado (R$)</span><input type="number" min="0" step="0.01" id="atValor" value="${opts.valor ?? ''}"></label>
        <label class="field w2"><span>Técnica / produto / diluição</span><input id="atTec" placeholder="ex.: cânula 22G, retroinjeção · diluição 2,5 ml"></label>
        <div class="field" id="atProtWrap"><span>Protocolo</span><div id="atProt" class="small muted" style="min-height:44px;display:flex;align-items:center">—</div></div>
      </div></div>

      <div class="panel">
        <div class="panel-h"><h2>Áreas e quantidades</h2><span class="hint" id="atUnHint"></span></div>
        <div id="atApl" class="stack" style="gap:8px"></div>
        <div class="btns" style="margin-top:10px"><button class="btn sm" id="atAdd">+ Área</button></div>
        <div class="apl-sum" id="atSum"></div>
      </div>

      <div class="panel"><div class="fields f2">
        <label class="field"><span>Observações</span><textarea id="atObs" placeholder="Como foi, orientações dadas, pontos de atenção"></textarea></label>
        <label class="field"><span>Intercorrências</span><textarea id="atInt" placeholder="Hematoma, edema, dor, reação… e a conduta tomada"></textarea></label>
      </div></div>
      <div class="btns end"><button class="btn" data-cancel>Cancelar</button><button class="btn gold" id="atSave">Salvar atendimento</button></div>
    </div>` });

  const unidadeDa = l => l.lote_id ? prodById(lotes.find(x => x.id === l.lote_id)?.produto_id)?.unidade : (proc?.unidade || 'un');
  const lotesDoProc = () => {
    if (!proc?.categoria_estoque) return [];
    return lotes.filter(l => prodById(l.produto_id)?.categoria === proc.categoria_estoque);
  };
  const render = () => {
    const ls = lotesDoProc();
    $('#atApl', b).innerHTML = linhas.map((l, i) => `<div class="apl">
      <input list="atAreas" data-i="${i}" data-k="area" value="${esc(l.area)}" placeholder="Área">
      <input type="number" min="0" step="0.01" inputmode="decimal" data-i="${i}" data-k="quantidade" value="${l.quantidade ?? ''}" placeholder="Qtd (${esc(unidadeDa(l))})" aria-label="Quantidade em ${esc(unidadeDa(l))}">
      <select data-i="${i}" data-k="lote">${opt('', ls.length ? 'Sem baixa de estoque' : (proc?.categoria_estoque ? 'Sem lote em estoque' : 'Não usa estoque'), l.lote_id)}${ls.map(x => { const p = prodById(x.produto_id); return opt(x.id, `${p.nome} · lote ${x.lote} · val. ${fd(x.validade)} · ${nfmt(x.saldo)} ${p.unidade}`, l.lote_id); }).join('')}</select>
      <button class="rm" data-rm="${i}" aria-label="Remover área">×</button></div>`).join('') +
      `<datalist id="atAreas">${(proc?.areas || []).map(a => `<option value="${esc(a)}">`).join('')}</datalist>`;
    soma();
  };
  const soma = () => {
    const t = {}; linhas.forEach(l => { if (l.quantidade) { const u = unidadeDa(l); t[u] = (t[u] || 0) + Number(l.quantidade); } });
    const avisos = [];
    const porLote = {}; linhas.forEach(l => { if (l.lote_id && l.quantidade) porLote[l.lote_id] = (porLote[l.lote_id] || 0) + Number(l.quantidade); });
    Object.entries(porLote).forEach(([id, qt]) => { const lo = lotes.find(x => x.id === id); if (lo && qt > Number(lo.saldo)) avisos.push(`Lote ${lo.lote} tem só ${nfmt(lo.saldo)}`); });
    $('#atSum', b).innerHTML = Object.entries(t).map(([u, v]) => `<span>Total: <b class="gold-t">${nfmt(v)} ${esc(u)}</b></span>`).join('') + avisos.map(a => `<span class="bad-t">${esc(a)}</span>`).join('');
  };
  const trocarProc = async () => {
    proc = procById($('#atProc', b).value) || null;
    if (proc && ($('#atValor', b).value === '' || opts._auto)) { $('#atValor', b).value = proc.modo_preco === 'fixo' ? proc.preco : ''; opts._auto = true; }
    $('#atProt', b).textContent = proc ? (proc.sessoes > 1 ? `${proc.sessoes} sessões a cada ${proc.intervalo_sessoes_dias || '?'} dias` : 'Sessão única') + (proc.ciclo_dias ? ` · efeito ~${proc.ciclo_dias} dias` : '') : '—';
    $('#atUnHint', b).textContent = proc ? `Quantidades em ${proc.unidade}${proc.categoria_estoque ? ' · o lote escolhido sai do estoque' : ''}` : '';
    if (!opts.sessao && proc) $('#atSessao', b).value = await sugerirSessao(proc.id);
    const ls = lotesDoProc();
    linhas.forEach(l => { if (l.lote_id && !ls.find(x => x.id === l.lote_id)) l.lote_id = ''; });
    if (!linhas.length) linhas.push({ area: proc?.areas?.[0] || '', quantidade: null, lote_id: ls[0]?.id || '' });
    else linhas.forEach(l => { if (!l.lote_id && ls[0]) l.lote_id = ls[0].id; if (!l.area && l.quantidade == null && proc?.areas?.length) l.area = proc.areas[0]; });
    render();
  };
  $('#atProc', b).onchange = () => { opts._auto = true; trocarProc(); };
  $('#atAdd', b).onclick = () => { const ls = lotesDoProc(); linhas.push({ area: '', quantidade: null, lote_id: linhas.at(-1)?.lote_id || ls[0]?.id || '' }); render(); $$('#atApl input[data-k="area"]', b).at(-1)?.focus(); };
  $('#atApl', b).addEventListener('input', e => { const i = e.target.dataset.i; if (i == null) return; const k = e.target.dataset.k; const l = linhas[+i];
    if (k === 'area') l.area = e.target.value; else if (k === 'quantidade') l.quantidade = e.target.value === '' ? null : Number(e.target.value); else if (k === 'lote') { l.lote_id = e.target.value; render(); return; } soma(); });
  $('#atApl', b).addEventListener('change', e => { if (e.target.dataset.k === 'lote') { linhas[+e.target.dataset.i].lote_id = e.target.value; render(); } });
  $('#atApl', b).addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { linhas.splice(+r.dataset.rm, 1); render(); } });
  $('[data-cancel]', b).onclick = closeSheet;
  await trocarProc();

  $('#atSave', b).onclick = async e => {
    if (!proc) { toast('Escolha o procedimento.', true); return; }
    const apl = linhas.filter(l => l.area?.trim() || l.quantidade);
    if (apl.some(l => !l.area?.trim())) { toast('Informe a área de cada linha.', true); return; }
    const porLote = {}; apl.forEach(l => { if (l.lote_id && l.quantidade) porLote[l.lote_id] = (porLote[l.lote_id] || 0) + Number(l.quantidade); });
    for (const [id, qt] of Object.entries(porLote)) { const lo = lotes.find(x => x.id === id); if (qt > Number(lo.saldo) && !(await confirmar('Quantidade maior que o estoque', `O lote ${lo.lote} tem ${nfmt(lo.saldo)} no sistema e você informou ${nfmt(qt)}. Salvar mesmo assim? O saldo fica zerado.`, 'Salvar assim'))) return; }
    await busy(e.currentTarget, async () => {
      try {
        const at = await q(sb.from('atendimentos').insert({
          paciente_id: paciente.id, procedimento_id: proc.id, venda_id: opts.venda_id || null, agendamento_id: opts.agendamento_id || null,
          data: new Date($('#atData', b).value).toISOString(), sessao: Number($('#atSessao', b).value) || 1, valor: Number($('#atValor', b).value) || 0,
          tecnica: $('#atTec', b).value.trim() || null, observacoes: $('#atObs', b).value.trim() || null, intercorrencias: $('#atInt', b).value.trim() || null,
        }).select().single());
        if (apl.length) await q(sb.from('aplicacoes').insert(apl.map(l => {
          const lo = lotes.find(x => x.id === l.lote_id);
          return { atendimento_id: at.id, area: l.area.trim(), quantidade: Number(l.quantidade) || 0, unidade: unidadeDa(l), lote_id: l.lote_id || null, produto_id: lo?.produto_id || null };
        })));
        if (opts.agendamento_id) await q(sb.from('agendamentos').update({ status: 'realizado' }).eq('id', opts.agendamento_id));
        toast('Atendimento registrado. Estoque e pós-venda atualizados.');
        posAtendimento(paciente, at, proc, opts);
      } catch (err) { fail(err); }
    });
  };
}

function posAtendimento(paciente, at, proc, opts) {
  const b = openSheet({ eyebrow: 'Atendimento salvo', title: proc.nome, body: `
    <div class="panel stack">
      <p class="muted" style="margin:0">Registrado no prontuário de ${esc(paciente.nome)}. O pós-venda já programou os contatos deste procedimento.</p>
      <div class="btns">
        <button class="btn gold" id="paFotos">Adicionar fotos de depois</button>
        <button class="btn" id="paDoc">Assinar termo</button>
        ${opts.proximo ? `<button class="btn gold" id="paProx">Registrar próximo item</button>` : ''}
        <button class="btn" id="paFim">${opts.proximo ? 'Terminar depois' : 'Concluir'}</button>
      </div>
    </div>`, onClose: () => opts.depois && opts.depois(at) });
  $('#paFotos', b).onclick = () => enviarFotos({ paciente, atendimento: at, procedimento_id: proc.id, momento: 'depois', onDone: () => opts.depois && opts.depois(at) });
  $('#paDoc', b).onclick = () => assinarDocumento({ paciente, tipo: proc.termo || 'injetavel', procedimento: proc, atendimento: at, onDone: () => opts.depois && opts.depois(at) });
  $('#paFim', b).onclick = () => closeSheet();
  if (opts.proximo) $('#paProx', b).onclick = () => { const f = opts.depois; opts.depois = null; closeSheet(); opts.proximo(); opts.depois = f; };
}

// Detalhe de um atendimento (com apagar)
export async function verAtendimento(id, onChange) {
  const at = await q(sb.from('atendimentos').select('*, pacientes(nome), aplicacoes(*, lotes(lote,validade), produtos(nome))').eq('id', id).single());
  const p = procById(at.procedimento_id);
  const b = openSheet({ eyebrow: fd(at.data) + (at.sessao > 1 || p?.sessoes > 1 ? ` · sessão ${at.sessao}${p?.sessoes > 1 ? ' de ' + p.sessoes : ''}` : ''), title: (p?.nome || 'Atendimento'), body: `
    <div class="panel stack">
      <dl class="facts">
        <div class="fact"><dt>Paciente</dt><dd>${esc(at.pacientes?.nome)}</dd></div>
        <div class="fact"><dt>Valor</dt><dd class="num">${brl(at.valor)}</dd></div>
        <div class="fact"><dt>Técnica</dt><dd>${esc(at.tecnica || '—')}</dd></div>
      </dl>
      <div class="tbl-wrap"><table><thead><tr><th>Área</th><th>Quantidade</th><th>Produto e lote</th></tr></thead><tbody>
      ${at.aplicacoes.map(a => `<tr><td>${esc(a.area)}</td><td class="num">${nfmt(a.quantidade)} ${esc(a.unidade)}</td><td>${a.lotes ? `${esc(a.produtos?.nome || '')} · lote ${esc(a.lotes.lote)} · val. ${fd(a.lotes.validade)}` : '<span class="faint">—</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="faint">Sem áreas registradas</td></tr>'}
      </tbody></table></div>
      ${at.observacoes ? `<div><h3>Observações</h3><p style="margin:6px 0 0;white-space:pre-wrap">${esc(at.observacoes)}</p></div>` : ''}
      ${at.intercorrencias ? `<div class="alert"><b>Intercorrência</b><span style="white-space:pre-wrap">${esc(at.intercorrencias)}</span></div>` : ''}
    </div>
    <div class="btns end" style="margin-top:16px"><button class="btn danger" id="atDel">Apagar registro</button></div>` });
  $('#atDel', b).onclick = async () => {
    if (!(await confirmar('Apagar este atendimento?', 'As quantidades voltam para o estoque e os contatos de pós-venda dele são removidos. Fotos e documentos continuam no prontuário.', 'Apagar', true))) return;
    try { await q(sb.from('atendimentos').delete().eq('id', id)); closeSheet(); toast('Atendimento apagado.'); onChange && onChange(); } catch (e) { fail(e); }
  };
}
