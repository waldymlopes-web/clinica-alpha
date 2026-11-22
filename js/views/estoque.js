// Estoque por lote e validade, entradas, ajustes e sugestão de compra
import { sb, q, cache, prodById, loadRefs } from '../db.js?v=202611220013';
import { $, $$, esc, openSheet, closeSheet, toast, fail, opt, fd, iso, addDays, brl, money, kpi, nfmt, empty, icon, busy, daysBetween, formData } from '../ui.js?v=202611220013';
import { atualizarBadges } from '../main.js?v=202611220013';

const CATS = ['Toxina', 'Preenchedor', 'Bioestimulador', 'Skinbooster', 'Anestésico', 'Descartáveis', 'Dermocosméticos', 'Outros'];
let aba = 'produtos';

export async function render(el) {
  await loadRefs(true);
  const [lotes, movs] = await Promise.all([
    q(sb.from('lotes').select('*').order('validade', { ascending: true, nullsFirst: false })),
    q(sb.from('movimentos').select('*, lotes(lote,produto_id), atendimentos(pacientes(nome))').order('criado_em', { ascending: false }).limit(400)),
  ]);
  const hoje = new Date(); const com = lotes.filter(l => Number(l.saldo) > 0);
  const saldo = {}, valor = {}; com.forEach(l => { const p = prodById(l.produto_id); saldo[l.produto_id] = (saldo[l.produto_id] || 0) + Number(l.saldo); valor[l.produto_id] = (valor[l.produto_id] || 0) + Number(l.saldo) / (p?.conteudo || 1) * Number(l.custo_embalagem); });
  // consumo dos últimos 90 dias
  const cons = {}; movs.filter(m => m.tipo === 'saida' && new Date(m.criado_em) >= addDays(hoje, -90)).forEach(m => { const pid = m.lotes?.produto_id; if (pid) cons[pid] = (cons[pid] || 0) - Number(m.quantidade); });
  const prods = cache.produtos.filter(p => p.ativo);
  const embal = p => (saldo[p.id] || 0) / (p.conteudo || 1);
  const baixo = prods.filter(p => p.estoque_minimo > 0 && embal(p) < p.estoque_minimo);
  const venc = com.filter(l => l.validade && daysBetween(hoje, l.validade) <= 60);
  const abertos = com.filter(l => l.aberto_em && Number(l.saldo) < (prodById(l.produto_id)?.conteudo || 1) && Number(l.saldo) % (prodById(l.produto_id)?.conteudo || 1) !== 0);
  const total = Object.values(valor).reduce((a, b) => a + b, 0);

  el.innerHTML = `<div class="head"><div><div class="eyebrow">Produtos e insumos</div><h1>Estoque</h1><p class="sub">Cada atendimento dá baixa no lote usado, em unidades ou ml. O sistema avisa o que está acabando e o que vence primeiro.</p></div>
    <div class="btns"><button class="btn" id="stProd">${icon.plus}Novo produto</button><button class="btn gold" id="stEntrada">${icon.plus}Registrar entrada</button></div></div>
    <div class="kpis">
      ${kpi('Valor em estoque', money(total), 'pelo custo de compra', true)}
      ${kpi('Abaixo do mínimo', String(baixo.length), baixo.map(p => esc(p.nome)).join(' · ') || 'tudo em dia')}
      ${kpi('Vencem em 60 dias', String(venc.length), venc.slice(0, 3).map(l => esc(prodById(l.produto_id)?.nome) + ' · ' + esc(l.lote)).join(' · ') || 'nenhum lote')}
      ${kpi('Frascos abertos', String(abertos.length), abertos.slice(0, 2).map(l => `${esc(prodById(l.produto_id)?.nome)} · resta ${nfmt(l.saldo)} ${esc(prodById(l.produto_id)?.unidade)}`).join(' · ') || 'nenhum')}
    </div>
    <div class="tabs">${[['produtos', 'Produtos'], ['lotes', 'Lotes'], ['movimentos', 'Movimentações']].map(([k, v]) => `<button aria-pressed="${aba === k}" data-aba="${k}">${v}</button>`).join('')}</div>
    <div class="panel" id="stBody"></div>`;
  $$('[data-aba]', el).forEach(b => b.onclick = () => { aba = b.dataset.aba; render(el); });
  const re = () => { render(el); atualizarBadges(); };
  $('#stEntrada').onclick = () => entrada(null, re);
  $('#stProd').onclick = () => produtoForm({}, re);
  const B = $('#stBody');

  if (aba === 'produtos') {
    B.innerHTML = prods.length ? `<div class="tbl-wrap"><table><thead><tr><th>Produto</th><th>Em estoque</th><th>Consumo 90 dias</th><th>Dura cerca de</th><th class="right">Valor</th><th></th></tr></thead><tbody>${prods.map(p => {
      const e = embal(p), c90 = cons[p.id] || 0, porDia = c90 / 90, dura = porDia ? Math.round((saldo[p.id] || 0) / porDia) : null, low = p.estoque_minimo > 0 && e < p.estoque_minimo;
      return `<tr class="click" data-p="${p.id}"><td><b style="font-weight:500">${esc(p.nome)}</b><div class="s">${esc(p.categoria)}${p.fabricante ? ' · ' + esc(p.fabricante) : ''} · ${esc(p.embalagem)} de ${nfmt(p.conteudo)} ${esc(p.unidade)}</div></td>
        <td class="num"><b class="${low ? 'bad-t' : ''}" style="font-weight:500">${nfmt(saldo[p.id] || 0)} ${esc(p.unidade)}</b><div class="s">${nfmt(e)} ${esc(p.embalagem)}(s)${p.estoque_minimo ? ` · mínimo ${nfmt(p.estoque_minimo)}` : ''}</div></td>
        <td class="num">${c90 ? nfmt(c90) + ' ' + esc(p.unidade) : '<span class="faint">—</span>'}</td>
        <td>${dura != null ? `<span class="chip ${dura < 30 ? 'bad' : dura < 60 ? 'warn' : 'ok'}">${dura} dias</span>` : '<span class="faint">—</span>'}</td>
        <td class="right num">${brl(valor[p.id] || 0)}</td><td class="right"><button class="btn sm" data-ent="${p.id}">Entrada</button></td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint" style="margin:12px 0 0">"Dura cerca de" usa o consumo real dos últimos 90 dias. Toque num produto para editar o mínimo e o prazo depois de aberto.</p>`
      : empty('Nenhum produto cadastrado', 'Cadastre os produtos em "Novo produto".');
    B.onclick = e => { const en = e.target.closest('[data-ent]'); if (en) { e.stopPropagation(); entrada(en.dataset.ent, re); return; } const r = e.target.closest('[data-p]'); if (r) produtoForm(prodById(r.dataset.p), re); };
  }
  if (aba === 'lotes') {
    const porProd = {}; com.forEach(l => (porProd[l.produto_id] = porProd[l.produto_id] || []).push(l));
    B.innerHTML = com.length ? `<div class="tbl-wrap"><table><thead><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Saldo</th><th>Fornecedor</th><th class="right">Ajustar</th></tr></thead><tbody>${com.sort((a, b) => (prodById(a.produto_id)?.nome || '').localeCompare(prodById(b.produto_id)?.nome || '') || String(a.validade).localeCompare(String(b.validade))).map(l => {
      const p = prodById(l.produto_id), dv = l.validade ? daysBetween(hoje, l.validade) : null, prim = porProd[l.produto_id].length > 1 && porProd[l.produto_id][0].id === l.id;
      const prazoAb = l.aberto_em && p?.prazo_aberto_dias ? daysBetween(hoje, addDays(l.aberto_em, p.prazo_aberto_dias)) : null;
      return `<tr><td>${esc(p?.nome)}</td><td class="num">${esc(l.lote)}${prim ? '<div class="s gold-t">usar primeiro</div>' : ''}</td>
        <td class="num">${fd(l.validade)}${dv != null && dv <= 60 ? `<div><span class="chip ${dv < 0 ? 'bad' : 'warn'}">${dv < 0 ? 'Vencido' : 'vence em ' + dv + ' dias'}</span></div>` : ''}</td>
        <td class="num">${nfmt(l.saldo)} ${esc(p?.unidade)}${l.aberto_em ? `<div class="s">aberto em ${fd(l.aberto_em)}${prazoAb != null ? ` · <span class="${prazoAb <= 1 ? 'bad-t' : ''}">usar até ${fd(addDays(l.aberto_em, p.prazo_aberto_dias))}</span>` : ''}</div>` : ''}</td>
        <td>${esc(l.fornecedor || '—')}<div class="s">${brl(l.custo_embalagem)} / ${esc(p?.embalagem)}</div></td>
        <td class="right"><button class="btn sm" data-aj="${l.id}">Ajustar</button></td></tr>`; }).join('')}</tbody></table></div>` : empty('Nenhum lote com saldo', 'Registre uma entrada para começar.');
    B.onclick = e => { const a = e.target.closest('[data-aj]'); if (a) ajuste(lotes.find(l => l.id === a.dataset.aj), re); };
  }
  if (aba === 'movimentos') {
    const T = { entrada: ['↓', 'ok-t', 'Entrada'], saida: ['↑', 'gold-t', 'Saída'], ajuste: ['±', 'muted', 'Ajuste'], perda: ['×', 'bad-t', 'Perda'] };
    B.innerHTML = movs.length ? `<div class="list">${movs.slice(0, 120).map(m => { const p = prodById(m.lotes?.produto_id); const t = T[m.tipo];
      return `<div class="row"><span class="avatar ${t[1]}" style="font-family:var(--body);font-size:16px">${t[0]}</span><div class="grow"><div class="t">${esc(p?.nome || '')} · ${nfmt(Math.abs(m.quantidade))} ${esc(p?.unidade || '')}</div><div class="s">${t[2]} · lote ${esc(m.lotes?.lote || '')}${m.atendimentos?.pacientes ? ' · ' + esc(m.atendimentos.pacientes.nome) : ''}${m.observacao ? ' · ' + esc(m.observacao) : ''}</div></div><span class="small muted num">${fd(m.criado_em)}</span></div>`; }).join('')}</div>` : empty('Nenhuma movimentação ainda');
  }
}

