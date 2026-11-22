// Termos e fichas: preenchimento no tablet, assinatura na tela e PDF arquivado
import { sb, q, cache, signedUrl } from '../db.js?v=202611220031';
import { $, $$, esc, openSheet, closeSheet, toast, fail, fd, age, MES, busy, iso } from '../ui.js?v=202611220031';

const f = (k, v, w = 'w-m', ph = '') => `<input class="f ${w}" data-k="${k}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" aria-label="${esc(ph || k)}">`;
const sig = (k, cap) => `<div class="sig" data-sig="${k}"><canvas></canvas><div class="cap"><span>${esc(cap)}</span><button type="button" data-clear>Limpar</button></div></div>`;
const hoje = () => new Date();
const dataExt = c => `${esc(c.cidade || 'Fortaleza')}, ${f('dia', hoje().getDate(), 'w-s', 'dia')} de ${f('mes', MES[hoje().getMonth()], 'w-m', 'mês')} de ${f('ano', hoje().getFullYear(), 'w-s', 'ano')}`;
const end = p => [p.endereco, p.bairro, p.cidade].filter(Boolean).join(', ');

const QTOX = ['Já havia realizado aplicação de toxina botulínica anteriormente?', 'Realizou aplicação de alguma toxina botulínica nos últimos meses?', 'Em aplicações anteriores, já percebeu efeito reduzido, duração muito curta ou ausência de efeito?', 'O resultado das aplicações anteriores costumava ser satisfatório?', 'Faz uso contínuo de algum medicamento?', 'Utilizou anti-inflamatório, antibióticos, relaxantes musculares ou iniciou algum medicamento próximo ao período do procedimento?', 'Possui alguma doença autoimune, neuromuscular, muscular ou outra condição de saúde relevante já diagnosticada?', 'Estava apresentando infecção, febre ou outro problema de saúde próximo à data da aplicação?', 'O efeito ocorreu em alguma região tratada, mas não em outras?', 'Percebeu inicialmente algum efeito que posteriormente diminuiu rapidamente?', 'Compareceu à avaliação/retorno no período orientado pelo profissional?', 'Apresentou algum sintoma ou reação diferente após a aplicação?'];
const QFOLLOW = { 1: 'Se sim, quando e qual marca?', 4: 'Se sim, qual(is)?', 5: 'Se sim, qual(is)?', 6: 'Se sim, qual?', 11: 'Se sim, descreva' };
const yn = (k, v) => `<span class="seg" data-yn="${k}"><button type="button" aria-pressed="${v === 'Sim'}">Sim</button><button type="button" aria-pressed="${v === 'Não'}">Não</button></span>`;

