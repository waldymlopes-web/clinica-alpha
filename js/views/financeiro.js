// Financeiro: resultado do mês, contas a pagar, contas a receber e fluxo de caixa
import { sb, q, cache, procById, prodById } from '../db.js?v=202611220031';
import { $, $$, esc, openSheet, closeSheet, toast, fail, opt, fd, iso, addDays, brl, money, kpi, MES, empty, icon, busy, formData, confirmar, pct } from '../ui.js?v=202611220031';

const CATS = ['Fixa', 'Produtos', 'Insumos', 'Marketing', 'Pessoal', 'Impostos', 'Equipamentos', 'Cursos', 'Outros'];
let mesSel = null, aba = 'resumo';

export async function render(el) {
  if (!mesSel) { const h = new Date(); mesSel = new Date(h.getFullYear(), h.getMonth(), 1); }
  const ini = iso(mesSel), fim = iso(new Date(mesSel.getFullYear(), mesSel.getMonth() + 1, 1));
  const [contas, rec, ats, movs] = await Promise.all([
    q(sb.from('contas').select('*').gte('vencimento', ini).lt('vencimento', fim).order('vencimento')),
    q(sb.from('recebimentos').select('*, pacientes(nome)').or(`and(vencimento.gte.${ini},vencimento.lt.${fim}),and(recebido_em.gte.${ini},recebido_em.lt.${fim})`).order('vencimento')),
    q(sb.from('atendimentos').select('valor,procedimento_id').gte('data', new Date(mesSel).toISOString()).lt('data', new Date(mesSel.getFullYear(), mesSel.getMonth() + 1, 1).toISOString())),
    q(sb.from('movimentos').select('quantidade, lotes(custo_embalagem,produto_id)').eq('tipo', 'saida').gte('criado_em', new Date(mesSel).toISOString()).lt('criado_em', new Date(mesSel.getFullYear(), mesSel.getMonth() + 1, 1).toISOString())),
  ]);
  const hoje = iso(new Date());
  const fat = ats.reduce((a, t) => a + Number(t.valor), 0);
  const custoProd = movs.reduce((a, m) => { const p = prodById(m.lotes?.produto_id); return a + (-Number(m.quantidade)) / (p?.conteudo || 1) * Number(m.lotes?.custo_embalagem || 0); }, 0);
  const taxas = rec.filter(r => r.vencimento >= ini && r.vencimento < fim).reduce((a, r) => a + Number(r.taxa), 0);
  const despesas = contas.filter(c => c.categoria !== 'Produtos').reduce((a, c) => a + Number(c.valor), 0);
  const resultado = fat - custoProd - taxas - despesas;
  const entrou = rec.filter(r => r.recebido_em && r.recebido_em >= ini && r.recebido_em < fim).reduce((a, r) => a + Number(r.valor) - Number(r.taxa), 0);
  const saiu = contas.filter(c => c.pago_em).reduce((a, c) => a + Number(c.valor), 0);
  const aPagar = contas.filter(c => !c.pago_em), aReceber = rec.filter(r => !r.recebido_em);
  const titulo = `${MES[mesSel.getMonth()]} ${mesSel.getFullYear()}`;

  el.innerHTML = `<div class="head"><div><div class="eyebrow">Financeiro</div><h1 style="text-transform:capitalize">${titulo}</h1></div>
    <div class="btns"><button class="btn icon" id="fPrev" aria-label="Mês anterior">${icon.back}</button><button class="btn sm" id="fHoje">Mês atual</button><button class="btn icon" id="fNext" aria-label="Próximo mês">${icon.next}</button><button class="btn gold" id="fNova">${icon.plus}Nova conta</button></div></div>
    <div class="kpis">
      ${kpi('Faturamento', money(fat), `${ats.length} procedimento(s) realizados`, true)}
      ${kpi('Resultado', `<span class="${resultado >= 0 ? '' : 'bad-t'}">${money(resultado)}</span>`, fat ? `margem de ${pct(resultado / fat)}` : '—')}
      ${kpi('A pagar', money(aPagar.reduce((a, c) => a + Number(c.valor), 0)), `${aPagar.filter(c => c.vencimento < hoje).length} vencida(s)`)}
      ${kpi('A receber', money(aReceber.reduce((a, r) => a + Number(r.valor), 0)), `${aReceber.length} parcela(s)`)}
    </div>
    <div class="tabs">${[['resumo', 'Resultado do mês'], ['pagar', `Contas a pagar · ${contas.length}`], ['receber', `A receber · ${aReceber.length}`]].map(([k, v]) => `<button aria-pressed="${aba === k}" data-aba="${k}">${v}</button>`).join('')}</div>
    <div id="fBody"></div>`;
  const re = () => render(el);
  $('#fPrev').onclick = () => { mesSel = new Date(mesSel.getFullYear(), mesSel.getMonth() - 1, 1); re(); };
  $('#fNext').onclick = () => { mesSel = new Date(mesSel.getFullYear(), mesSel.getMonth() + 1, 1); re(); };
  $('#fHoje').onclick = () => { mesSel = null; re(); };
  $('#fNova').onclick = () => contaForm({}, re);
  $$('[data-aba]', el).forEach(b => b.onclick = () => { aba = b.dataset.aba; re(); });
  const B = $('#fBody');

  if (aba === 'resumo') {
    const porCat = {}; contas.filter(c => c.categoria !== 'Produtos').forEach(c => porCat[c.categoria] = (porCat[c.categoria] || 0) + Number(c.valor));
    const porProc = {}; ats.forEach(t => porProc[t.procedimento_id] = (porProc[t.procedimento_id] || 0) + Number(t.valor));
    const linha = (t, v, cls = '', sub = '') => `<tr><td>${t}${sub ? `<div class="s">${sub}</div>` : ''}</td><td class="right num ${cls}">${v < 0 ? '− ' + brl(-v, 2) : brl(v, 2)}</td></tr>`;
    B.innerHTML = `<div class="cols even">
      <div class="panel"><div class="panel-h"><h2>Resultado</h2><h3>Pelo que foi realizado</h3></div><div class="tbl-wrap"><table><tbody>
        ${linha('<b>Faturamento</b>', fat, 'gold-t')}
        ${Object.entries(porProc).sort((a, b) => b[1] - a[1]).map(([id, v]) => linha(`<span class="muted" style="padding-left:14px">${esc(procById(id)?.nome || 'Outro')}</span>`, v, 'muted')).join('')}
        ${linha('Custo dos produtos aplicados', -custoProd, '', 'Pelo custo do lote usado em cada atendimento')}
        ${linha('Taxas de cartão', -taxas)}
        ${Object.entries(porCat).map(([c, v]) => linha('Despesas · ' + esc(c), -v)).join('')}
        <tr><td><b>Resultado</b></td><td class="right num"><b class="${resultado >= 0 ? 'ok-t' : 'bad-t'}" style="font-family:var(--display);font-size:22px">${brl(resultado, 2)}</b></td></tr>
      </tbody></table></div><p class="hint" style="margin:10px 0 0">Compras de produto não entram como despesa aqui: o custo aparece quando o produto é aplicado.</p></div>
      <div class="panel"><div class="panel-h"><h2>Caixa do mês</h2><h3>O que entrou e saiu de fato</h3></div><div class="tbl-wrap"><table><tbody>
        ${linha('Recebido (já sem taxas)', entrou, 'ok-t')}
        ${linha('Contas pagas', -saiu, 'bad-t')}
        <tr><td><b>Saldo do mês</b></td><td class="right num"><b style="font-family:var(--display);font-size:22px">${brl(entrou - saiu, 2)}</b></td></tr>
      </tbody></table></div>
      <div class="btns" style="margin-top:14px"><button class="btn sm" id="fRecAvulso">${icon.plus}Recebimento avulso</button></div></div></div>`;
    $('#fRecAvulso').onclick = () => recebimentoAvulso(re);
  }
  if (aba === 'pagar') {
    B.innerHTML = `<div class="panel">${contas.length ? `<div class="tbl-wrap"><table><thead><tr><th>Vencimento</th><th>Conta</th><th>Categoria</th><th class="right">Valor</th><th class="right">Situação</th></tr></thead><tbody>${contas.map(c => {
      const late = !c.pago_em && c.vencimento < hoje, d = Math.round((new Date(c.vencimento) - new Date(hoje)) / 864e5);
      return `<tr class="click" data-c="${c.id}"><td class="num">${fd(c.vencimento)}${late ? '<div class="s bad-t">vencida</div>' : !c.pago_em && d <= 5 ? `<div class="s warn-t">vence em ${d} dia(s)</div>` : ''}</td><td>${esc(c.descricao)}${c.fornecedor ? `<div class="s">${esc(c.fornecedor)}</div>` : ''}${c.recorrente ? '<div class="s">mensal</div>' : ''}</td><td><span class="chip mute">${esc(c.categoria)}</span></td><td class="right num">${brl(c.valor, 2)}</td>
        <td class="right"><button class="btn sm${c.pago_em ? '' : ' gold'}" data-pg="${c.id}">${c.pago_em ? 'Pago ' + fd(c.pago_em).slice(0, 5) : 'Marcar pago'}</button></td></tr>`; }).join('')}</tbody></table></div>` : empty('Nenhuma conta neste mês', 'Use "Nova conta". Contas mensais se repetem sozinhas ao serem pagas.')}</div>`;
    B.onclick = async e => {
      const pg = e.target.closest('[data-pg]');
      if (pg) { e.stopPropagation(); const c = contas.find(x => x.id === pg.dataset.pg);
        try {
          await q(sb.from('contas').update({ pago_em: c.pago_em ? null : iso(new Date()) }).eq('id', c.id));
          if (!c.pago_em && c.recorrente) { const prox = iso(new Date(new Date(c.vencimento + 'T00:00').setMonth(new Date(c.vencimento + 'T00:00').getMonth() + 1)));
            const ja = await q(sb.from('contas').select('id').eq('descricao', c.descricao).eq('vencimento', prox));
            if (!ja.length) await q(sb.from('contas').insert({ descricao: c.descricao, categoria: c.categoria, fornecedor: c.fornecedor, valor: c.valor, vencimento: prox, recorrente: true })); }
          toast(c.pago_em ? 'Pagamento desfeito.' : 'Conta paga.'); re();
        } catch (err) { fail(err); } return; }
      const r = e.target.closest('[data-c]'); if (r) contaForm(contas.find(x => x.id === r.dataset.c), re);
    };
  }
  if (aba === 'receber') {
    const todas = await q(sb.from('recebimentos').select('*, pacientes(nome)').is('recebido_em', null).order('vencimento'));
    B.innerHTML = `<div class="panel">${todas.length ? `<div class="tbl-wrap"><table><thead><tr><th>Vencimento</th><th>Paciente</th><th>Parcela</th><th class="right">Valor</th><th class="right">Taxa</th><th></th></tr></thead><tbody>${todas.map(r => `<tr><td class="num">${fd(r.vencimento)}</td><td>${esc(r.pacientes?.nome || r.descricao || '')}<div class="s">${esc(r.forma || '')}</div></td><td class="num">${r.parcela}/${r.total_parcelas}</td><td class="right num">${brl(r.valor, 2)}</td><td class="right num muted">${brl(r.taxa, 2)}</td><td class="right"><button class="btn sm gold" data-rc="${r.id}">Recebido</button></td></tr>`).join('')}</tbody></table></div>
      <p class="hint" style="margin:12px 0 0">Todas as parcelas em aberto, de qualquer mês. Parcelas do cartão entram aqui quando o pagamento é registrado em Vendas.</p>` : empty('Nada a receber', 'Parcelas de cartão aparecem aqui quando o pagamento é registrado em Vendas.')}</div>`;
    B.onclick = async e => { const b = e.target.closest('[data-rc]'); if (!b) return; try { await q(sb.from('recebimentos').update({ recebido_em: iso(new Date()) }).eq('id', b.dataset.rc)); toast('Recebimento confirmado.'); re(); } catch (err) { fail(err); } };
  }
}

