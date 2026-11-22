// Entrada do aplicativo: login, moldura e rotas
import { sb, q, loadRefs, cache } from './db.js?v=202611220013';
import { $, $$, esc, toast, fail, traduzErro, closeSheet, sheetOpen } from './ui.js?v=202611220013';

const ROTAS = {
  painel:     { t: 'Painel',     m: () => import('./views/painel.js?v=202611220013'),     i: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  agenda:     { t: 'Agenda',     m: () => import('./views/agenda.js?v=202611220013'),     i: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  pacientes:  { t: 'Pacientes',  m: () => import('./views/pacientes.js?v=202611220013'),  i: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>' },
  avaliacao:  { t: 'Avaliação',  m: () => import('./views/avaliacao.js?v=202611220013'), i: '<path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M8.5 13l2.5 2.5 4.5-5"/>' },
  posvenda:   { t: 'Pós-venda',  m: () => import('./views/posvenda.js?v=202611220013'),   i: '<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>', badge: 'pv' },
  galeria:    { t: 'Antes e depois', m: () => import('./views/galeria.js?v=202611220013'), i: '<rect x="3" y="5" width="18" height="15" rx="1"/><path d="M12 5v15M3 15l4-4 5 5M15 13l2-2 4 4"/>' },
  vendas:     { t: 'Vendas',     m: () => import('./views/vendas.js?v=202611220013'),     i: '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>' },
  estoque:    { t: 'Estoque',    m: () => import('./views/estoque.js?v=202611220013'),    i: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', badge: 'st' },
  financeiro: { t: 'Financeiro', m: () => import('./views/financeiro.js?v=202611220013'), i: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M7 15h4"/>' },
  relatorios: { t: 'Relatórios', m: () => import('./views/relatorios.js?v=202611220013'), i: '<path d="M4 4v16h16"/><path d="M8 15l3-4 3 2 5-6"/>' },
  ajustes:    { t: 'Ajustes',    m: () => import('./views/ajustes.js?v=202611220013'),    i: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>' },
};

const root = $('#root');
let usuario = null;

// ---------- login ----------
function telaLogin(msg = '') {
  root.innerHTML = `<div class="login"><form class="login-card" id="loginForm" novalidate>
    <img src="img/logo.webp" alt="Clínica Alpha · Estética Avançada">
    <div class="panel">
      <div class="tabs" role="tablist" style="margin:0"><button type="button" aria-pressed="true" data-modo="entrar">Entrar</button><button type="button" aria-pressed="false" data-modo="criar">Primeiro acesso</button></div>
      <label class="field"><span>E-mail</span><input id="lgEmail" type="email" autocomplete="username" required></label>
      <label class="field"><span>Senha</span><input id="lgSenha" type="password" autocomplete="current-password" minlength="8" required></label>
      <label class="field" id="lgNomeWrap" hidden><span>Seu nome</span><input id="lgNome" autocomplete="name" placeholder="Vanessa Amaral"></label>
      <div class="err" id="lgErr">${esc(msg)}</div>
      <button class="btn gold" id="lgBtn">Entrar</button>
      <button type="button" class="link" id="lgReset" style="align-self:center">Esqueci minha senha</button>
    </div>
    <p class="hint" style="text-align:center">Acesso restrito à equipe da Clínica Alpha.<br>Dados protegidos e criptografados.</p>
  </form></div>`;
  let modo = 'entrar';
  $$('[data-modo]').forEach(b => b.onclick = () => {
    modo = b.dataset.modo; $$('[data-modo]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#lgNomeWrap').hidden = modo !== 'criar'; $('#lgBtn').textContent = modo === 'criar' ? 'Criar acesso' : 'Entrar';
    $('#lgSenha').autocomplete = modo === 'criar' ? 'new-password' : 'current-password';
  });
  $('#lgReset').onclick = async () => {
    const email = $('#lgEmail').value.trim(); if (!email) { $('#lgErr').textContent = 'Digite seu e-mail acima e toque de novo em "Esqueci minha senha".'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('#lgErr').textContent = error ? traduzErro(error) : 'Enviamos um link para redefinir a senha no seu e-mail.';
  };
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#lgEmail').value.trim(), password = $('#lgSenha').value;
    if (!email || password.length < 8) { $('#lgErr').textContent = 'Informe o e-mail e uma senha com pelo menos 8 caracteres.'; return; }
    $('#lgBtn').disabled = true; $('#lgErr').textContent = '';
    try {
      if (modo === 'criar') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nome: $('#lgNome').value.trim() }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) { $('#lgErr').textContent = 'Conta criada. Abra o e-mail de confirmação e depois entre aqui.'; return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error;
      }
    } catch (err) { $('#lgErr').textContent = traduzErro(err); }
    finally { $('#lgBtn').disabled = false; }
  };
}

function telaNovaSenha() {
  root.innerHTML = `<div class="login"><form class="login-card" id="pwForm"><img src="img/logo.webp" alt="Clínica Alpha"><div class="panel">
    <h2>Nova senha</h2><label class="field"><span>Nova senha</span><input id="pw1" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="err" id="pwErr"></div><button class="btn gold">Salvar senha</button></div></form></div>`;
  $('#pwForm').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $('#pw1').value });
    if (error) { $('#pwErr').textContent = traduzErro(error); return; }
    toast('Senha alterada.'); iniciar();
  };
}

// ---------- moldura ----------
function moldura() {
  const nome = usuario?.user_metadata?.nome || cache.config.nome_curto || 'Clínica Alpha';
  root.innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand"><img src="img/logo.webp" alt="Clínica Alpha · Estética Avançada"></div>
      <nav class="nav" aria-label="Seções">${Object.entries(ROTAS).map(([k, r]) =>
        `${k === 'relatorios' ? '<div class="sep"></div>' : ''}<a href="#/${k}" data-r="${k}" title="${r.t}"><svg viewBox="0 0 24 24">${r.i}</svg><span>${r.t}</span>${r.badge ? `<b class="count" id="badge-${r.badge}" hidden></b>` : ''}</a>`).join('')}</nav>
      <div class="who"><img src="img/emblema.webp" alt=""><div><b>${esc(nome)}</b><button id="sair">Sair</button></div></div>
    </aside>
    <main><div class="wrap" id="view"></div></main>
  </div>`;
  $('#sair').onclick = async () => { await sb.auth.signOut(); };
}

export async function atualizarBadges() {
  try {
    const hoje = new Date(); hoje.setHours(23, 59, 59);
    const [{ count: pv }, lotes] = await Promise.all([
      sb.from('posvenda').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lte('data_prevista', hoje.toISOString().slice(0, 10)),
      q(sb.from('lotes').select('produto_id,saldo,validade')),
    ]);
    const lim = new Date(); lim.setDate(lim.getDate() + 60);
    const porProd = {}; lotes.forEach(l => porProd[l.produto_id] = (porProd[l.produto_id] || 0) + Number(l.saldo));
    const baixo = cache.produtos.filter(p => p.ativo && p.estoque_minimo > 0 && (porProd[p.id] || 0) / (p.conteudo || 1) < p.estoque_minimo).length;
    const venc = lotes.filter(l => Number(l.saldo) > 0 && l.validade && new Date(l.validade) <= lim).length;
    const set = (id, n) => { const b = document.getElementById('badge-' + id); if (b) { b.textContent = n; b.hidden = !n; } };
    set('pv', pv || 0); set('st', baixo + venc);
  } catch (e) { console.warn(e); }
}

// ---------- rotas ----------
// Uma tela carrega por vez: se a pessoa tocar em outro menu no meio, a última escolha vence.
let rotaAtual = '', carregando = false, pendente = false;
async function rotear() {
  if (!usuario) return;
  if (carregando) { pendente = true; return; }
  carregando = true;
  try {
    do { pendente = false; await desenhar(); } while (pendente);
  } finally { carregando = false; }
}
async function desenhar() {
  const [nome, ...params] = (location.hash.replace(/^#\/?/, '') || 'painel').split('/');
  const r = ROTAS[nome] ? nome : 'painel';
  if (sheetOpen()) closeSheet();
  $$('.nav a').forEach(a => a.dataset.r === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const el = $('#view'); if (!el) return;
  const chave = r + '/' + params.join('/');
  if (chave !== rotaAtual) window.scrollTo(0, 0);
  rotaAtual = chave;
  const v = document.createElement('section'); v.className = 'view';
  try {
    const mod = await ROTAS[r].m();
    el.innerHTML = ''; el.append(v);
    await mod.render(v, params.map(decodeURIComponent));
    document.title = ROTAS[r].t + ' · Clínica Alpha';
  } catch (e) { if (v.isConnected && !pendente) fail(e); else console.warn(e); }
}
export const recarregar = () => { rotaAtual = ''; rotear(); };
window.addEventListener('hashchange', rotear);

// ---------- sessão ----------
async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  usuario = session?.user || null;
  if (!usuario) { telaLogin(); return; }
  try {
    const ok = await q(sb.rpc('reivindicar_clinica', { p_nome: usuario.user_metadata?.nome || null }));
    if (!ok) { await sb.auth.signOut(); telaLogin('Esta conta não tem acesso à Clínica Alpha.'); return; }
    await loadRefs(true);
    moldura(); await rotear(); atualizarBadges();
  } catch (e) { root.innerHTML = ''; telaLogin(traduzErro(e)); }
}

let ultimoUser = undefined;
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') { usuario = session?.user; telaNovaSenha(); return; }
  const id = session?.user?.id || null;
  if (id === ultimoUser) { usuario = session?.user || null; return; }
  ultimoUser = id;
  setTimeout(iniciar, 0);
});

// folha lateral: fechar
$('#sheetClose').onclick = closeSheet;
$('#sheetBg').onclick = closeSheet;
addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen() && !document.querySelector('.modal-bg,.lightbox')) closeSheet(); });
