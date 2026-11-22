// Avaliação: questionário de queixas, fotos marcadas ao vivo e plano de tratamento sugerido
import { sb, q, cache, procsAtivos, pacientesLeves, signedUrls, procById } from '../db.js?v=202611220031';
import { $, $$, esc, ini, fd, age, brl, nfmt, toast, fail, empty, icon, busy, first, confirmar, opt, iso, lightbox } from '../ui.js?v=202611220031';
import { capturarFoto, marcarFoto } from '../comp/camera.js?v=202611220031';
import { alertasAnamnese, formPaciente, seletorPaciente } from '../comp/paciente.js?v=202611220031';
import { elementoParaPDF, salvarPDF, abrirDocumento } from '../comp/documentos.js?v=202611220031';
import { abrirVenda } from './vendas.js?v=202611220031';

// ---------- catálogo de queixas ----------
// proc: palavra que identifica o procedimento no catálogo · q: quantidade sugerida [leve, moderado, intenso]
const QUEIXAS = [
  { g: 'Linhas de expressão', k: 'testa', t: 'Rugas na testa', s: 'Linhas horizontais ao levantar as sobrancelhas', r: [{ p: 'toxina', a: 'Testa', q: [8, 12, 16] }] },
  { g: 'Linhas de expressão', k: 'glabela', t: 'Ruga entre as sobrancelhas', s: 'Expressão de bravo ou cansada', r: [{ p: 'toxina', a: 'Glabela', q: [12, 18, 24] }] },
  { g: 'Linhas de expressão', k: 'pes', t: 'Pés de galinha', s: 'Linhas no canto dos olhos ao sorrir', r: [{ p: 'toxina', a: 'Pés de galinha', q: [12, 18, 24] }] },
  { g: 'Linhas de expressão', k: 'nariz_linhas', t: 'Linhas no nariz ao sorrir', s: '“Bunny lines”', r: [{ p: 'toxina', a: 'Nariz (bunny lines)', q: [4, 6, 8] }] },
  { g: 'Linhas de expressão', k: 'gengival', t: 'Mostra muita gengiva ao sorrir', s: 'Sorriso gengival', r: [{ p: 'toxina', a: 'Sorriso gengival', q: [2, 4, 4] }] },
  { g: 'Linhas de expressão', k: 'pescoco', t: 'Bandas no pescoço', s: 'Cordões verticais aparentes', r: [{ p: 'toxina', a: 'Platisma', q: [20, 30, 40] }] },
  { g: 'Volume e contorno', k: 'labios', t: 'Lábios finos ou sem contorno', s: 'Falta de volume, assimetria ou desidratação', r: [{ p: 'preench', a: 'Lábios', q: [0.5, 1, 1.5] }] },
  { g: 'Volume e contorno', k: 'olheiras', t: 'Olheiras profundas', s: 'Sulco abaixo dos olhos, aparência de cansaço', r: [{ p: 'preench', a: 'Olheiras', q: [0.5, 1, 1] }, { p: 'skinbooster', a: 'Olheiras', q: [1, 2, 3], opc: true }] },
  { g: 'Volume e contorno', k: 'malar', t: 'Perda de volume nas maçãs do rosto', s: 'Rosto mais “murcho” ou caído', r: [{ p: 'preench', a: 'Malar', q: [1, 1.5, 2] }] },
  { g: 'Volume e contorno', k: 'sulco', t: 'Bigode chinês marcado', s: 'Sulco nasogeniano', r: [{ p: 'preench', a: 'Sulco nasogeniano', q: [0.5, 1, 1.5] }, { p: 'bioestim', a: 'Terço médio', q: [1, 1, 2], opc: true }] },
  { g: 'Volume e contorno', k: 'mandibula', t: 'Contorno do rosto pouco definido', s: 'Mandíbula e queixo sem marcação', r: [{ p: 'preench', a: 'Mandíbula', q: [1, 2, 3] }] },
  { g: 'Volume e contorno', k: 'mento', t: 'Queixo pequeno ou para trás', s: 'Perfil desequilibrado', r: [{ p: 'preench', a: 'Mento', q: [0.5, 1, 1.5] }] },
  { g: 'Volume e contorno', k: 'nariz', t: 'Quer ajustar o nariz', s: 'Giba, ponta caída ou assimetria (rinomodelação)', r: [{ p: 'preench', a: 'Nariz (rinomodelação)', q: [0.3, 0.5, 1] }] },
  { g: 'Volume e contorno', k: 'masseter', t: 'Rosto quadrado ou bruxismo', s: 'Range ou aperta os dentes, masseter forte', r: [{ p: 'toxina', a: 'Masseter', q: [40, 50, 60] }] },
  { g: 'Volume e contorno', k: 'orelha', t: 'Lóbulo da orelha caído ou rasgado', s: 'Brinco pende, furo alargado', r: [{ p: 'otomodel', a: 'Lóbulos', q: [0.5, 1, 1] }] },
  { g: 'Firmeza da pele', k: 'flacidez', t: 'Flacidez no rosto', s: 'Pele menos firme, contorno caindo', r: [{ p: 'bioestim', a: 'Face completa', q: [1, 2, 3] }] },
  { g: 'Firmeza da pele', k: 'flac_pesc', t: 'Flacidez no pescoço ou colo', s: 'Pele fina e enrugada', r: [{ p: 'bioestim', a: 'Pescoço', q: [1, 2, 2] }, { p: 'skinbooster', a: 'Pescoço', q: [2, 3, 3], opc: true }] },
  { g: 'Qualidade da pele', k: 'vico', t: 'Pele sem viço ou desidratada', s: 'Opaca, sem brilho, linhas finas', r: [{ p: 'skinbooster', a: 'Face', q: [2, 3, 3] }] },
  { g: 'Qualidade da pele', k: 'poros', t: 'Poros dilatados e textura irregular', s: 'Pele áspera ao toque', r: [{ p: 'microagulh', a: 'Face', q: [2, 3, 4] }, { p: 'limpeza', a: 'Face', q: [1, 1, 2], opc: true }] },
  { g: 'Qualidade da pele', k: 'acne_cic', t: 'Cicatrizes de acne', s: 'Marcas e buraquinhos', r: [{ p: 'microagulh', a: 'Cicatrizes de acne', q: [3, 4, 5] }] },
  { g: 'Qualidade da pele', k: 'manchas', t: 'Manchas', s: 'Melasma, manchas de sol ou pós-acne', r: [{ p: 'microagulh', a: 'Face', q: [2, 3, 4] }] },
  { g: 'Qualidade da pele', k: 'oleosidade', t: 'Cravos, espinhas e oleosidade', s: 'Acne ativa ou poros obstruídos', r: [{ p: 'limpeza', a: 'Face', q: [1, 2, 3] }] },
  { g: 'Outros', k: 'axilas', t: 'Suor excessivo nas axilas', s: 'Hiperidrose', r: [{ p: 'toxina', a: 'Axilas', q: [50, 75, 100] }] },
];
const INT = ['Leve', 'Moderado', 'Intenso'];
const CONTEXTO = [
  { k: 'espelho', t: 'Quando se olha no espelho, o que mais incomoda?', tipo: 'texto' },
  { k: 'tempo', t: 'Há quanto tempo isso incomoda?', tipo: 'op', op: ['Menos de 6 meses', '6 meses a 2 anos', 'Mais de 2 anos'] },
  { k: 'ja_fez', t: 'Já fez algum procedimento para isso?', tipo: 'op', op: ['Não', 'Sim, gostou', 'Sim, não gostou'] },
  { k: 'ja_fez_d', t: 'Qual, quando e onde?', tipo: 'texto', se: r => r.ja_fez && r.ja_fez !== 'Não' },
  { k: 'resultado', t: 'Que resultado deseja?', tipo: 'op', op: ['Bem natural', 'Equilibrado', 'Mais evidente'] },
  { k: 'recuperacao', t: 'Pode ficar com inchaço ou roxo por alguns dias?', tipo: 'op', op: ['Não pode', 'Até 2 dias', 'Até 1 semana'] },
  { k: 'evento', t: 'Tem algum evento importante chegando?', tipo: 'data' },
  { k: 'investimento', t: 'Quanto pretende investir agora?', tipo: 'op', op: ['Até R$ 1.000', 'R$ 1.000 a R$ 3.000', 'R$ 3.000 a R$ 6.000', 'Acima de R$ 6.000', 'Quer ver o plano primeiro'] },
];
const ORCAMENTO_MAX = { 'Até R$ 1.000': 1000, 'R$ 1.000 a R$ 3.000': 3000, 'R$ 3.000 a R$ 6.000': 6000 };
const PASSOS = ['Paciente', 'Queixas', 'Conversa', 'Fotos', 'Plano'];