export const TIPOS = {
  imagem: {
    curto: 'Uso de imagem', nome: 'Autorização de uso de imagem', desc: 'Fotos, vídeos e voz em redes sociais, anúncios e materiais da clínica.', sigs: 2,
    html: (p, c) => `<h2>Termo de autorização<br>de uso de imagem</h2>
    <p>Em respeito ao Art. 5º da Constituição da República Federativa do Brasil e no art. 20 da Lei nº 10.406, de 2002 - Código Civil Brasileiro.</p>
    <div class="box"><div class="r"><span class="lbl"><b>Eu</b>${f('nome', p.nome, 'w-l', 'nome completo')}</span><span class="lbl"><b>CPF</b>${f('cpf', p.cpf, 'w-m', 'CPF')}</span></div>
    <div class="r"><span class="lbl" style="flex:1"><b>Residente em</b>${f('end', end(p), 'w-full', 'endereço')}</span></div></div>
    <p><b>AUTORIZO</b> o uso de minha imagem ou do(a) menor ${f('menor', '', 'w-l', 'nome do menor, se houver')} sob minha responsabilidade, em fotos, filmagem e voz para ser utilizado em campanhas de divulgação do perfil profissional da clínica de estética em questão, a autorização se dá em caráter definitivo e gratuito, estou ciente que o uso dessas imagens e vídeos podem ser vinculados em:</p>
    <ul><li>Território nacional e no exterior;</li><li>Redes sociais nacional e exterior;</li><li>Folder de divulgação;</li><li>Divulgação interna (banner, catálogo);</li><li>Revista eletrônica com distribuição por meios digitais;</li><li>Anúncios pagos nas mídias digitais;</li><li>Banco de imagens resultante de buscas;</li><li>Tv, rádio, jornais;</li><li>Outdoor;</li><li>Divulgação por meio de aplicativos de mensagens (Whatsapp, Telegram, Messenger)</li></ul>
    <p>Por esta ser a expressão da minha vontade, declaro que autorizo o uso acima descrito sem que nada haja a ser reclamado a título de direitos conexos à minha imagem ou a qualquer outro.</p>
    <p style="margin-top:14px"><b>Data:</b> ${f('data', fd(hoje()), 'w-m', 'data')}</p>
    ${sig('paciente', 'Paciente · ' + p.nome)}${sig('prof', 'Biomédica responsável · ' + (c.nome_curto || ''))}`,
  },
  faciais: {
    curto: 'Tratamentos faciais', nome: 'Consentimento · tratamentos faciais', desc: 'Limpeza de pele, microagulhamento, peelings e outros tratamentos faciais.', sigs: 2,
    html: (p, c, x) => `<h2>Termo de consentimento para realização<br>de tratamentos estéticos faciais</h2>
    <p>Eu ${f('nome', p.nome, 'w-l', 'nome completo')}, declaro ter sido informado(a) claramente e estar ciente sobre os benefícios, riscos, indicações, contraindicações, principais efeitos colaterais e advertências gerais, relacionados ao tratamento estético de ${f('trat', x.procedimento?.nome || '', 'w-l', 'tratamento')}.</p>
    <p>Os termos técnicos foram explicados e todas as minhas dúvidas foram esclarecidas por minha biomédica esteta <b>${esc(c.nome_curto || '')}</b>, que é o profissional que conduzirá todo o tratamento estético.</p>
    <p>Comprometo-me a seguir corretamente todas as orientações e a fazer uso dos produtos da minha prescrição domiciliar, caso necessário, respeitando os horários, quantidade e prazo para utilização dos mesmos, isentando neste ato os profissionais de estética envolvidos de qualquer culpa, caso o tratamento não dê certo por minha omissão exclusiva em caso de uso incorreto, pois tenho ciência de que esta obrigação de resultado está subordinada ao meu comportamento e disciplina durante e após o tratamento estético.</p>
    <p>Concordo espontaneamente em submeter-me ao referido tratamento, assumindo a responsabilidade e os riscos pelos eventuais efeitos indesejáveis decorrentes de indisciplina ou omissão de intolerância particular de minha pele e que neste momento me foram informadas.</p>
    <p>Estou ciente que posso suspender este tratamento a qualquer momento, sem que este fato implique em qualquer forma de constrangimento entre eu e minha biomédica esteta, que se dispõe a continuar me tratando caso assim eu queira ou o deixe de querer. Assim, o faço por livre e espontânea vontade.</p>
    <p><b>${dataExt(c)}</b></p>
    <div class="box">
      <div class="r"><span class="lbl"><b>Nome do paciente</b>${f('nome2', p.nome, 'w-l')}</span></div>
      <div class="r"><span class="lbl"><b>CPF</b>${f('cpf', p.cpf)}</span><span class="lbl"><b>Sexo</b>${f('sexo', p.sexo, 'w-m')}</span></div>
      <div class="r"><span class="lbl"><b>Idade</b>${f('idade', age(p.nascimento) ?? '', 'w-s')}</span><span class="lbl"><b>Telefone/WhatsApp</b>${f('tel', p.telefone)}</span></div>
      <div class="r"><span class="lbl" style="flex:1"><b>Endereço</b>${f('end', p.endereco, 'w-full')}</span></div>
      <div class="r"><span class="lbl"><b>Complemento</b>${f('bairro', p.bairro)}</span><span class="lbl"><b>Cidade</b>${f('cidade', p.cidade)}</span><span class="lbl"><b>CEP</b>${f('cep', p.cep, 'w-s')}</span></div>
    </div>
    ${sig('paciente', 'Assinatura do paciente ou responsável legal')}
    <div class="box"><div class="r"><span><b>Profissional responsável:</b> ${esc(c.profissional || '')}</span><span><b>Nº credencial:</b> ${esc(c.registro || '')}</span></div><div class="r"><span><b>Endereço da clínica:</b> ${esc(c.endereco || '')}</span></div><div class="r"><span><b>Cidade:</b> ${esc(c.cidade || '')}</span><span><b>CEP:</b> ${esc(c.cep || '')}</span><span><b>Telefone:</b> ${esc(c.telefone || '')}</span></div></div>
    ${sig('prof', 'Assinatura do profissional esteta')}`,
  },
  injetavel: {
    curto: 'Injetável', nome: 'Consentimento · procedimento injetável', desc: 'Toxina, preenchedores, otomodelação, bioestimuladores e skinbooster.', sigs: 1,
    html: (p, c, x) => `<h2>Termo de consentimento livre e esclarecido<br>para procedimento estético injetável</h2>
    <div class="box">
      <div class="r"><span class="lbl" style="flex:1"><b>Paciente</b>${f('nome', p.nome, 'w-full')}</span></div>
      <div class="r"><span class="lbl"><b>CPF</b>${f('cpf', p.cpf)}</span><span class="lbl"><b>Data de nascimento</b>${f('nasc', p.nascimento ? fd(p.nascimento) : '')}</span></div>
      <div class="r"><span class="lbl" style="flex:1"><b>Procedimento proposto</b>${f('proc', x.procedimento?.nome || '', 'w-full', 'ex.: toxina botulínica · terço superior')}</span></div>
      <div class="r"><span class="lbl" style="flex:1"><b>Profissional responsável</b>${f('prof', `${c.profissional || ''} · registro ${c.registro || ''}`, 'w-full')}</span></div>
    </div>
    <p>Declaro que fui previamente avaliado(a) e informado(a), de forma clara e compreensível, sobre o procedimento estético injetável proposto, incluindo sua finalidade, indicação, técnica, benefícios esperados, limitações, alternativas, cuidados necessários, riscos e possíveis intercorrências.</p>
    <p>Estou ciente de que os resultados podem variar conforme características individuais, condições anatômicas e fisiológicas, hábitos de vida e resposta do organismo, não havendo garantia de resultado específico.</p>
    <p>Declaro ter recebido informações sobre o produto a ser utilizado, incluindo, quando aplicável, nome, fabricante, lote, validade e finalidade, bem como sobre sua regularização perante a autoridade sanitária competente.</p>
    <p>Fui informado(a) sobre os efeitos, riscos e possíveis intercorrências do procedimento, incluindo dor, sensibilidade, vermelhidão, edema, equimoses, hematomas, assimetrias e alterações temporárias ou persistentes, podendo algumas complicações exigir avaliação, acompanhamento ou tratamento adicional.</p>
    <p>Declaro ter informado corretamente meu histórico de saúde, incluindo doenças, alergias, medicamentos, suplementos, anticoagulantes, procedimentos anteriores, gestação ou amamentação, estando ciente de que a omissão de informações relevantes poderá comprometer a segurança do procedimento.</p>
    <p>Comprometo-me a seguir as orientações fornecidas antes, durante e após o procedimento e a comunicar imediatamente à clínica/profissional qualquer reação ou alteração inesperada, buscando atendimento quando orientado.</p>
    <div class="sec">Declaração e consentimento do paciente</div>
    <p>Declaro que tive oportunidade de fazer perguntas, que minhas dúvidas foram esclarecidas e que compreendi os benefícios, limitações, riscos, possíveis efeitos adversos e cuidados relacionados ao procedimento. Declaro ainda que li e compreendi este termo e que, de forma livre e sem pressão ou constrangimento, <b>autorizo a realização do procedimento acima identificado</b>.</p>
    <p><b>${dataExt(c)}</b></p>
    ${sig('paciente', 'Assinatura do paciente/responsável')}`,
  },
  toxina: {
    curto: 'Investigação da toxina', nome: 'Ficha de investigação · toxina botulínica A', desc: 'Para resposta insatisfatória: dados do lote, questionário e avaliação.', sigs: 2,
    html: (p, c, x) => { const a = x.ultimaToxina || {}; return `<h2>Ficha de investigação de resposta<br>insatisfatória à toxina botulínica A</h2>
    <div class="sec">Identificação do paciente</div>
    <div class="box">
      <div class="r"><span class="lbl" style="flex:1"><b>Paciente</b>${f('nome', p.nome, 'w-full')}</span></div>
      <div class="r"><span class="lbl"><b>CPF</b>${f('cpf', p.cpf)}</span><span class="lbl"><b>Nascimento</b>${f('nasc', p.nascimento ? fd(p.nascimento) : '')}</span></div>
      <div class="r"><span class="lbl"><b>Data do procedimento</b>${f('dproc', a.data ? fd(a.data) : '')}</span><span class="lbl"><b>Data da avaliação</b>${f('daval', fd(hoje()))}</span></div>
    </div>
    <div class="sec">Dados do produto utilizado</div>
    <div class="box">
      <div class="r"><span class="lbl"><b>Nome comercial</b>${f('marca', a.produto || '', 'w-m')}</span><span class="lbl"><b>Fabricante</b>${f('fab', a.fabricante || '', 'w-m')}</span></div>
      <div class="r"><span class="lbl"><b>Fornecedor/distribuidora</b>${f('forn', a.fornecedor || '', 'w-l')}</span></div>
      <div class="r"><span class="lbl"><b>Lote</b>${f('lote', a.lote || '')}</span><span class="lbl"><b>Validade</b>${f('val', a.validade ? fd(a.validade) : '', 'w-m', 'dd/mm/aaaa')}</span></div>
      <div class="r"><span class="lbl"><b>Apresentação (U)</b>${f('apres', a.conteudo || '', 'w-s')}</span><span class="lbl"><b>Quantidade utilizada (U)</b>${f('qtd', a.qtd || '', 'w-s')}</span></div>
      <div class="r"><span class="lbl"><b>Abertura/reconstituição</b>${f('recons', a.aberto ? fd(a.aberto) : '', 'w-m', 'dd/mm/aaaa')}</span><span class="lbl"><b>Diluente/volume</b>${f('dil', a.tecnica || '', 'w-m')}</span></div>
    </div>
    <div class="sec">Questionário ao paciente</div>
    ${QTOX.map((qq, i) => `<div class="yn"><span>${i + 1}. ${qq}${QFOLLOW[i] ? `<br>${f('q' + i + 'x', '', 'w-l', QFOLLOW[i])}` : ''}</span>${yn('q' + i)}</div>`).join('')}
    <div class="sec">Observações do profissional</div>
    <div class="box">
      <div class="r"><span class="lbl" style="flex:1"><b>Regiões tratadas</b>${f('reg', a.areas || '', 'w-full')}</span></div>
      <div class="r"><span class="lbl" style="flex:1"><b>Resposta observada no retorno</b>${f('resp', '', 'w-full')}</span></div>
      <div class="r"><span class="lbl"><b>Possui registro fotográfico?</b>${yn('foto')}</span></div>
    </div>
    <p style="font-size:12.5px">Declaro que as informações acima foram fornecidas por mim e correspondem, tanto quanto é de meu conhecimento, ao histórico relacionado ao procedimento realizado.</p>
    <p style="font-size:12.5px;color:#6a5f4f">Este documento tem como finalidade registrar e investigar a resposta clínica insatisfatória observada após a aplicação de toxina botulínica A e subsidiar eventual solicitação de análise técnica do produto/lote junto ao fornecedor e/ou fabricante, não constituindo, isoladamente, confirmação de desvio de qualidade do produto.</p>
    <p><b>${esc(c.cidade || 'Fortaleza')}/${esc(c.uf || 'CE')}, ${hoje().getDate()} de ${MES[hoje().getMonth()]} de ${hoje().getFullYear()}.</b></p>
    ${sig('paciente', 'Assinatura do(a) paciente')}${sig('prof', 'Assinatura do profissional · Registro ' + (c.registro || ''))}`; },
  },
};