function produtoForm(p = {}, re) {
  const novo = !p.id;
  const b = openSheet({ eyebrow: novo ? 'Cadastro' : 'Editar produto', title: novo ? 'Novo produto' : p.nome, body: `<form class="panel stack" id="pf">
    <div class="fields f3">
      <label class="field w2"><span>Nome *</span><input name="nome" required value="${esc(p.nome)}" placeholder="ex.: Botox 100U"></label>
      <label class="field"><span>Categoria *</span><select name="categoria">${CATS.map(c => opt(c, null, p.categoria)).join('')}</select></label>
      <label class="field"><span>Fabricante</span><input name="fabricante" value="${esc(p.fabricante)}"></label>
      <label class="field"><span>Embalagem</span><select name="embalagem">${['frasco', 'seringa', 'ampola', 'caixa', 'pacote', 'unidade'].map(x => opt(x, null, p.embalagem || 'frasco')).join('')}</select></label>
      <label class="field"><span>Unidade de uso</span><select name="unidade">${['U', 'ml', 'frasco', 'seringa', 'un', 'g'].map(x => opt(x, null, p.unidade || 'un')).join('')}</select></label>
      <label class="field"><span>Conteúdo da embalagem</span><input name="conteudo" type="number" min="0.01" step="0.01" value="${p.conteudo ?? 1}"></label>
      <label class="field"><span>Estoque mínimo (embalagens)</span><input name="estoque_minimo" type="number" min="0" step="0.5" value="${p.estoque_minimo ?? 1}"></label>
      <label class="field"><span>Usar em até (dias após aberto)</span><input name="prazo_aberto_dias" type="number" min="0" value="${p.prazo_aberto_dias ?? ''}" placeholder="conforme bula"></label>
      ${novo ? '' : `<label class="check field full"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}> Produto em uso</label>`}
    </div>
    <p class="hint" style="margin:0">Exemplo: Botox 100U → embalagem frasco, unidade U, conteúdo 100. Ácido hialurônico → seringa, ml, 1.</p>
    <div class="btns end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn gold">Salvar</button></div></form>` });
  $('[data-x]', b).onclick = closeSheet;
  $('#pf', b).onsubmit = async e => { e.preventDefault(); const d = formData(e.target); if (!d.nome) return toast('Informe o nome.', true);
    try { if (novo) await q(sb.from('produtos').insert(d)); else await q(sb.from('produtos').update(d).eq('id', p.id)); await loadRefs(true); closeSheet(); toast('Produto salvo.'); re(); } catch (err) { fail(err); } };
}