const acharProc = chave => procsAtivos().find(p => p.nome.toLowerCase().includes(chave));

// Monta o plano a partir das queixas
export function montarPlano(r) {
  const itens = {};
  (r.queixas || []).forEach(sel => {
    const Q = QUEIXAS.find(x => x.k === sel.k); if (!Q) return;
    Q.r.forEach(rec => {
      const p = acharProc(rec.p); if (!p) return;
      const it = itens[p.id] = itens[p.id] || { procedimento_id: p.id, queixas: [], areas: [], qtd: 0, prioridade: false, opcional: true, intensidade: 0 };
      if (!it.queixas.includes(Q.t)) it.queixas.push(Q.t);
      if (!it.areas.includes(rec.a)) it.areas.push(rec.a);
      it.qtd += rec.q[sel.i ?? 1];
      it.prioridade = it.prioridade || !!sel.top;
      if (!rec.opc) it.opcional = false;
      it.intensidade = Math.max(it.intensidade, sel.i ?? 1);
    });
  });
  return Object.values(itens).map(it => {
    const p = procById(it.procedimento_id);
    if (p.unidade === 'U' || p.unidade === 'ml') it.qtd = Math.round(it.qtd * 10) / 10;
    if (p.sessoes > 1 && ['sessão'].includes(p.unidade)) it.qtd = Math.max(it.qtd, p.sessoes);
    it.valor = valorItem(p, it.qtd);
    it.incluir = !it.opcional;
    it.fase = it.prioridade || (!it.opcional && it.intensidade === 2) ? 1 : 2;
    return it;
  }).sort((a, b) => a.fase - b.fase || b.valor - a.valor);
}
export function valorItem(p, qtd) {
  if (p.modo_preco === 'por_unidade') return Math.round(Number(p.preco) * qtd * 100) / 100;
  if (['sessão', 'frasco', 'seringa'].includes(p.unidade)) return Number(p.preco) * Math.max(1, Math.round(qtd));
  return Number(p.preco);
}
const qtdTxt = (p, q) => `${nfmt(q)} ${p.unidade === 'sessão' ? (q > 1 ? 'sessões' : 'sessão') : p.unidade === 'frasco' ? (q > 1 ? 'frascos' : 'frasco') : p.unidade === 'seringa' ? (q > 1 ? 'seringas' : 'seringa') : p.unidade}`;

// ---------- estado da avaliação em andamento ----------
let A = null; // { id, paciente, respostas, plano, marcacoes, fotos:[...], passo }

export async function render(el, params) {
  const [a, b] = params;
  if (a === 'nova') { await nova(el, b); return; }
  if (a) { await carregar(a); return passo(el); }
  return lista(el);
}

async function lista(el) {
  const avs = await q(sb.from('avaliacoes').select('id,criado_em,respostas,plano,venda_id,pacientes(id,nome)').order('criado_em', { ascending: false }).limit(60));
  el.innerHTML = `<div class="head"><div><div class="eyebrow">Consulta de avaliação</div><h1>Avaliação</h1><p class="sub">Converse com a paciente seguindo o roteiro, fotografe e marque os pontos na hora, e saia com o plano de tratamento e o orçamento prontos.</p></div><a class="btn gold" href="#/avaliacao/nova">${icon.plus}Nova avaliação</a></div>
    <div class="panel">${avs.length ? `<div class="list">${avs.map(v => { const t = (v.plano?.itens || []).filter(i => i.incluir).reduce((s, i) => s + Number(i.valor), 0);
      return `<a class="row click" href="#/avaliacao/${v.id}" style="text-decoration:none;color:inherit"><span class="avatar">${esc(ini(v.pacientes?.nome))}</span><div class="grow"><div class="t">${esc(v.pacientes?.nome)}</div><div class="s">${fd(v.criado_em)} · ${(v.respostas?.queixas || []).length} queixa(s)${t ? ' · plano de ' + brl(t) : ''}</div></div>${v.venda_id ? '<span class="chip ok">Orçamento gerado</span>' : v.plano?.itens ? '<span class="chip">Plano pronto</span>' : '<span class="chip mute">Em andamento</span>'}</a>`; }).join('')}</div>` : empty('Nenhuma avaliação ainda', 'Toque em "Nova avaliação" para começar a primeira.')}</div>`;
}