function initPad(box) {
  const c = box.querySelector('canvas'), r = c.getBoundingClientRect(), dpr = Math.max(2, window.devicePixelRatio || 1);
  c.width = r.width * dpr; c.height = r.height * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#1d1913'; x.fillStyle = '#1d1913';
  let draw = false, lx = 0, ly = 0; box.dirty = false;
  const pos = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  c.onpointerdown = e => { e.preventDefault(); draw = true; c.setPointerCapture(e.pointerId); [lx, ly] = pos(e); x.beginPath(); x.arc(lx, ly, 1.1, 0, 7); x.fill(); };
  c.onpointermove = e => { if (!draw) return; const [nx, ny] = pos(e); x.lineWidth = e.pointerType === 'pen' && e.pressure ? 1.1 + e.pressure * 2.4 : 2.2; x.beginPath(); x.moveTo(lx, ly); x.lineTo(nx, ny); x.stroke(); lx = nx; ly = ny; box.dirty = true; box.classList.remove('need'); };
  c.onpointerup = c.onpointercancel = () => draw = false;
  box.querySelector('[data-clear]').onclick = () => { x.clearRect(0, 0, c.width, c.height); box.dirty = false; };
}

// Converte um elemento em PDF A4 (várias páginas se precisar)
export async function elementoParaPDF(el) {
  if (!window.html2canvas || !window.jspdf) throw new Error('Gerador de PDF não carregou. Verifique a internet e recarregue a página.');
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fbf8f1';
  const clone = el.cloneNode(true); clone.style.maxWidth = '794px'; clone.style.boxShadow = 'none'; clone.style.margin = '0';
  // troca campos por texto e assinaturas por imagem
  const origCanvas = $$('canvas', el);
  $$('canvas', clone).forEach((c, i) => { const img = document.createElement('img'); img.src = origCanvas[i].toDataURL('image/png'); img.style.cssText = 'display:block;width:100%;height:140px;object-fit:contain;border-bottom:1px solid #2b2620'; c.replaceWith(img); });
  $$('.sig .cap button', clone).forEach(b => b.remove());
  $$('input.f, select.f', clone).forEach(i => { const s = document.createElement('span'); s.textContent = i.value || '______'; s.style.cssText = 'border-bottom:1px solid #b7a27a;padding:0 4px;font-weight:500'; i.replaceWith(s); });
  $$('.seg', clone).forEach(s => { const on = s.querySelector('[aria-pressed="true"]'); const t = document.createElement('b'); t.textContent = on ? on.textContent : '—'; s.replaceWith(t); });
  wrap.append(clone); document.body.append(wrap);
  await Promise.all($$('img', clone).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  try {
    const canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: '#fbf8f1', useCORS: true, logging: false });
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const pxPorPag = Math.floor(canvas.width * ph / pw);
    for (let y = 0, pag = 0; y < canvas.height; y += pxPorPag, pag++) {
      const h = Math.min(pxPorPag, canvas.height - y);
      const part = document.createElement('canvas'); part.width = canvas.width; part.height = h;
      const pc = part.getContext('2d'); pc.fillStyle = '#fbf8f1'; pc.fillRect(0, 0, part.width, h); pc.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (pag) pdf.addPage();
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, h * pw / canvas.width);
    }
    return pdf.output('blob');
  } finally { wrap.remove(); }
}