function entrada(produtoId, re) {
  const prods = cache.produtos.filter(p => p.ativo);
  if (!prods.length) { toast('Cadastre o produto primeiro.', true); produtoForm({}, re); return; }
  const b = openSheet({ eyebrow: 'Nota do fornecedor', title: 'Registrar entrada', body: `<form class="panel stack" id="ef">
    <div class="fields f3">
      <label class="field w2"><span>Produto *</span><select name="produto_id">${prods.map(p => opt(p.id, `${p.nome} (${p.embalagem} de ${nfmt(p.conteudo)} ${p.unidade})`, produtoId)).join('')}</select></label>
      <label class="field"><span>Lote *</span><input name="lote" required></label>
      <label class="field"><span>Validade *</span><input name="validade" type="date" required></label>
      <label class="field"><span>Quantidade (embalagens) *</span><input name="qtd" type="number" min="0.5" step="0.5" value="1" required></label>
      <label class="field"><span>Custo por embalagem (R$)</span><input name="custo_embalagem" type="number" min="0" step="0.01"></label>
      <label class="field w2"><span>Fornecedor</span><input name="fornecedor" list="fornList"><datalist id="fornList"></datalist></label>
      <label class="field"><span>Vencimento do boleto</span><input name="venc" type="date" value="${iso(addDays(new Date(), 30))}"></label>
    </div>
    <label class="check"><input type="checkbox" name="conta" checked> Lançar o valor em contas a pagar</label>
    <div class="totals num" id="efTot"></div>
    <div class="btns end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn gold" id="efSave">Salvar entrada</button></div></form>` });
  const f = $('#ef', b);
  sb.from('lotes').select('fornecedor').not('fornecedor', 'is', null).then(({ data }) => { $('#fornList', b).innerHTML = [...new Set((data || []).map(x => x.fornecedor))].map(x => `<option value="${esc(x)}">`).join(''); });
  const tot = () => { const t = (Number(f.qtd.value) || 0) * (Number(f.custo_embalagem.value) || 0); $('#efTot', b).innerHTML = t ? `<span>Total da nota</span><span class="g">${brl(t, 2)}</span>` : ''; };
  f.addEventListener('input', tot);
  $('[data-x]', b).onclick = closeSheet;
  f.onsubmit = async e => {
    e.preventDefault(); const d = formData(f); const p = prodById(d.produto_id);
    if (!d.lote || !d.validade || !d.qtd) return toast('Preencha lote, validade e quantidade.', true);
    await busy($('#efSave', b), async () => {
      try {
        const lote = await q(sb.from('lotes').insert({ produto_id: d.produto_id, lote: d.lote, validade: d.validade, fornecedor: d.fornecedor, custo_embalagem: d.custo_embalagem || 0, saldo: d.qtd * p.conteudo }).select().single());
        if (d.conta && d.custo_embalagem) await q(sb.from('contas').insert({ descricao: `${p.nome} · ${nfmt(d.qtd)} ${p.embalagem}(s) · lote ${d.lote}`, categoria: 'Produtos', fornecedor: d.fornecedor, valor: d.qtd * d.custo_embalagem, vencimento: d.venc || iso(new Date()), lote_id: lote.id }));
        closeSheet(); toast('Entrada registrada' + (d.conta && d.custo_embalagem ? ' e lançada em contas a pagar.' : '.')); re();
      } catch (err) { fail(err); }
    });
  };
}