async function nova(el, pid) {
  A = { id: null, paciente: null, respostas: { queixas: [] }, plano: {}, marcacoes: [], fotos: [], passo: 0 };
  if (pid) { A.paciente = await q(sb.from('pacientes').select('*').eq('id', pid).single()); A.passo = 1; await criar(); history.replaceState(null, '', '#/avaliacao/' + A.id); }
  passo(el);
}
async function carregar(id) {
  if (A?.id === id) return;
  const v = await q(sb.from('avaliacoes').select('*, pacientes(*)').eq('id', id).single());
  const fotos = await q(sb.from('fotos').select('*').eq('avaliacao_id', id).order('criado_em'));
  A = { id, paciente: v.pacientes, respostas: v.respostas || { queixas: [] }, plano: v.plano || {}, marcacoes: v.marcacoes || [], fotos, passo: v.plano?.itens ? 4 : (v.respostas?.queixas?.length ? 2 : 1), venda_id: v.venda_id };
}
async function criar() {
  const v = await q(sb.from('avaliacoes').insert({ paciente_id: A.paciente.id, respostas: A.respostas }).select().single());
  A.id = v.id;
}
async function salvar() {
  if (!A.id) return;
  await q(sb.from('avaliacoes').update({ respostas: A.respostas, plano: A.plano, marcacoes: A.marcacoes }).eq('id', A.id));
}

function cabecalho() {
  const p = A.paciente;
  return `<div class="head"><div><div class="eyebrow">Avaliação${A.id ? ' · salva automaticamente' : ''}</div><h1>${p ? esc(p.nome.split(' ').slice(0, 2).join(' ')) : 'Nova <em>avaliação</em>'}</h1>${p ? `<p class="sub">${[age(p.nascimento) != null ? age(p.nascimento) + ' anos' : null, p.telefone].filter(Boolean).join(' · ')}</p>` : ''}</div>
    <div class="btns"><a class="btn" href="#/avaliacao">Avaliações</a>${p ? `<a class="btn" href="#/pacientes/${p.id}">Prontuário</a>` : ''}</div></div>
    <nav class="steps" aria-label="Etapas">${PASSOS.map((t, i) => `<button data-passo="${i}" ${i === A.passo ? 'aria-current="step"' : ''} class="${i < A.passo ? 'feito' : ''}" ${!A.paciente && i > 0 ? 'disabled' : ''}><b>${i + 1}</b>${t}</button>`).join('')}</nav>`;
}
const rodape = (voltar = true, proximo = 'Próximo', extra = '') => `<div class="btns end" style="margin-top:18px">${extra}${voltar ? '<button class="btn" data-nav="-1">Voltar</button>' : ''}${proximo ? `<button class="btn gold" data-nav="1">${proximo}</button>` : ''}</div>`;

async function passo(el) {
  el.innerHTML = cabecalho() + '<div id="avBody"></div>';
  const B = $('#avBody', el);
  const ir = async n => { try { await salvar(); } catch (e) { fail(e); } A.passo = Math.max(0, Math.min(4, n)); if (A.passo === 4 && !A.plano?.itens) gerarPlano(); window.scrollTo(0, 0); passo(el); };
  $$('[data-passo]', el).forEach(b => b.onclick = () => ir(Number(b.dataset.passo)));
  el.onclick = e => { const n = e.target.closest('[data-nav]'); if (n) ir(A.passo + Number(n.dataset.nav)); };
  ({ 0: passoPaciente, 1: passoQueixas, 2: passoConversa, 3: passoFotos, 4: passoPlano })[A.passo](B, el, ir);
}

// 1 · paciente
async function passoPaciente(B, el, ir) {
  const pacs = await pacientesLeves();
  B.innerHTML = `<div class="panel stack"><h2>Quem está sendo avaliada?</h2>
    <div class="field"><span>Paciente</span><div style="display:flex;gap:8px">${seletorPaciente(pacs, A.paciente?.id)}<button class="btn" id="avNovaPac">${icon.plus}Nova paciente</button></div></div>
    <p class="hint" style="margin:0">Se for a primeira vez dela na clínica, cadastre com nome e WhatsApp. O restante pode ser completado depois.</p></div>
    ${rodape(false, 'Começar avaliação')}`;
  $('#avNovaPac', B).onclick = () => formPaciente({}, async p => { A.paciente = p; await criar(); A.passo = 1; history.replaceState(null, '', '#/avaliacao/' + A.id); passo(el); });
  B.querySelector('[data-nav="1"]').onclick = async e => {
    e.stopPropagation(); const id = $('[name=paciente_id]', B).value; if (!id) { toast('Escolha a paciente.', true); return; }
    try { A.paciente = await q(sb.from('pacientes').select('*').eq('id', id).single()); if (!A.id) await criar(); else await salvar(); history.replaceState(null, '', '#/avaliacao/' + A.id); A.passo = 1; passo(el); } catch (err) { fail(err); }
  };
}