async function sha256(blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function salvarPDF({ paciente_id, atendimento_id = null, tipo, titulo, dados = {}, blob }) {
  const hash = await sha256(blob);
  const path = `${paciente_id}/${iso(new Date())}-${tipo}-${crypto.randomUUID().slice(0, 8)}.pdf`;
  const { error } = await sb.storage.from('documentos').upload(path, blob, { contentType: 'application/pdf' });
  if (error) throw error;
  return await q(sb.from('documentos').insert({ paciente_id, atendimento_id, tipo, titulo, dados, pdf_caminho: path, sha256: hash }).select().single());
}

export async function abrirDocumento(path) {
  const w = window.open('', '_blank');
  try { const url = await signedUrl('documentos', path, 600); if (w) w.location = url; else location.href = url; }
  catch (e) { w && w.close(); fail(e); }
}

async function dadosToxina(pacienteId) {
  const at = await q(sb.from('atendimentos').select('data,tecnica,procedimentos(categoria_estoque),aplicacoes(area,quantidade,lotes(lote,validade,fornecedor,aberto_em),produtos(nome,fabricante,conteudo))').eq('paciente_id', pacienteId).order('data', { ascending: false }).limit(10));
  const a = at.find(x => x.procedimentos?.categoria_estoque === 'Toxina'); if (!a) return {};
  const ap = a.aplicacoes.find(x => x.lotes) || a.aplicacoes[0] || {};
  return { data: a.data, tecnica: a.tecnica, produto: ap.produtos?.nome, fabricante: ap.produtos?.fabricante, conteudo: ap.produtos?.conteudo, lote: ap.lotes?.lote, validade: ap.lotes?.validade, fornecedor: ap.lotes?.fornecedor, aberto: ap.lotes?.aberto_em,
    qtd: a.aplicacoes.reduce((s, x) => s + Number(x.quantidade), 0), areas: a.aplicacoes.map(x => `${x.area} (${x.quantidade} U)`).join(', ') };
}

export async function assinarDocumento({ paciente, tipo = 'injetavel', procedimento = null, atendimento = null, onDone }) {
  const T = TIPOS[tipo]; const c = cache.config;
  const extra = { procedimento, ultimaToxina: tipo === 'toxina' ? await dadosToxina(paciente.id) : null };
  const b = openSheet({ eyebrow: 'Para preencher e assinar no tablet', title: T.nome, wide: true, body: `
    <div class="tabs" id="docTipos">${Object.entries(TIPOS).map(([k, v]) => `<button aria-pressed="${k === tipo}" data-t="${k}">${esc(v.curto)}</button>`).join('')}</div>
    <div class="paper" id="paper"><img class="logo" src="img/logo.webp" alt="Clínica Alpha">${T.html(paciente, c, extra)}<div class="foot">${esc((c.clinica || 'Clínica Alpha').toUpperCase())} · ${esc((c.subtitulo || '').toUpperCase())}</div><div class="stamp" id="stamp"></div></div>
    <div class="btns end" style="margin-top:20px"><button class="btn" id="docLimpar">Limpar assinaturas</button><button class="btn gold" id="docSalvar">Concluir e arquivar</button></div>` });
  $$('#docTipos [data-t]', b).forEach(x => x.onclick = () => assinarDocumento({ paciente, tipo: x.dataset.t, procedimento, atendimento, onDone }));
  requestAnimationFrame(() => $$('.sig', b).forEach(initPad));
  $('#paper', b).addEventListener('click', e => { const bt = e.target.closest('.seg button'); if (!bt) return; $$('button', bt.parentNode).forEach(x => x.setAttribute('aria-pressed', x === bt)); });
  $('#docLimpar', b).onclick = () => $$('.sig [data-clear]', b).forEach(x => x.click());
  $('#docSalvar', b).onclick = async e => {
    const faltam = $$('.sig', b).filter(s => !s.dirty); faltam.forEach(s => s.classList.add('need'));
    if (faltam.length) { faltam[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(faltam.length === 1 ? 'Falta uma assinatura para concluir.' : `Faltam ${faltam.length} assinaturas para concluir.`, true); return; }
    await busy(e.currentTarget, async () => {
      try {
        const agora = new Date();
        $('#stamp', b).textContent = `Assinado eletronicamente em ${fd(agora)} às ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')} · ${c.clinica || 'Clínica Alpha'}`;
        const dados = {}; $$('[data-k]', b).forEach(i => dados[i.dataset.k] = i.value);
        $$('[data-yn]', b).forEach(s => { const on = s.querySelector('[aria-pressed="true"]'); dados[s.dataset.yn] = on ? on.textContent : null; });
        const blob = await elementoParaPDF($('#paper', b));
        await salvarPDF({ paciente_id: paciente.id, atendimento_id: atendimento?.id || null, tipo, titulo: T.nome, dados, blob });
        if (tipo === 'imagem' && !paciente.uso_imagem) { await q(sb.from('pacientes').update({ uso_imagem: true }).eq('id', paciente.id)); paciente.uso_imagem = true; }
        closeSheet(); toast(`Documento arquivado no prontuário de ${paciente.nome.split(' ')[0]}.`); onDone && onDone();
      } catch (err) { fail(err); }
    });
  };
}