function ajuste(l, re) {
  const p = prodById(l.produto_id);
  const b = openSheet({ eyebrow: `Lote ${l.lote} · saldo ${nfmt(l.saldo)} ${p.unidade}`, title: 'Ajustar ' + p.nome, body: `<form class="panel stack" id="af">
    <div class="fields f3">
      <label class="field"><span>Tipo</span><select name="tipo">${opt('perda', 'Perda / descarte')}${opt('ajuste', 'Contagem (corrigir saldo)')}${opt('saida', 'Uso sem atendimento')}</select></label>
      <label class="field"><span id="afLbl">Quantidade (${esc(p.unidade)})</span><input name="qtd" type="number" step="0.01" min="0" required></label>
      <label class="field"><span>Motivo</span><input name="obs" placeholder="ex.: frasco vencido, quebra"></label>
    </div>
    <div class="btns end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn gold">Salvar ajuste</button></div></form>` });
  const f = $('#af', b);
  f.tipo.onchange = () => $('#afLbl', b).textContent = f.tipo.value === 'ajuste' ? `Saldo contado (${p.unidade})` : `Quantidade (${p.unidade})`;
  $('[data-x]', b).onclick = closeSheet;
  f.onsubmit = async e => {
    e.preventDefault(); const qtd = Number(f.qtd.value); if (isNaN(qtd)) return;
    const delta = f.tipo.value === 'ajuste' ? qtd - Number(l.saldo) : -qtd;
    try { await q(sb.rpc('ajustar_lote', { p_lote: l.id, p_quantidade: delta, p_tipo: f.tipo.value, p_obs: f.obs.value.trim() || null })); closeSheet(); toast('Saldo ajustado.'); re(); } catch (err) { fail(err); }
  };
}
