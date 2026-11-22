// Ajustes: catálogo de procedimentos, dados da clínica, taxas, mensagens, segurança e cópia de segurança
import { sb, q, cache, loadRefs } from '../db.js?v=202611220013';
import { $, $$, esc, openSheet, closeSheet, toast, fail, opt, brl, empty, icon, busy, formData, iso } from '../ui.js?v=202611220013';

const UNIDADES = ['U', 'ml', 'frasco', 'seringa', 'sessão', 'área'];
const CATS = ['Injetável', 'Bioestimulador', 'Facial', 'Corporal', 'Capilar', 'Outro'];
const CAT_EST = ['', 'Toxina', 'Preenchedor', 'Bioestimulador', 'Skinbooster', 'Anestésico', 'Dermocosméticos', 'Outros'];
let aba = 'procedimentos';

export async function render(el) {
  await loadRefs(true);
  el.innerHTML = `<div class="head"><div><div class="eyebrow">Ajustes</div><h1>Catálogo e <em>clínica</em></h1></div></div>
    <div class="tabs">${[['procedimentos', 'Procedimentos e preços'], ['clinica', 'Dados da clínica'], ['mensagens', 'Mensagens de pós-venda'], ['seguranca', 'Segurança e cópia']].map(([k, v]) => `<button aria-pressed="${aba === k}" data-aba="${k}">${v}</button>`).join('')}</div><div id="ajBody"></div>`;
  $$('[data-aba]', el).forEach(b => b.onclick = () => { aba = b.dataset.aba; render(el); });
  const B = $('#ajBody'), re = () => render(el), c = cache.config;

  if (aba === 'procedimentos') {
    B.innerHTML = `<div class="panel"><div class="panel-h"><h2>Procedimentos</h2><button class="btn gold sm" id="pNovo">${icon.plus}Novo procedimento</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Procedimento</th><th>Preço</th><th>Efeito</th><th>Protocolo</th><th>Estoque</th><th></th></tr></thead><tbody>${cache.procs.map(p => `<tr class="click" data-p="${p.id}" style="${p.ativo ? '' : 'opacity:.5'}"><td><b style="font-weight:500">${esc(p.nome)}</b><div class="s">${esc(p.categoria)} · medido em ${esc(p.unidade)}</div></td><td class="num">${brl(p.preco, 2)}${p.modo_preco === 'por_unidade' ? ` <span class="s">por ${esc(p.unidade)}</span>` : ''}</td><td>${p.ciclo_dias ? p.ciclo_dias + ' dias' : '—'}${p.revisao_dias ? `<div class="s">revisão D+${p.revisao_dias}</div>` : ''}</td><td>${p.sessoes > 1 ? `${p.sessoes} sessões / ${p.intervalo_sessoes_dias || '?'} dias` : 'Sessão única'}</td><td>${esc(p.categoria_estoque || '—')}</td><td class="right">${p.ativo ? '' : '<span class="chip mute">inativo</span>'}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint" style="margin:12px 0 0">O <b>efeito</b> define quando a paciente entra no pós-venda para manutenção (10 dias antes). A <b>revisão</b> cria o contato de retorno. O <b>estoque</b> liga o procedimento aos lotes que saem na hora do atendimento.</p></div>`;
    $('#pNovo').onclick = () => procForm({}, re);
    B.onclick = e => { const r = e.target.closest('[data-p]'); if (r) procForm(cache.procs.find(p => p.id === r.dataset.p), re); };
  }

  if (aba === 'clinica') {
    B.innerHTML = `<form class="panel stack" id="cfg"><div class="fields">
      ${[['clinica', 'Nome da clínica', 'w2'], ['subtitulo', 'Subtítulo'], ['nome_curto', 'Como assina (ex.: Dra. Vanessa Amaral)'], ['profissional', 'Nome completo da profissional', 'w2'], ['registro', 'Nº de registro (CRBM)'], ['telefone', 'Telefone / WhatsApp'], ['endereco', 'Endereço', 'w2'], ['cidade', 'Cidade'], ['uf', 'UF'], ['cep', 'CEP']].map(([k, t, w]) => `<label class="field ${w || ''}"><span>${t}</span><input name="${k}" value="${esc(c[k])}"></label>`).join('')}
      </div><h3 style="margin-top:8px">Taxas da maquininha (%)</h3><div class="fields f3">
      <label class="field"><span>Débito</span><input name="taxa_debito" type="number" step="0.01" min="0" value="${c.taxa_debito ?? 0}"></label>
      <label class="field"><span>Crédito à vista</span><input name="taxa_credito_avista" type="number" step="0.01" min="0" value="${c.taxa_credito_avista ?? 0}"></label>
      <label class="field"><span>Crédito parcelado</span><input name="taxa_credito_parcelado" type="number" step="0.01" min="0" value="${c.taxa_credito_parcelado ?? 0}"></label></div>
      <p class="hint" style="margin:0">Estes dados aparecem nos termos, orçamentos e ordens de serviço. As taxas entram no cálculo do resultado do mês.</p>
      <div class="btns end"><button class="btn gold">Salvar</button></div></form>`;
    $('#cfg').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { await q(sb.from('config').update({ dados: { ...c, ...d }, atualizado_em: new Date().toISOString() }).eq('id', 1)); await loadRefs(true); toast('Dados da clínica salvos.'); } catch (err) { fail(err); } };
  }

  if (aba === 'mensagens') {
    const M = c.mensagens || {}; const T = { d1: 'Dia seguinte (D+1)', revisao: 'Revisão', sessao: 'Próxima sessão', manutencao: 'Manutenção', orcamento: 'Orçamento sem resposta', reativacao: 'Reativação', aniversario: 'Aniversário' };
    B.innerHTML = `<form class="panel stack" id="msgf"><p class="muted" style="margin:0">Use <b>{nome}</b> para o primeiro nome da paciente e <b>{procedimento}</b> para o procedimento. Dá para ajustar cada mensagem na hora de enviar.</p>
      ${Object.entries(T).map(([k, t]) => `<label class="field"><span>${t}</span><textarea name="${k}" rows="3">${esc(M[k])}</textarea></label>`).join('')}
      <div class="btns end"><button class="btn gold">Salvar mensagens</button></div></form>`;
    $('#msgf').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { await q(sb.from('config').update({ dados: { ...c, mensagens: { ...M, ...d } } }).eq('id', 1)); await loadRefs(true); toast('Mensagens salvas.'); } catch (err) { fail(err); } };
  }

  if (aba === 'seguranca') {
    const { data: { user } } = await sb.auth.getUser();
    B.innerHTML = `<div class="cols even">
      <form class="panel stack" id="pwf"><h2>Senha de acesso</h2><p class="muted small" style="margin:0">Conta: ${esc(user?.email)}</p>
        <label class="field"><span>Nova senha (mínimo 8 caracteres)</span><input type="password" name="pw" minlength="8" autocomplete="new-password" required></label>
        <div class="btns end"><button class="btn gold">Trocar senha</button></div></form>
      <div class="panel stack"><h2>Cópia de segurança</h2><p class="muted small" style="margin:0">O banco já faz backup diário automático. Aqui você baixa uma cópia própria de todos os registros (sem as fotos e PDFs) para guardar no seu computador.</p>
        <div class="btns"><button class="btn gold" id="bkp">${icon.dl}Baixar cópia completa</button></div>
        <p class="hint" style="margin:0">Guarde o arquivo em local seguro: ele contém dados de saúde das pacientes.</p></div></div>`;
    $('#pwf').onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: e.target.pw.value }); error ? fail(error) : (toast('Senha alterada.'), e.target.reset()); };
    $('#bkp').onclick = async e => busy(e.currentTarget, async () => {
      try {
        const tabs = ['config', 'procedimentos', 'pacientes', 'anamneses', 'produtos', 'lotes', 'movimentos', 'vendas', 'venda_itens', 'agendamentos', 'atendimentos', 'aplicacoes', 'fotos', 'documentos', 'recebimentos', 'contas', 'posvenda'];
        const out = { gerado_em: new Date().toISOString() };
        for (const t of tabs) { let all = [], from = 0; for (;;) { const part = await q(sb.from(t).select('*').range(from, from + 999)); all = all.concat(part); if (part.length < 1000) break; from += 1000; } out[t] = all; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })); a.download = `clinica-alpha-copia-${iso(new Date())}.json`; a.click();
        toast('Cópia baixada.');
      } catch (err) { fail(err); }
    });
  }
}

