// Conexão com o Supabase e dados de uso comum
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Executa uma consulta e lança erro se falhar
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// Cache de dados de referência (catálogo, produtos, configuração)
export const cache = { config: {}, procs: [], produtos: [], loaded: false };

export async function loadRefs(force = false) {
  if (cache.loaded && !force) return cache;
  const [cfg, procs, prods] = await Promise.all([
    q(sb.from('config').select('dados').eq('id', 1).maybeSingle()),
    q(sb.from('procedimentos').select('*').order('ordem').order('nome')),
    q(sb.from('produtos').select('*').order('categoria').order('nome')),
  ]);
  cache.config = cfg?.dados || {};
  cache.procs = procs;
  cache.produtos = prods;
  cache.loaded = true;
  return cache;
}
export const procById = id => cache.procs.find(p => p.id === id);
export const prodById = id => cache.produtos.find(p => p.id === id);
export const procsAtivos = () => cache.procs.filter(p => p.ativo);

// Pacientes: lista leve, usada em seletores
let pacCache = null;
export async function pacientesLeves(force) {
  if (pacCache && !force) return pacCache;
  pacCache = await q(sb.from('pacientes').select('id,nome,telefone,nascimento,cpf,ativo').order('nome'));
  return pacCache;
}
export const invalidarPacientes = () => { pacCache = null; };

// Arquivos privados: link temporário para exibir
const urlCache = new Map();
export async function signedUrl(bucket, path, secs = 3600) {
  const k = bucket + '/' + path, c = urlCache.get(k);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, secs);
  if (error) throw error;
  urlCache.set(k, { url: data.signedUrl, exp: Date.now() + (secs - 120) * 1000 });
  return data.signedUrl;
}
export async function signedUrls(bucket, paths) {
  const need = paths.filter(p => { const c = urlCache.get(bucket + '/' + p); return !(c && c.exp > Date.now()); });
  if (need.length) {
    const { data, error } = await sb.storage.from(bucket).createSignedUrls(need, 3600);
    if (error) throw error;
    data.forEach(d => d.signedUrl && urlCache.set(bucket + '/' + d.path, { url: d.signedUrl, exp: Date.now() + 3480e3 }));
  }
  return Object.fromEntries(paths.map(p => [p, urlCache.get(bucket + '/' + p)?.url]));
}

// Mensagem de pós-venda com variáveis
export function mensagem(tipo, vars) {
  const m = cache.config.mensagens || {};
  let t = m[tipo] || m.outro || 'Oi, {nome}!';
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export const totalVenda = v => (v.venda_itens || []).reduce((a, i) => a + Number(i.quantidade) * Number(i.preco_unit), 0) - Number(v.desconto || 0);