function contaForm(c = {}, re) {
  const novo = !c.id;
  const b = openSheet({ eyebrow: novo ? 'Contas a pagar' : c.pago_em ? 'Paga em ' + fd(c.pago_em) : 'Em aberto', title: novo ? 'Nova conta' : c.descricao, body: `<form class="panel stack" id="cf">
    <div class="fields f3">
      <label class="field w2"><span>Descrição *</span><input name="descricao" required value="${esc(c.descricao)}" placeholder="ex.: Aluguel da sala"></label>
      <label class="field"><span>Categoria</span><select name="categoria">${CATS.map(x => opt(x, null, c.categoria || 'Fixa')).join('')}</select></label>
      <label class="field"><span>Valor (R$) *</span><input name="valor" type="number" min="0" step="0.01" required value="${c.valor ?? ''}"></label>
      <label class="field"><span>Vencimento *</span><input name="vencimento" type="date" required value="${c.vencimento || iso(new Date())}"></label>
      <label class="field"><span>Fornecedor</span><input name="fornecedor" value="${esc(c.fornecedor)}"></label>
      ${novo ? `<label class="field"><span>Repetir</span><select name="repetir">${opt('1', 'Só este mês')}${opt('mensal', 'Todo mês (recorrente)')}${[2, 3, 4, 5, 6, 10, 12].map(n => opt(String(n), `Parcelar em ${n}x`)).join('')}</select></label>` : `<label class="check field"><input type="checkbox" name="recorrente" ${c.recorrente ? 'checked' : ''}> Conta mensal</label>`}
    </div>
    <div class="btns end">${novo ? '' : '<button type="button" class="btn danger" id="cDel">Excluir</button><span style="flex:1"></span>'}<button type="button" class="btn" data-x>Cancelar</button><button class="btn gold" id="cSave">Salvar</button></div></form>` });
  $('[data-x]', b).onclick = closeSheet;
  $('#cf', b).onsubmit = async e => {
    e.preventDefault(); const d = formData(e.target); if (!d.descricao || !d.valor) return toast('Preencha descrição e valor.', true);
    await busy($('#cSave', b), async () => {
      try {
        if (novo) {
          const rep = d.repetir; delete d.repetir;
          if (rep === 'mensal') await q(sb.from('contas').insert({ ...d, recorrente: true }));
          else { const n = Number(rep) || 1; const base = new Date(d.vencimento + 'T00:00');
            await q(sb.from('contas').insert([...Array(n)].map((_, i) => ({ ...d, descricao: n > 1 ? `${d.descricao} (${i + 1}/${n})` : d.descricao, valor: n > 1 ? Math.round(d.valor / n * 100) / 100 : d.valor, vencimento: iso(new Date(base.getFullYear(), base.getMonth() + i, base.getDate())) })))); }
        } else await q(sb.from('contas').update(d).eq('id', c.id));
        closeSheet(); toast('Conta salva.'); re();
      } catch (err) { fail(err); }
    });
  };
  if (!novo) $('#cDel', b).onclick = async () => { if (!(await confirmar('Excluir conta?', c.descricao, 'Excluir', true))) return; try { await q(sb.from('contas').delete().eq('id', c.id)); closeSheet(); toast('Conta excluída.'); re(); } catch (err) { fail(err); } };
}

function recebimentoAvulso(re) {
  const b = openSheet({ eyebrow: 'Entrada de dinheiro fora de uma venda', title: 'Recebimento avulso', body: `<form class="panel stack" id="ra"><div class="fields f3">
    <label class="field w2"><span>Descrição *</span><input name="descricao" required placeholder="ex.: Venda de protetor solar"></label>
    <label class="field"><span>Valor (R$) *</span><input name="valor" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Forma</span><select name="forma">${['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência'].map(x => opt(x)).join('')}</select></label>
    <label class="field"><span>Data</span><input name="data" type="date" value="${iso(new Date())}"></label></div>
    <div class="btns end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn gold">Salvar</button></div></form>` });
  $('[data-x]', b).onclick = closeSheet;
  $('#ra', b).onsubmit = async e => { e.preventDefault(); const d = formData(e.target); if (!d.descricao || !d.valor) return;
    try { await q(sb.from('recebimentos').insert({ descricao: d.descricao, valor: d.valor, forma: d.forma, vencimento: d.data, recebido_em: d.data })); closeSheet(); toast('Recebimento salvo.'); re(); } catch (err) { fail(err); } };
}