// 2 · queixas
async function passoQueixas(B) {
  if (!A._anam) A._anam = await q(sb.from('anamneses').select('respostas').eq('paciente_id', A.paciente.id).order('criado_em', { ascending: false }).limit(1));
  const anam = A._anam, alertas = alertasAnamnese(anam[0]?.respostas);
  const grupos = [...new Set(QUEIXAS.map(x => x.g))];
  const sel = k => A.respostas.queixas.find(x => x.k === k);
  B.innerHTML = `${alertas.length ? `<div class="alert" style="margin-bottom:14px"><b>Anamnese</b><span>${alertas.map(esc).join(' · ')}</span></div>` : !anam.length ? '<div class="alert gold" style="margin-bottom:14px"><b>Anamnese</b><span>Esta paciente ainda não tem anamnese. Preencha no prontuário antes de qualquer procedimento.</span></div>' : ''}
    <div class="panel"><div class="panel-h"><h2>O que incomoda?</h2><span class="hint">Toque em tudo que ela citar, marque a intensidade e a ★ no que mais incomoda.</span></div>
    ${grupos.map(g => `<div class="qz-grupo"><h3>${g}</h3><div class="qz-lista">${QUEIXAS.filter(x => x.g === g).map(x => { const s = sel(x.k); return `<div class="qz${s ? ' on' : ''}" data-k="${x.k}" role="button" tabindex="0" aria-pressed="${!!s}"><span class="t">${esc(x.t)}</span><span class="s">${esc(x.s)}</span>
      <span class="int">${INT.map((t, i) => `<button type="button" data-i="${i}" aria-pressed="${(s?.i ?? 1) === i}">${t}</button>`).join('')}</span>${s ? `<button type="button" class="star${s.top ? ' on' : ''}" data-top>★ ${s.top ? 'O que mais incomoda' : 'Marcar como o que mais incomoda'}</button>` : ''}</div>`; }).join('')}</div></div>`).join('')}
    <label class="field"><span>Outra queixa (descreva)</span><input id="avOutra" value="${esc(A.respostas.outra || '')}" placeholder="ex.: assimetria nas sobrancelhas"></label></div>
    ${rodape(true, 'Próximo')}`;
  $('#avOutra', B).oninput = e => A.respostas.outra = e.target.value;
  B.querySelector('.panel').addEventListener('click', e => {
    const card = e.target.closest('.qz'); if (!card) return; const k = card.dataset.k;
    const i = e.target.closest('[data-i]'), top = e.target.closest('[data-top]');
    let s = sel(k);
    if (i && s) { s.i = Number(i.dataset.i); }
    else if (top && s) { s.top = !s.top; }
    else if (!i && !top) { if (s) A.respostas.queixas = A.respostas.queixas.filter(x => x.k !== k); else A.respostas.queixas.push({ k, i: 1, top: false }); }
    A.plano = {}; // queixas mudaram: refaz o plano
    passoQueixas(B);
  });
}

// 3 · conversa
function passoConversa(B) {
  const r = A.respostas;
  const campo = c => {
    if (c.se && !c.se(r)) return '';
    if (c.tipo === 'texto') return `<label class="field full"><span>${c.t}</span><textarea data-k="${c.k}" rows="2">${esc(r[c.k] || '')}</textarea></label>`;
    if (c.tipo === 'data') return `<label class="field"><span>${c.t}</span><input type="date" data-k="${c.k}" value="${esc(r[c.k] || '')}"></label>`;
    return `<div class="field full"><span>${c.t}</span><div class="tabs" style="margin:0">${c.op.map(o => `<button type="button" data-op="${c.k}" aria-pressed="${r[c.k] === o}">${esc(o)}</button>`).join('')}</div></div>`;
  };
  B.innerHTML = `<div class="panel"><div class="panel-h"><h2>Conversa</h2><span class="hint">Estas respostas ajustam o plano: prazo, intensidade e quanto cabe no investimento.</span></div><div class="fields f2">${CONTEXTO.map(campo).join('')}
    <label class="field full"><span>Anotações da profissional</span><textarea data-k="notas" rows="3">${esc(r.notas || '')}</textarea></label></div></div>${rodape(true, 'Próximo · fotos')}`;
  B.oninput = e => { const k = e.target.dataset.k; if (k) r[k] = e.target.value; };
  B.querySelector('.fields').addEventListener('click', e => { const b = e.target.closest('[data-op]'); if (!b) return; r[b.dataset.op] = b.textContent; if (b.dataset.op === 'ja_fez') return passoConversa(B); $$(`[data-op="${b.dataset.op}"]`, B).forEach(x => x.setAttribute('aria-pressed', x === b)); });
}

// 4 · fotos
async function passoFotos(B, el) {
  const paths = A.fotos.map(f => f.caminho);
  const urls = paths.length ? await signedUrls('fotos', paths) : {};
  B.innerHTML = `<div class="panel stack"><div class="panel-h"><h2>Fotos da avaliação</h2><span class="hint">Abra a câmera virada para a paciente: ela se vê na tela enquanto você mostra o que pode melhorar.</span></div>
    <div class="btns"><button class="btn gold" id="avCam">${icon.cam}Abrir câmera</button></div>
    ${A.fotos.length ? `<div class="ft-av">${A.fotos.map((f, i) => `<figure><img src="${urls[f.caminho]}" alt="Foto ${i + 1}" data-ver="${i}"><figcaption><span>Foto ${i + 1}${(A.marcacoes.find(m => m.foto_id === f.id)?.pontos || []).length ? ` · ${A.marcacoes.find(m => m.foto_id === f.id).pontos.length} ponto(s)` : ''}</span><span class="btns"><button class="btn sm" data-marcar="${i}">Marcar</button><button class="btn sm icon" data-del="${i}" aria-label="Apagar foto">×</button></span></figcaption></figure>`).join('')}</div>` : '<p class="muted" style="margin:0">Nenhuma foto ainda. Frente, perfis e 45° ajudam a mostrar o resultado esperado.</p>'}
    </div>${rodape(true, 'Ver o plano')}`;
  const salvarFoto = async (res, substituir) => {
    const path = `${A.paciente.id}/av-${crypto.randomUUID()}.jpg`; const pathO = `${A.paciente.id}/av-${crypto.randomUUID()}-orig.jpg`;
    const up = async (p, blob) => { const { error } = await sb.storage.from('fotos').upload(p, blob, { contentType: 'image/jpeg' }); if (error) throw error; };
    await up(path, res.blob); if (res.marcou) await up(pathO, res.original);
    let foto;
    if (substituir) { foto = await q(sb.from('fotos').update({ caminho: path, original_caminho: res.marcou ? (substituir.original_caminho || pathO) : substituir.original_caminho }).eq('id', substituir.id).select().single()); A.fotos[A.fotos.indexOf(substituir)] = foto; }
    else { foto = await q(sb.from('fotos').insert({ paciente_id: A.paciente.id, avaliacao_id: A.id, momento: 'avaliacao', angulo: 'Avaliação', caminho: path, original_caminho: res.marcou ? pathO : null, tirada_em: iso(new Date()) }).select().single()); A.fotos.push(foto); }
    A.marcacoes = A.marcacoes.filter(m => m.foto_id !== foto.id).concat(res.pontos.length ? [{ foto_id: foto.id, pontos: res.pontos }] : []);
    await salvar();
  };
  $('#avCam', B).onclick = async () => {
    const blob = await capturarFoto(); if (!blob) return;
    const res = await marcarFoto(blob, { titulo: 'Marque o que vamos melhorar' }); if (!res) return;
    try { toast('Salvando foto…'); await salvarFoto(res); toast('Foto salva na avaliação.'); passoFotos(B, el); } catch (e) { fail(e); }
  };
  B.querySelector('.panel').addEventListener('click', async e => {
    const v = e.target.closest('[data-ver]'), m = e.target.closest('[data-marcar]'), d = e.target.closest('[data-del]');
    if (v) lightbox(urls[A.fotos[+v.dataset.ver].caminho]);
    if (m) {
      const f = A.fotos[+m.dataset.marcar]; const base = f.original_caminho || f.caminho;
      const u = (await signedUrls('fotos', [base]))[base];
      const pts = A.marcacoes.find(x => x.foto_id === f.id)?.pontos || [];
      const res = await marcarFoto(u, { pontos: f.original_caminho ? pts : [], titulo: 'Marque o que vamos melhorar' }); if (!res) return;
      if (!f.original_caminho) { res.marcou = true; }
      try { await salvarFoto(res, f); toast('Marcação atualizada.'); passoFotos(B, el); } catch (err) { fail(err); }
    }
    if (d) { const f = A.fotos[+d.dataset.del]; if (!(await confirmar('Apagar esta foto?', 'Ela sai da avaliação e do prontuário.', 'Apagar', true))) return;
      try { await q(sb.from('fotos').delete().eq('id', f.id)); A.fotos.splice(+d.dataset.del, 1); A.marcacoes = A.marcacoes.filter(x => x.foto_id !== f.id); await salvar(); passoFotos(B, el); } catch (err) { fail(err); } }
  });
}