function procForm(p = {}, re) {
  const novo = !p.id;
  const b = openSheet({ eyebrow: novo ? 'Catálogo' : 'Editar procedimento', title: novo ? 'Novo procedimento' : p.nome, body: `<form class="panel stack" id="prf"><div class="fields">
    <label class="field w2"><span>Nome *</span><input name="nome" required value="${esc(p.nome)}"></label>
    <label class="field"><span>Categoria</span><select name="categoria">${CATS.map(x => opt(x, null, p.categoria || 'Injetável')).join('')}</select></label>
    <label class="field"><span>Medido em</span><select name="unidade">${UNIDADES.map(x => opt(x, null, p.unidade || 'sessão')).join('')}</select></label>
    <label class="field"><span>Cobrança</span><select name="modo_preco">${opt('fixo', 'Preço fechado', p.modo_preco)}${opt('por_unidade', 'Por unidade (U, ml…)', p.modo_preco)}</select></label>
    <label class="field"><span>Preço (R$)</span><input name="preco" type="number" min="0" step="0.01" value="${p.preco ?? ''}"></label>
    <label class="field"><span>Duração (min)</span><input name="duracao_min" type="number" min="15" step="15" value="${p.duracao_min ?? 60}"></label>
    <label class="field"><span>Efeito médio (dias)</span><input name="ciclo_dias" type="number" min="0" value="${p.ciclo_dias ?? ''}" placeholder="sem manutenção"></label>
    <label class="field"><span>Revisão (dias após)</span><input name="revisao_dias" type="number" min="0" value="${p.revisao_dias ?? ''}" placeholder="sem revisão"></label>
    <label class="field"><span>Sessões no protocolo</span><input name="sessoes" type="number" min="1" value="${p.sessoes ?? 1}"></label>
    <label class="field"><span>Intervalo entre sessões (dias)</span><input name="intervalo_sessoes_dias" type="number" min="0" value="${p.intervalo_sessoes_dias ?? ''}"></label>
    <label class="field"><span>Produto do estoque</span><select name="categoria_estoque">${CAT_EST.map(x => opt(x, x || 'Não usa estoque', p.categoria_estoque || '')).join('')}</select></label>
    <label class="field"><span>Termo sugerido</span><select name="termo">${opt('injetavel', 'Injetável', p.termo)}${opt('faciais', 'Tratamentos faciais', p.termo)}</select></label>
    <label class="field full"><span>Áreas (separadas por vírgula)</span><input name="areas" value="${esc((p.areas || []).join(', '))}" placeholder="Testa, Glabela, Pés de galinha"></label>
    ${novo ? '' : `<label class="check field full"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}> Procedimento ativo</label>`}
  </div><div class="btns end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn gold">Salvar</button></div></form>` });
  $('[data-x]', b).onclick = closeSheet;
  $('#prf', b).onsubmit = async e => {
    e.preventDefault(); const d = formData(e.target); if (!d.nome) return toast('Informe o nome.', true);
    d.areas = (d.areas || '').split(',').map(s => s.trim()).filter(Boolean); d.preco = d.preco || 0; d.sessoes = d.sessoes || 1; d.duracao_min = d.duracao_min || 60;
    try { if (novo) await q(sb.from('procedimentos').insert({ ...d, ordem: cache.procs.length + 1 })); else await q(sb.from('procedimentos').update(d).eq('id', p.id)); await loadRefs(true); closeSheet(); toast('Procedimento salvo.'); re(); } catch (err) { fail(err); }
  };
}