// ---------- condições de pagamento ----------
let pgAberto = false;
const FORMAS_PG = ['Pix', 'Dinheiro', 'Cartão à vista', 'Cartão parcelado'];
const pgPadrao = () => ({ escopo: 'tudo', forma: 'Pix', parcelas: 3, desc_pct: 0, max_parc: 12 });
const baseValor = (itens, escopo) => itens.filter(i => i.incluir && (escopo !== 'fase1' || i.fase === 1)).reduce((s, i) => s + Number(i.valor), 0);
export function calcPag(base, P) {
  const avista = P.forma === 'Pix' || P.forma === 'Dinheiro';
  const desconto = avista ? Math.round(base * (Number(P.desc_pct) || 0)) / 100 : 0;
  const total = Math.round((base - desconto) * 100) / 100;
  const n = P.forma === 'Cartão parcelado' ? Math.max(2, Number(P.parcelas) || 2) : 1;
  const parcela = Math.round(total / n * 100) / 100;
  const texto = P.forma === 'Cartão parcelado' ? `Cartão de crédito em ${n}x de ${brl(parcela, 2)} sem juros` : P.forma === 'Cartão à vista' ? `Cartão de crédito à vista · ${brl(total, 2)}` : `${P.forma} · ${brl(total, 2)}${desconto ? ` (${nfmt(P.desc_pct)}% de desconto)` : ''}`;
  return { total, desconto, n, parcela, texto };
}
function pagamentoHtml(itens, P) {
  const base = baseValor(itens, P.escopo), c = calcPag(base, P);
  const temFase2 = itens.some(i => i.incluir && i.fase === 2);
  const linhaOp = (forma, parc, rot, val, extra = '') => { const on = P.forma === forma && (forma !== 'Cartão parcelado' || Number(P.parcelas) === parc);
    return `<tr class="click${on ? ' pg-on' : ''}" data-pgsel="${forma}" data-pgn="${parc || ''}"><td>${rot}</td><td class="right num">${val}</td><td class="right small muted">${extra}</td></tr>`; };
  const pix = calcPag(base, { ...P, forma: 'Pix' });
  const parcs = []; for (let n = 2; n <= (P.max_parc || 12); n++) parcs.push(n);
  return `<div class="panel" style="margin-top:16px" id="avPag"><div class="panel-h"><h2>Pagamento</h2><span class="hint">Como a paciente prefere pagar</span></div>
    <div class="stack">
      ${temFase2 ? `<div class="field"><span>Valor considerado</span><div class="tabs" style="margin:0"><button type="button" data-pgesc="tudo" aria-pressed="${P.escopo !== 'fase1'}">Plano completo · ${brl(baseValor(itens, 'tudo'))}</button><button type="button" data-pgesc="fase1" aria-pressed="${P.escopo === 'fase1'}">Só a fase 1 · ${brl(baseValor(itens, 'fase1'))}</button></div></div>` : ''}
      <div class="field"><span>Forma de pagamento</span><div class="tabs" style="margin:0">${FORMAS_PG.map(f => `<button type="button" data-pgforma="${f}" aria-pressed="${P.forma === f}">${f}</button>`).join('')}</div></div>
      <div class="fields f3">
        ${P.forma === 'Cartão parcelado' ? `<label class="field"><span>Parcelas</span><select data-pgparc>${parcs.map(n => opt(n, `${n}x de ${brl(calcPag(base, { ...P, parcelas: n }).parcela, 2)}`, P.parcelas)).join('')}</select></label>` : ''}
        ${P.forma === 'Pix' || P.forma === 'Dinheiro' ? `<label class="field"><span>Desconto no ${P.forma.toLowerCase()} (%)</span><input type="number" min="0" max="50" step="0.5" data-pgdesc value="${P.desc_pct || 0}"></label>` : ''}
        <div class="field"><span>Condição escolhida</span><div class="gold-t" style="min-height:44px;display:flex;align-items:center;font-size:15px">${esc(c.texto)}</div></div>
      </div>
      <details id="pgDet"${pgAberto ? ' open' : ''}><summary class="muted small" style="cursor:pointer;margin-bottom:8px">Ver todas as opções para mostrar à paciente</summary>
        <div class="tbl-wrap"><table class="pg-tab"><tbody>
          ${linhaOp('Pix', 0, `Pix ou dinheiro${P.desc_pct ? ` · ${nfmt(P.desc_pct)}% de desconto` : ''}`, brl(pix.total, 2), pix.desconto ? `economia de ${brl(pix.desconto, 2)}` : '')}
          ${linhaOp('Cartão à vista', 0, 'Cartão de crédito à vista', brl(base, 2))}
          ${parcs.map(n => linhaOp('Cartão parcelado', n, `Cartão em ${n}x sem juros`, `${n}x de ${brl(Math.round(base / n * 100) / 100, 2)}`, `total ${brl(base, 2)}`)).join('')}
        </tbody></table></div></details>
    </div></div>`;
}

// 5 · plano
function gerarPlano() { A.plano = { itens: montarPlano(A.respostas), observacoes: A.plano?.observacoes || '' }; }

function passoPlano(B, el) {
  if (!A.plano?.itens) gerarPlano();
  const itens = A.plano.itens, r = A.respostas;
  if (!A.plano.pagamento) A.plano.pagamento = pgPadrao();
  const P = A.plano.pagamento;
  const tot = f => itens.filter(i => i.incluir && (f == null || i.fase === f)).reduce((s, i) => s + Number(i.valor), 0);
  const teto = ORCAMENTO_MAX[r.investimento];
  const evento = r.evento ? Math.round((new Date(r.evento + 'T00:00') - new Date()) / 864e5) : null;
  const linha = (it, k) => { const p = procById(it.procedimento_id); if (!p) return '';
    return `<div class="plano-item${it.incluir ? '' : ' off'}"><input type="checkbox" class="chk" data-inc="${k}" ${it.incluir ? 'checked' : ''} aria-label="Incluir ${esc(p.nome)}">
      <div><div class="nome">${esc(p.nome)}${it.opcional ? ' <span class="chip mute" style="font-family:var(--body);vertical-align:middle">complementar</span>' : ''}</div>
        <div class="por">Para: ${it.queixas.map(esc).join(' · ')}</div>
        <div class="det"><span class="chip mute">${it.areas.map(esc).join(', ')}</span>
          <label class="chip" style="gap:6px">≈ <input type="number" step="${p.unidade === 'U' ? 1 : p.unidade === 'ml' ? 0.1 : 1}" min="0" value="${it.qtd}" data-qtd="${k}" style="width:64px;background:transparent;border:0;border-bottom:1px solid var(--line);color:inherit;font:inherit;text-align:center" aria-label="Quantidade"> ${esc(qtdTxt(p, it.qtd).replace(/^[\d.,]+ /, ''))}</label>
          ${p.ciclo_dias ? `<span class="chip mute">efeito ~${Math.round(p.ciclo_dias / 30)} meses</span>` : ''}${p.sessoes > 1 ? `<span class="chip mute">${p.sessoes} sessões a cada ${p.intervalo_sessoes_dias} dias</span>` : ''}
          <span class="chip mute" style="gap:4px">Fase <select data-fase="${k}" style="background:transparent;border:0;color:inherit;font:inherit">${opt(1, '1', it.fase)}${opt(2, '2', it.fase)}</select></span></div></div>
      <div class="val num"><input type="number" min="0" step="10" value="${it.valor}" data-val="${k}" style="width:110px;background:transparent;border:0;border-bottom:1px solid var(--line);color:inherit;font:inherit;text-align:right" aria-label="Valor"></div></div>`; };
  const fase = f => { const l = itens.map((it, k) => ({ it, k })).filter(x => x.it.fase === f); return l.length ? `<div class="fase-h"><b>Fase ${f}</b><span class="muted small">${f === 1 ? 'Prioridade: o que mais incomoda' : 'Complementar: para potencializar e manter'}</span><span style="flex:1"></span><span class="num gold-t">${brl(tot(f))}</span></div>${l.map(x => linha(x.it, x.k)).join('')}` : ''; };
  B.innerHTML = `${!itens.length ? `<div class="panel">${empty('Nenhuma queixa selecionada', 'Volte à etapa 2 e marque o que incomoda a paciente.')}</div>` : `
    <div class="kpis">
      <div class="kpi lead"><h3>Plano completo</h3><div class="v num">${brl(tot())}</div><div class="d">${itens.filter(i => i.incluir).length} procedimento(s)</div></div>
      <div class="kpi"><h3>Fase 1</h3><div class="v num">${brl(tot(1))}</div><div class="d">prioridade</div></div>
      <div class="kpi"><h3>Investimento citado</h3><div class="v" style="font-size:20px">${esc(r.investimento || '—')}</div><div class="d">${teto ? (tot(1) <= teto ? '<span class="ok-t">A fase 1 cabe no valor</span>' : '<span class="warn-t">Fase 1 acima do valor: priorize ou parcele</span>') : ''}</div></div>
      <div class="kpi"><h3>Evento</h3><div class="v" style="font-size:20px">${evento != null ? (evento >= 0 ? `em ${evento} dias` : 'já passou') : '—'}</div><div class="d">${evento != null && evento >= 0 && evento < 21 ? '<span class="warn-t">Injetáveis pedem 15 a 21 dias para o resultado final</span>' : r.recuperacao === 'Não pode' ? '<span class="warn-t">Sem tempo de recuperação: prefira técnicas com menos roxo</span>' : ''}</div></div>
    </div>
    <div class="panel">${fase(1)}${fase(2)}
      <label class="field" style="margin-top:18px"><span>Observações para a paciente</span><textarea id="avObs" rows="3" placeholder="ex.: começar pela toxina e voltar em 15 dias para o preenchimento">${esc(A.plano.observacoes || '')}</textarea></label>
      <p class="hint" style="margin:10px 0 0">Sugestão montada a partir das queixas e da tabela de preços. Ajuste quantidades, valores e fases conforme sua avaliação clínica.</p></div>
    ${pagamentoHtml(itens, A.plano.pagamento)}
    <div class="btns end" style="margin-top:18px"><button class="btn" data-nav="-1">Voltar</button><button class="btn" id="avRefazer">Refazer sugestão</button><button class="btn" id="avPdf">${icon.doc}PDF para a paciente</button><button class="btn" id="avShow">Apresentar para a paciente</button>${A.venda_id ? `<button class="btn gold" id="avVerOrc">Ver orçamento</button>` : `<button class="btn gold" id="avOrc">Gerar orçamento</button>`}</div>`}
    <div id="avPaperWrap" style="position:fixed;left:-10000px;top:0;width:794px"></div>`;
  if (!itens.length) { B.querySelector('[data-nav]')?.remove(); B.innerHTML += rodape(true, ''); return; }
  const re = () => { salvar().catch(fail); passoPlano(B, el); };
  const det = $('#pgDet', B); if (det) det.ontoggle = () => { pgAberto = det.open; };
  B.onclick = e => {
    const f = e.target.closest('[data-pgforma]'), es = e.target.closest('[data-pgesc]'), sel = e.target.closest('[data-pgsel]');
    if (f) P.forma = f.dataset.pgforma;
    else if (es) P.escopo = es.dataset.pgesc;
    else if (sel) { P.forma = sel.dataset.pgsel; if (sel.dataset.pgn) P.parcelas = Number(sel.dataset.pgn); }
    else return;
    re();
  };
  B.onchange = e => {
    if (e.target.matches('[data-pgparc]')) { P.parcelas = Number(e.target.value); return re(); }
    if (e.target.matches('[data-pgdesc]')) { P.desc_pct = Math.max(0, Math.min(50, Number(e.target.value) || 0)); return re(); }
    const t = e.target, k = Number(t.dataset.inc ?? t.dataset.qtd ?? t.dataset.val ?? t.dataset.fase); if (isNaN(k)) return; const it = itens[k];
    if (t.dataset.inc != null) it.incluir = t.checked;
    if (t.dataset.qtd != null) { it.qtd = Number(t.value) || 0; it.valor = valorItem(procById(it.procedimento_id), it.qtd); }
    if (t.dataset.val != null) it.valor = Number(t.value) || 0;
    if (t.dataset.fase != null) it.fase = Number(t.value);
    re();
  };
  $('#avObs', B).oninput = e => { A.plano.observacoes = e.target.value; clearTimeout(passoPlano.t); passoPlano.t = setTimeout(() => salvar().catch(fail), 800); };
  $('#avRefazer', B).onclick = async () => { if (await confirmar('Refazer a sugestão?', 'As quantidades, valores e fases que você ajustou voltam para a sugestão automática.', 'Refazer')) { gerarPlano(); re(); } };
  $('#avShow', B).onclick = () => apresentar();
  $('#avPdf', B).onclick = async e => busy(e.currentTarget, async () => { try { const blob = await pdfPlano(B); const d = await salvarPDF({ paciente_id: A.paciente.id, tipo: 'avaliacao', titulo: 'Plano de tratamento · avaliação ' + fd(new Date()), blob }); abrirDocumento(d.pdf_caminho); toast('PDF salvo nos documentos da paciente.'); } catch (err) { fail(err); } });
  const orc = $('#avOrc', B);
  if (orc) orc.onclick = async e => busy(e.currentTarget, async () => {
    const inc = itens.filter(i => i.incluir && (P.escopo !== 'fase1' || i.fase === 1)); if (!inc.length) { toast('Inclua pelo menos um procedimento.', true); return; }
    const cp = calcPag(baseValor(itens, P.escopo), P);
    try {
      const v = await q(sb.from('vendas').insert({ paciente_id: A.paciente.id, origem: 'orcamento', status: 'orcamento', forma_pagamento: P.forma.startsWith('Cartão') ? 'Cartão de crédito' : P.forma, parcelas: cp.n, desconto: cp.desconto, validade: iso(new Date(Date.now() + 15 * 864e5)), observacoes: A.plano.observacoes || null }).select().single());
      await q(sb.from('venda_itens').insert(inc.map(i => { const p = procById(i.procedimento_id); const porUn = p.modo_preco === 'por_unidade'; const qtd = porUn || ['sessão', 'frasco', 'seringa'].includes(p.unidade) ? Math.max(porUn ? i.qtd : 1, porUn ? 0.1 : Math.round(i.qtd)) : 1;
        return { venda_id: v.id, procedimento_id: p.id, descricao: `${p.nome} · ${i.areas.join(', ')}`, quantidade: qtd, preco_unit: Math.round(i.valor / qtd * 100) / 100 }; })));
      await q(sb.from('avaliacoes').update({ venda_id: v.id }).eq('id', A.id)); A.venda_id = v.id;
      toast('Orçamento gerado a partir da avaliação.'); passoPlano(B, el); abrirVenda(v.id);
    } catch (err) { fail(err); }
  });
  const vo = $('#avVerOrc', B); if (vo) vo.onclick = () => abrirVenda(A.venda_id);
}

async function pdfPlano(B) {
  const c = cache.config, itens = A.plano.itens.filter(i => i.incluir);
  const urls = A.fotos.length ? await signedUrls('fotos', A.fotos.map(f => f.caminho)) : {};
  // as fotos precisam virar data URL para entrar no PDF
  const toData = async u => { try { const b = await (await fetch(u)).blob(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch { return null; } };
  const imgs = []; for (const f of A.fotos.slice(0, 4)) imgs.push({ f, src: await toData(urls[f.caminho]) });
  const pts = A.marcacoes.flatMap(m => m.pontos.filter(p => p.texto).map(p => ({ ...p, foto: A.fotos.findIndex(f => f.id === m.foto_id) + 1 })));
  const w = $('#avPaperWrap', B);
  w.innerHTML = `<div class="paper" id="avPaper" style="font-size:13.5px"><img class="logo" src="img/logo.webp" alt="" style="width:90px"><h2>Plano de tratamento</h2><div class="docno">${esc(A.paciente.nome)} · ${fd(new Date())}</div>
    ${(A.respostas.queixas || []).length ? `<div class="sec">O que você nos contou</div><p>${A.respostas.queixas.map(x => QUEIXAS.find(z => z.k === x.k)?.t).filter(Boolean).map(esc).join(' · ')}${A.respostas.outra ? ' · ' + esc(A.respostas.outra) : ''}</p>` : ''}
    ${imgs.filter(x => x.src).length ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(2, imgs.length)},1fr);gap:10px;margin:12px 0">${imgs.filter(x => x.src).map(x => `<img src="${x.src}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border:1px solid #d9c39a">`).join('')}</div>` : ''}
    ${pts.length ? `<div class="sec">Pontos de atenção</div>${pts.map(p => `<p style="margin:0 0 4px"><b>${p.n}.</b> ${esc(p.texto)}</p>`).join('')}` : ''}
    <div class="sec">Procedimentos indicados</div>
    <table><thead><tr><th>Fase</th><th>Procedimento</th><th>Áreas</th><th class="right">Investimento</th></tr></thead><tbody>${itens.sort((a, b) => a.fase - b.fase).map(i => `<tr><td>${i.fase}</td><td>${esc(procById(i.procedimento_id)?.nome)}</td><td>${i.areas.map(esc).join(', ')}</td><td class="right">${brl(i.valor, 2)}</td></tr>`).join('')}</tbody></table>
    <div class="tot"><div class="g"><span>Total</span><span>${brl(itens.reduce((s, i) => s + Number(i.valor), 0), 2)}</span></div></div>
    ${(() => { const P = A.plano.pagamento || pgPadrao(), base = baseValor(A.plano.itens, P.escopo), pix = calcPag(base, { ...P, forma: 'Pix' }), mx = P.max_parc || 12;
      return `<div class="sec">Condições de pagamento${P.escopo === 'fase1' ? ' · fase 1' : ''}</div>
      <p style="margin:0 0 4px"><b>Escolhida:</b> ${esc(calcPag(base, P).texto)}</p>
      <p style="margin:0 0 4px">Pix ou dinheiro: ${brl(pix.total, 2)}${pix.desconto ? ` (${nfmt(P.desc_pct)}% de desconto)` : ''} · Cartão à vista: ${brl(base, 2)} · Cartão em até ${mx}x de ${brl(Math.round(base / mx * 100) / 100, 2)} sem juros</p>`; })()}
    ${A.plano.observacoes ? `<div class="sec">Observações</div><p>${esc(A.plano.observacoes)}</p>` : ''}
    <p style="font-size:11.5px;color:#6a5f4f;margin-top:16px">Plano sugerido após avaliação. Valores válidos por 15 dias. A indicação final é confirmada no dia do procedimento.</p>
    <p style="text-align:center;margin-top:26px;border-top:1px solid #2b2620;padding-top:6px;max-width:320px;margin-inline:auto;font-size:12px;color:#6a5f4f">${esc(c.profissional || '')} · registro ${esc(c.registro || '')}</p>
    <div class="foot">${esc((c.clinica || 'Clínica Alpha').toUpperCase())} · ${esc(c.telefone || '')}</div></div>`;
  try { return await elementoParaPDF($('#avPaper', w)); } finally { w.innerHTML = ''; }
}

async function apresentar() {
  const itens = A.plano.itens.filter(i => i.incluir);
  const urls = A.fotos.length ? await signedUrls('fotos', A.fotos.map(f => f.caminho)) : {};
  let atual = 0;
  const o = document.createElement('div'); o.className = 'apresenta'; document.body.append(o); document.body.style.overflow = 'hidden';
  const pts = i => (A.marcacoes.find(m => m.foto_id === A.fotos[i]?.id)?.pontos || []).filter(p => p.texto || true);
  const draw = () => {
    o.innerHTML = `<button class="x" aria-label="Fechar">×</button><div class="in">
      <div class="foto">${A.fotos.length ? `<img src="${urls[A.fotos[atual].caminho]}" alt="Foto da avaliação"><div class="thumbs">${A.fotos.map((f, i) => `<img src="${urls[f.caminho]}" data-i="${i}" class="${i === atual ? 'on' : ''}" alt="">`).join('')}</div>` : '<img src="img/logo.webp" alt="" style="max-width:260px;border:0;margin:40px auto">'}</div>
      <div><div class="eyebrow">${esc(first(A.paciente.nome))}, este é o seu plano</div><h1 style="margin-bottom:16px">O que vamos <em>melhorar</em></h1>
        ${pts(atual).length ? `<div style="margin-bottom:22px">${pts(atual).map(p => `<div class="pt"><span class="mk-n" style="background:${p.cor};width:32px;height:32px;font-size:15px">${p.n}</span><span>${esc(p.texto || 'Ponto ' + p.n)}</span></div>`).join('')}</div>` : ''}
        ${[1, 2].map(f => { const l = itens.filter(i => i.fase === f); return l.length ? `<div class="fase-h"><b>${f === 1 ? 'Primeiro passo' : 'Para completar'}</b></div>${l.map(i => { const p = procById(i.procedimento_id); return `<div class="pt"><span style="flex:1"><b style="font-weight:500;font-size:17px">${esc(p.nome)}</b><br><span class="muted small">${i.queixas.map(esc).join(' · ')}</span></span><span class="num gold-t" style="font-family:var(--display);font-size:22px">${brl(i.valor)}</span></div>`; }).join('')}` : ''; }).join('')}
        <div class="pt" style="border-top:1px solid var(--line)"><span style="flex:1;font-family:var(--display);font-size:22px">Investimento total</span><span class="num" style="font-family:var(--display);font-size:30px;background:var(--metal);-webkit-background-clip:text;background-clip:text;color:transparent">${brl(itens.reduce((s, i) => s + Number(i.valor), 0))}</span></div>
        ${(() => { const P = A.plano.pagamento || pgPadrao(), base = baseValor(A.plano.itens, P.escopo), c = calcPag(base, P), pix = calcPag(base, { ...P, forma: 'Pix' }), mx = P.max_parc || 12;
          return `<div class="fase-h"><b>Pagamento${P.escopo === 'fase1' ? ' · primeiro passo' : ''}</b></div>
          <div class="pt"><span style="flex:1">Pix ou dinheiro${pix.desconto ? ` <span class="chip ok">${nfmt(P.desc_pct)}% off</span>` : ''}</span><span class="num gold-t" style="font-family:var(--display);font-size:22px">${brl(pix.total)}</span></div>
          <div class="pt"><span style="flex:1">Cartão à vista</span><span class="num gold-t" style="font-family:var(--display);font-size:22px">${brl(base)}</span></div>
          <div class="pt"><span style="flex:1">Cartão em até ${mx}x sem juros</span><span class="num gold-t" style="font-family:var(--display);font-size:22px">${mx}x de ${brl(Math.round(base / mx * 100) / 100, 2)}</span></div>
          <p class="small muted" style="margin-top:8px">Condição combinada: ${esc(c.texto)}</p>`; })()}
        ${A.plano.observacoes ? `<p class="muted" style="margin-top:14px">${esc(A.plano.observacoes)}</p>` : ''}</div></div>`;
  };
  draw();
  o.addEventListener('click', e => { if (e.target.closest('.x')) { o.remove(); document.body.style.overflow = ''; } const t = e.target.closest('[data-i]'); if (t) { atual = Number(t.dataset.i); draw(); } });
}
