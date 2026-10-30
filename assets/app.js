(() => {
'use strict';

/* Fonte dos dados:
   - com o link da planilha do Google em assets/config.js, as vendas, as metas e as datas vêm da
     aba Telão da planilha; do data/ranking.json continuam vindo a unidade, o nome do ciclo e as fotos;
   - sem o link, tudo vem do data/ranking.json (atualizado por commit, IA ou automação). Alterações
     feitas pela tela ficam só neste navegador até o arquivo ser baixado e substituído no repositório. */
const ARQUIVO = 'data/ranking.json';
const CHAVE = 'ranking-rascunho-v1';
const PLANILHA = (window.RANKING_CONFIG && String(window.RANKING_CONFIG.planilha || '').trim()) || '';
/* com a planilha, o painel confere a cada 8 s (lançou, a TV mostra em segundos); com o arquivo, a cada 60 s */
const INTERVALO = PLANILHA ? 8000 : 60000;
const INTERVALO_CADASTRO = 60000;    // com a planilha, fotos e nome do ciclo (data/ranking.json) são relidos a cada minuto
const FONTES_PLANILHA = PLANILHA ? fontesPlanilha(PLANILHA) : [];

/* aceita o link normal da planilha (o da barra de endereço ou o de "Compartilhar") e lê a aba Telão em CSV */
function fontesPlanilha(link) {
  if (/output=csv|tqx=out:csv/.test(link)) return [link];
  const id = (/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(link) || [])[1];
  if (!id) return [];
  const gid = (/[#&?]gid=(\d+)/.exec(link) || [])[1];
  const raiz = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&headers=1';
  return [raiz + '&sheet=' + encodeURIComponent('Telão'), ...(gid ? [raiz + '&gid=' + gid] : [])];
}

/* Reserva usada só quando data/ranking.json não pode ser lido
   (por exemplo, index.html aberto direto do disco): equipe sem vendas. */
const DEMO = {
  config: { meta: 21000000, metaConsultor: 2000000, metaEquipe: 7000000, unidade: 'Anália Franco' },
  consultores: [
    ['camily-dias', 'Camily Dias', 'Esquadrão Alpha'], ['claudia-lino', 'Claudia Lino', 'Esquadrão Alpha'],
    ['giovana-rodrigues', 'Giovana Rodrigues', 'Esquadrão Alpha'],
    ['sula-teixeira', 'Sula Teixeira', 'Esquadrão Alpha'], ['izabella-nascimento', 'Izabella Nascimento', 'Esquadrão Alpha'],
    ['antonio-pimentel', 'Antônio Pimentel', 'Esquadrão Alpha'], ['diana-trindade', 'Diana Trindade', 'Esquadrão Alpha'],
    ['alex-sandro', 'Alex Sandro', 'Artilheiros'], ['edvan-fernandes', 'Edvan Fernandes', 'Artilheiros'],
    ['enzo-santorelli', 'Enzo Santorelli', 'Artilheiros'], ['pedro-lucas', 'Pedro Lucas', 'Artilheiros'],
    ['ricardo-neves', 'Ricardo Neves', 'Artilheiros'], ['tamyres-reis', 'Tamyres Reis', 'Artilheiros'],
    ['isabella-oliveira', 'Isabella Oliveira', 'Artilheiros'],
    ['bruno-marques', 'Bruno Marques', 'Lekos'], ['matheus-detilio', 'Matheus Detilio', 'Lekos'],
    ['lais-berloni', 'Lais Berloni', 'Lekos'], ['mateus-sales', 'Mateus Sales', 'Lekos'],
    ['gabriel-caseri', 'Gabriel Caseri', 'Lekos'], ['juliana-delgado', 'Juliana Delgado', 'Lekos'],
    ['fernando', 'Fernando Kasemodel', 'Lekos'], ['stephanie-martins', 'Stephanie Martins', 'Lekos']
  ]
};
const SEM_EQUIPE = 'Sem equipe';

const CATS = { imovel: 'Imóvel', auto: 'Automóvel', pesados: 'Pesados', servicos: 'Serviços', outros: 'Não informada' };
const PADRAO = { meta: 21000000, metaConsultor: 2000000, metaEquipe: 0, unidade: 'Anália Franco', ciclo: '', inicio: '', prazo: '', exemplo: false };
const $ = id => document.getElementById(id);
const app = $('app');
const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = new Intl.NumberFormat('pt-BR');

/* ---------- formatação ---------- */
const brl = v => 'R$ ' + nf.format(Math.round(v));
function compacto(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  if (a >= 1e3) return (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
  return nf.format(Math.round(v));
}
const curto = v => 'R$ ' + compacto(v);
const pctTxt = p => p.toLocaleString('pt-BR', { maximumFractionDigits: p >= 10 || p === 0 ? 0 : 1 }) + '%';
const doisDig = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + doisDig(d.getMonth() + 1) + '-' + doisDig(d.getDate());
const hojeISO = () => iso(new Date());
const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dias = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
function somaDias(s, n) { const d = new Date(utc(s) + n * 864e5); return d.getUTCFullYear() + '-' + doisDig(d.getUTCMonth() + 1) + '-' + doisDig(d.getUTCDate()); }
const dataCurta = s => s.slice(8, 10) + '/' + s.slice(5, 7);
const ehData = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
function quando(s) {
  const n = dias(s, hojeISO());
  if (n === 0) return 'hoje';
  if (n === 1) return 'ontem';
  if (n > 1 && n < 7) return 'há ' + n + ' dias';
  return dataCurta(s);
}
/* "Supervisora" vira "supervisora" no meio da frase; siglas como "CEO" ficam como estão */
const cargoTxt = c => /^[A-ZÀ-Ú]{2,5}$/.test(c) ? c : c.toLowerCase();
const iniciais = nome => { const p = nome.trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] || '?').slice(0, 2)).toUpperCase(); };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'consultor';
function marca(texto) { let h = 5381; for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0; return String(h) + ':' + texto.length; }

function el(tag, props, ...filhos) {
  const n = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === 'class') n.className = props[k];
    else if (k === 'text') n.textContent = props[k];
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'type' || k === 'maxlength') n.setAttribute(k, props[k]);
    else n[k] = props[k];
  }
  for (const f of filhos) if (f != null) n.append(f);
  return n;
}

/* ---------- estado ---------- */
const state = {
  modo: 'carregando',           // carregando | arquivo | demo
  rascunho: false,              // há alterações locais ainda não publicadas
  podeEditar: !PLANILHA && location.hash === '#editar',   // com a planilha, quem lança é a planilha
  config: { ...PADRAO },
  consultores: new Map(),       // id -> {id, nome, equipe}
  supervisores: new Map(),      // nome da equipe (normalizado) -> {equipe, nome, cargo, foto}
  vendas: [],                  // {id, ordem, consultor, valor, categoria, data}
  atualizadoEm: '',
  conferidoEm: null,            // última vez que o painel leu o arquivo
  filtro: 'ciclo',
  verTodas: false,
  confirmar: null,
  confirmarEquipe: null,
  confirmarLimpar: false
};
let textoArquivo = '', ordem = 0;

function normConfig(d) {
  const c = { ...PADRAO };
  if (Number(d.meta) > 0) c.meta = Number(d.meta);
  if (Number(d.metaConsultor) > 0) c.metaConsultor = Number(d.metaConsultor);
  if (Number(d.metaEquipe) > 0) c.metaEquipe = Number(d.metaEquipe);
  if (typeof d.unidade === 'string' && d.unidade.trim()) c.unidade = d.unidade.trim().slice(0, 40);
  if (typeof d.ciclo === 'string') c.ciclo = d.ciclo.trim().slice(0, 40);
  if (ehData(d.inicio)) c.inicio = d.inicio;
  if (ehData(d.prazo)) c.prazo = d.prazo;
  c.exemplo = d.exemplo === true;
  return c;
}
/* foto do consultor: só caminhos de arquivo do próprio site (ex.: assets/consultores/nome.jpg) */
const fotoValida = s => typeof s === 'string' && /^[\w\-/.]+\.(jpe?g|png|webp)$/i.test(s) && !s.includes('..') ? s : '';
/* cargo opcional do consultor (ex.: CEO): aparece embaixo do nome no lugar da equipe */
const limparCargo = s => typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
const rotulo = p => (p && (p.cargo || p.equipe)) || '';
const limparEquipe = s => typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
/* equipes na ordem em que aparecem no cadastro (a do arquivo), usada como desempate e nos menus */
function ordemEquipes() {
  const nomes = [];
  for (const p of state.consultores.values()) if (p.equipe && !nomes.includes(p.equipe)) nomes.push(p.equipe);
  return nomes;
}
function normVenda(d) {
  return {
    id: 'v' + (++ordem), ordem, consultor: String(d.consultor || ''), valor: Math.max(0, Number(d.valor) || 0),
    /* sem data: a venda conta no ciclo, mas fica fora dos filtros de 7 dias e hoje; cotas: quantas cotas a linha representa */
    categoria: CATS[d.categoria] ? d.categoria : 'outros', data: ehData(d.data) ? d.data : '',
    cotas: Math.max(1, Math.round(Number(d.cotas) || 1))
  };
}
function aplicar(dados) {
  const d = dados && typeof dados === 'object' ? dados : {};
  state.config = normConfig(d.config && typeof d.config === 'object' ? d.config : {});
  state.consultores = new Map();
  for (const p of Array.isArray(d.consultores) ? d.consultores : []) {
    if (!p || typeof p !== 'object') continue;
    const nome = String(p.nome || '').trim().slice(0, 60);
    if (!nome) continue;
    const id = String(p.id || slug(nome));
    state.consultores.set(id, { id, nome, equipe: limparEquipe(p.equipe), cargo: limparCargo(p.cargo), foto: fotoValida(p.foto) });
  }
  /* supervisão de cada equipe: aparece com foto no cartão da equipe e na faixa ao vivo */
  state.supervisores = new Map();
  for (const s of Array.isArray(d.supervisores) ? d.supervisores : []) {
    if (!s || typeof s !== 'object') continue;
    const equipe = limparEquipe(s.equipe), nome = String(s.nome || '').trim().slice(0, 60);
    if (!equipe || !nome) continue;
    state.supervisores.set(normNome(equipe), { equipe, nome, cargo: String(s.cargo || '').trim().slice(0, 30), foto: fotoValida(s.foto) });
  }
  state.vendas = (Array.isArray(d.vendas) ? d.vendas : []).filter(v => v && typeof v === 'object').map(normVenda);
  state.atualizadoEm = typeof d.atualizadoEm === 'string' ? d.atualizadoEm : '';
  state.confirmar = null;
}
function exportar() {
  return {
    atualizadoEm: new Date().toISOString(),
    config: { ...state.config },
    consultores: [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome, ...(p.equipe ? { equipe: p.equipe } : {}), ...(p.cargo ? { cargo: p.cargo } : {}), ...(p.foto ? { foto: p.foto } : {}) })),
    supervisores: [...state.supervisores.values()].map(s => ({ equipe: s.equipe, nome: s.nome, ...(s.cargo ? { cargo: s.cargo } : {}), ...(s.foto ? { foto: s.foto } : {}) })),
    vendas: [...state.vendas].sort((a, b) => a.ordem - b.ordem).map(v => ({ consultor: v.consultor, valor: v.valor, categoria: v.categoria, ...(v.data ? { data: v.data } : {}), ...(v.cotas > 1 ? { cotas: v.cotas } : {}) }))
  };
}
function textoJson(d) {
  const bloco = lista => lista.length ? '[\n' + lista.map(o => '    ' + JSON.stringify(o)).join(',\n') + '\n  ]' : '[]';
  return '{\n  "atualizadoEm": ' + JSON.stringify(d.atualizadoEm) + ',\n  "config": ' + JSON.stringify(d.config, null, 2).replace(/\n/g, '\n  ') +
    ',\n  "consultores": ' + bloco(d.consultores) + (d.supervisores && d.supervisores.length ? ',\n  "supervisores": ' + bloco(d.supervisores) : '') + ',\n  "vendas": ' + bloco(d.vendas) + '\n}\n';
}

/* ---------- rascunho local ---------- */
function mudou(msg) {
  state.rascunho = true;
  if (textoArquivo) { try { localStorage.setItem(CHAVE, JSON.stringify({ base: marca(textoArquivo), dados: exportar() })); } catch (e) { /* sem armazenamento local: segue só em memória */ } }
  if (msg) toast(msg);
  render();
}
function apagarRascunho() { try { localStorage.removeItem(CHAVE); } catch (e) { /* nada a apagar */ } }
function descartar() {
  apagarRascunho(); state.rascunho = false;
  if (textoArquivo) aplicar(JSON.parse(textoArquivo)); else carregarDemo();
  toast('Alterações descartadas'); render();
}
function baixar() {
  const blob = new Blob([textoJson(exportar())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: 'ranking.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('ranking.json baixado. Substitua o arquivo da pasta data no repositório.');
}

/* ---------- cálculo ---------- */
function calcular() {
  const c = state.config, hoje = hojeISO();
  const noCiclo = v => state.consultores.has(v.consultor) && (!v.data || ((!c.inicio || v.data >= c.inicio) && (!c.prazo || v.data <= c.prazo)));
  const ciclo = state.vendas.filter(noCiclo);
  const total = ciclo.reduce((s, v) => s + v.valor, 0);
  const porCat = { imovel: 0, auto: 0, pesados: 0, servicos: 0, outros: 0 };
  const cicloPor = new Map();
  for (const v of ciclo) { porCat[v.categoria] += v.valor; cicloPor.set(v.consultor, (cicloPor.get(v.consultor) || 0) + v.valor); }

  const corte = state.filtro === 'hoje' ? hoje : state.filtro === '7d' ? somaDias(hoje, -6) : null;
  const base = corte ? ciclo.filter(v => v.data && v.data >= corte && v.data <= hoje) : ciclo;
  const linhas = [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome, equipe: p.equipe, cargo: p.cargo, foto: p.foto, valor: 0, cotas: 0, ultima: '' }));
  const porId = new Map(linhas.map(l => [l.id, l]));
  for (const v of base) { const l = porId.get(v.consultor); l.valor += v.valor; l.cotas += v.cotas; if (v.data && v.data > l.ultima) l.ultima = v.data; }
  linhas.sort((a, b) => b.valor - a.valor || b.cotas - a.cotas || a.nome.localeCompare(b.nome, 'pt-BR'));

  let venderam = 0;
  for (const p of state.consultores.keys()) if ((cicloPor.get(p) || 0) > 0) venderam++;

  /* ranking de equipes: soma do crédito do ciclo de cada equipe */
  const ordemEq = ordemEquipes(), porEquipe = new Map();
  for (const nome of ordemEq) porEquipe.set(nome, { nome, valor: 0, cotas: 0, membros: 0, naMeta: 0, ordem: porEquipe.size });
  for (const p of state.consultores.values()) {
    const chave = p.equipe || SEM_EQUIPE;
    if (!porEquipe.has(chave)) porEquipe.set(chave, { nome: chave, valor: 0, cotas: 0, membros: 0, naMeta: 0, ordem: 1e3 });
    const e = porEquipe.get(chave), vendido = cicloPor.get(p.id) || 0;
    e.membros++; e.valor += vendido;
  }
  for (const v of ciclo) { const p = state.consultores.get(v.consultor); porEquipe.get(p.equipe || SEM_EQUIPE).cotas += v.cotas; }
  /* quem está sem equipe (a proprietária, por exemplo) soma no total da franquia, mas não aparece como equipe */
  const equipes = ordemEq.length ? [...porEquipe.values()].filter(e => e.nome !== SEM_EQUIPE).sort((a, b) => b.valor - a.valor || a.ordem - b.ordem) : [];
  for (const e of equipes) e.sup = state.supervisores.get(normNome(e.nome)) || null;

  let ideal = null, restantes = null;
  if (c.prazo) restantes = Math.max(dias(hoje, c.prazo) + 1, 0);
  if (c.inicio && c.prazo && c.prazo >= c.inicio) {
    const totalDias = dias(c.inicio, c.prazo) + 1;
    const passados = Math.min(Math.max(dias(c.inicio, hoje) + 1, 0), totalDias);
    ideal = c.meta * passados / totalDias;
  }
  const feed = [...ciclo].sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.ordem - a.ordem);
  /* todo mundo com o vendido no ciclo, do maior para o menor: base do pódio, das telas de equipe e do mural */
  const cotasPor = new Map();
  for (const v of ciclo) cotasPor.set(v.consultor, (cotasPor.get(v.consultor) || 0) + v.cotas);
  const pessoas = [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome, equipe: p.equipe, cargo: p.cargo, foto: p.foto, valor: cicloPor.get(p.id) || 0, cotas: cotasPor.get(p.id) || 0 }))
    .sort((a, b) => b.valor - a.valor || b.cotas - a.cotas || a.nome.localeCompare(b.nome, 'pt-BR'));
  for (const e of equipes) e.venderam = pessoas.filter(p => (p.equipe || SEM_EQUIPE) === e.nome && p.valor > 0).length;
  const lideres = pessoas.filter(l => l.valor > 0);
  return { total, porCat, linhas, equipes, lideres, pessoas, venderam, ideal, restantes, feed, cotas: ciclo.reduce((s, v) => s + v.cotas, 0), falta: Math.max(c.meta - total, 0), somaFiltro: base.reduce((s, v) => s + v.valor, 0) };
}

/* ---------- pintura ---------- */
let quadro = 0;
function render() { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; pintar(); }); }

const mostrado = { total: 0 };
function contar(alvo, de, para, fmt) {
  cancelAnimationFrame(alvo._q);
  if (semMovimento || de === para) { alvo.textContent = fmt(para); return; }
  const t0 = performance.now(), dur = 900;
  const passo = t => {
    const k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
    alvo.textContent = fmt(de + (para - de) * e);
    if (k < 1) alvo._q = requestAnimationFrame(passo);
  };
  alvo._q = requestAnimationFrame(passo);
}

/* valores das linhas e das equipes sobem contando quando mudam */
function contarValor(alvo, valor) {
  if (alvo._v === valor) return;
  const de = alvo._v;
  alvo._v = valor;
  if (de == null) { alvo.textContent = brl(valor); return; }
  contar(alvo, de, valor, brl);
}

function passoRegua(meta) {
  const bruto = meta / 7, pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  return ([1, 2, 2.5, 3, 5, 10].find(x => x >= n - 1e-9) || 10) * pot;
}

let ritmoX = 0;
function posicionarRitmo() {
  const t = $('ritmo-txt'); if (t.hidden) return;
  const larg = $('regua-area').clientWidth, w = t.offsetWidth;
  t.style.left = Math.max(Math.min(ritmoX * larg - w / 2, larg - w), 0) + 'px';
}
addEventListener('resize', posicionarRitmo);

/* ---------- textos que trocam ----------
   A frase atual sobe e sai por cima; a nova entra por baixo, palavra por palavra. */
function trocar(alvo, texto) {
  if (alvo._texto === texto) return false;
  const primeira = alvo._texto == null;
  alvo._texto = texto;
  for (const v of alvo.querySelectorAll('.tr')) {
    if (semMovimento || primeira) v.remove();
    else if (!v.classList.contains('sai')) { v.classList.add('sai'); v.setAttribute('aria-hidden', 'true'); setTimeout(() => v.remove(), 750); }
  }
  const nova = el('span', { class: 'tr' });
  texto.split(' ').forEach((w, i) => { if (i) nova.append(' '); nova.append(el('span', { class: 'w', style: '--w:' + i }, el('span', { text: w }))); });
  alvo.append(nova);
  return true;
}
/* replay da montagem da mão (palma abre, dedos entram) */
function maoVai(m) { if (!m || semMovimento) return; m.classList.remove('vai'); void m.offsetWidth; m.classList.add('vai'); }
const hora = d => doisDig(d.getHours()) + ':' + doisDig(d.getMinutes());

let giroStatus = 0;
function textosStatus() {
  if (state.modo === 'carregando') return ['Carregando'];
  if (state.rascunho) return ['Alterações não publicadas'];
  if (state.modo === 'demo') return ['Dados de exemplo'];
  const t = [], d = new Date(state.atualizadoEm);
  if (!isNaN(d)) t.push(iso(d) === hojeISO() ? 'atualizado às ' + hora(d) : 'atualizado em ' + doisDig(d.getDate()) + '/' + doisDig(d.getMonth() + 1) + ' às ' + hora(d));
  if (state.conferidoEm) t.push('conferido às ' + hora(state.conferidoEm));
  return t.length ? t : ['Dados do repositório'];
}
function pintarStatus() {
  const t = textosStatus();
  $('status-vivo').hidden = !(state.modo === 'arquivo' && !state.rascunho);
  trocar($('status'), t[giroStatus % t.length]);
}

/* destaques do placar: frases montadas com os números do momento */
const descrever = v => state.consultores.get(v.consultor).nome + ', ' + curto(v.valor) + (v.categoria !== 'outros' ? ' em ' + CATS[v.categoria].toLowerCase() : '') + (v.data ? ', ' + quando(v.data) : '');
const listaNatural = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l.join('');
function mensagens(r) {
  if (state.modo === 'carregando') return [];
  const c = state.config, n = state.consultores.size, m = [];
  if (r.total > 0) {
    const l = r.lideres[0];
    if (l) m.push(l.nome + ' lidera o ranking com ' + curto(l.valor));
    const e1 = r.equipes[0];
    if (e1 && e1.valor > 0) m.push(e1.sup ? e1.nome + ', time de ' + e1.sup.nome + ', está na frente entre as equipes com ' + curto(e1.valor) : e1.nome + ' está na frente entre as equipes com ' + curto(e1.valor));
    const u = r.feed.find(v => v.data);
    if (u) m.push('Última venda: ' + descrever(u));
    m.push(r.falta > 0 ? 'Faltam ' + curto(r.falta) + ' para a meta de ' + curto(c.meta) : 'Meta de ' + curto(c.meta) + ' batida');
    m.push(r.venderam + ' de ' + n + (r.venderam === 1 ? ' consultor já vendeu' : ' consultores já venderam') + ' neste ciclo');
    if (r.restantes > 0 && r.falta > 0) m.push('Para fechar a meta: ' + curto(r.falta / r.restantes) + ' por dia até ' + dataCurta(c.prazo));
    if (fraseSupervisao(r)) m.push(fraseSupervisao(r));
  } else if (n) {
    m.push('Placar zerado: a primeira venda do ciclo abre o ranking');
    m.push('Meta da franquia de ' + curto(c.meta) + (c.metaEquipe ? ' e ' + curto(c.metaEquipe) + ' por equipe' : ''));
    const eqs = r.equipes.filter(e => e.nome !== SEM_EQUIPE).map(e => e.nome);
    if (eqs.length > 1) m.push(n + ' consultores em ' + eqs.length + ' equipes: ' + listaNatural(eqs));
    if (fraseSupervisao(r)) m.push(fraseSupervisao(r));
  }
  return m;
}
function fraseSupervisao(r) {
  const l = r.equipes.filter(e => e.sup).map(e => e.sup.nome + ' (' + e.nome + ')');
  return l.length ? 'Supervisão: ' + listaNatural(l) : '';
}
let giroDestaque = 0;
function pintarDestaque(r) {
  const m = mensagens(r), alvo = $('destaque');
  alvo.closest('.destaque').hidden = !m.length;
  if (!m.length) return;
  if (trocar(alvo, m[giroDestaque % m.length])) maoVai($('destaque-mao'));
}

function pintar() {
  const c = state.config, r = calcular(), carregando = state.modo === 'carregando';
  app.dataset.modo = carregando ? 'carregando' : state.rascunho ? 'rascunho' : state.modo === 'demo' ? 'demo' : 'vivo';
  const editar = state.podeEditar && !carregando;

  pintarStatus();
  for (const id of ['btn-ajustes', 'btn-equipe', 'btn-venda']) $(id).hidden = !editar;
  $('unidade').textContent = c.unidade;

  pintarAvisos(editar);

  /* placar */
  contar($('total'), mostrado.total, r.total, v => nf.format(Math.round(v)));
  mostrado.total = r.total;
  $('meta').textContent = brl(c.meta);
  $('ciclo').textContent = c.ciclo ? ' · ' + c.ciclo : '';
  const pct = c.meta ? r.total / c.meta * 100 : 0;
  $('pct').textContent = pctTxt(Math.floor(pct * 10) / 10);
  $('regua-cheio').style.width = Math.min(pct, 100) + '%';

  const marcas = $('regua-marcas'); marcas.textContent = '';
  const passo = passoRegua(c.meta);
  for (let v = 0; v < c.meta - passo * 0.55; v += passo)
    marcas.append(el('span', { class: 'marca-t', style: 'left:' + (v / c.meta * 100) + '%' }, el('i'), el('b', { text: v === 0 ? '0' : compacto(v) })));
  marcas.append(el('span', { class: 'marca-t', style: 'left:100%' }, el('i'), el('b', { text: compacto(c.meta) })));

  const temRitmo = r.ideal != null && !carregando;
  $('regua').classList.toggle('sem-ritmo', !temRitmo);
  $('ritmo').hidden = !temRitmo;
  $('ritmo-txt').hidden = !temRitmo;
  if (temRitmo) {
    ritmoX = Math.min(r.ideal / c.meta, 1);
    $('ritmo').style.left = (ritmoX * 100) + '%';
    $('ritmo-txt').textContent = 'Ritmo esperado hoje · ' + curto(r.ideal);
    posicionarRitmo();
  }

  $('f-falta').textContent = r.falta > 0 ? brl(r.falta) : 'Meta batida';
  const nFalta = $('f-falta-n'); nFalta.className = '';
  if (temRitmo) {
    const dif = r.total - r.ideal;
    nFalta.textContent = curto(Math.abs(dif)) + (dif >= 0 ? ' acima do ritmo' : ' abaixo do ritmo');
    nFalta.className = dif >= 0 ? 'acima' : 'abaixo';
  } else nFalta.textContent = r.falta > 0 ? 'para fechar a meta' : 'passou ' + curto(r.total - c.meta) + ' da meta';

  if (r.falta <= 0) { $('f-ritmo').textContent = 'Concluído'; $('f-ritmo-n').textContent = 'meta da franquia fechada'; }
  else if (r.restantes > 0) {
    $('f-ritmo').textContent = curto(r.falta / r.restantes) + '/dia';
    $('f-ritmo-n').textContent = (r.restantes === 1 ? 'último dia' : r.restantes + ' dias') + ' até ' + dataCurta(c.prazo);
  } else if (r.restantes === 0) { $('f-ritmo').textContent = 'Ciclo encerrado'; $('f-ritmo-n').textContent = 'terminou em ' + dataCurta(c.prazo); }
  else { $('f-ritmo').textContent = 'Sem prazo'; $('f-ritmo-n').textContent = editar ? 'defina o fim do ciclo em Ajustes' : 'fim do ciclo não definido'; }

  $('f-meta').textContent = r.venderam + ' de ' + state.consultores.size;
  $('f-meta-n').textContent = 'consultores com venda no ciclo';
  $('f-cotas').textContent = nf.format(r.cotas);
  $('f-cotas-n').textContent = r.cotas ? 'ticket médio de ' + curto(r.total / r.cotas) : 'nenhuma venda no ciclo';

  pintarLista(r, editar, carregando);
  pintarEquipes(r, carregando);
  pintarFeed(r, editar, carregando);
  pintarMix(r);
  pintarDestaque(r);
  if (!carregando) { pintarFaixa(r); pintarTela(r); }
  if ($('dlg-equipe').open) pintarEquipe();
}

function pintarAvisos(editar) {
  const a = $('aviso'); a.textContent = '';
  if (state.modo === 'demo') {
    a.append(el('p', { text: 'Não foi possível ler data/ranking.json, então o painel abriu sem as vendas. Abra pelo endereço publicado ou por um servidor local.' }));
  } else if (state.config.exemplo) {
    if (state.confirmarLimpar) {
      a.append(el('p', { text: 'Apagar os consultores e as vendas de exemplo e começar do zero?' }),
        el('button', { class: 'btn principal', type: 'button', text: 'Apagar exemplos', onclick: limparExemplos }),
        el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => { state.confirmarLimpar = false; render(); } }));
    } else {
      a.append(el('p', { text: 'As vendas e os valores abaixo são exemplos para mostrar o painel funcionando. Troque pelos números reais da franquia.' }));
      if (editar) a.append(el('button', { class: 'btn', type: 'button', text: 'Limpar exemplos', onclick: () => { state.confirmarLimpar = true; render(); } }));
    }
  }
  a.hidden = !a.childNodes.length;

  const b = $('aviso-rascunho'); b.textContent = '';
  if (state.rascunho) {
    b.append(el('p', { text: 'As alterações estão salvas só neste navegador. Para publicar, baixe o ranking.json e substitua o arquivo da pasta data no repositório.' }),
      el('button', { class: 'btn principal', type: 'button', text: 'Baixar ranking.json', onclick: baixar }),
      el('button', { class: 'btn', type: 'button', text: 'Descartar alterações', onclick: descartar }));
  }
  b.hidden = !state.rascunho;
}

const linhasDom = new Map(), valorAntes = new Map(), posAntes = new Map();
function criarLinha() {
  const pos = el('span', { class: 'pos' }), av = el('span', { class: 'avatar', 'aria-hidden': 'true' });
  const nome = el('strong', { class: 'nome' }), sub = el('span', { class: 'sub' });
  const cheio = el('div', { class: 'barra-cheio' }), marcaMeta = el('i', { class: 'barra-meta' });
  const val = el('strong'), nota = el('span');
  /* a mão d'água só aparece na linha do líder (CSS) */
  const li = el('li', { class: 'linha' }, maoEl('linha-mao'), pos, av, el('div', { class: 'quem' }, nome, sub), el('div', { class: 'barra' }, cheio, marcaMeta), el('div', { class: 'valor' }, val, nota));
  li._p = { pos, av, nome, sub, cheio, marca: marcaMeta, val, nota };
  return li;
}

/* bolinha do consultor: as iniciais ficam sempre por baixo e a foto entra por cima quando termina de carregar;
   se a foto não carregar, ela some e as iniciais continuam ali */
const fotosRuins = new Set();
function pintarAvatar(av, l) {
  const foto = l.foto && !fotosRuins.has(l.foto) ? l.foto : '';
  const chave = foto + '|' + l.nome;
  if (av.dataset.chave === chave) return;
  av.dataset.chave = chave;
  av.classList.toggle('com-foto', !!foto);
  av.textContent = '';
  av.append(el('span', { class: 'av-ini', text: iniciais(l.nome) }));
  if (!foto) return;
  const img = el('img', { alt: '', width: 200, height: 200, decoding: 'async' });
  const pronta = () => img.classList.add('ok');
  img.addEventListener('load', pronta);
  img.addEventListener('error', () => { fotosRuins.add(foto); img.remove(); av.classList.remove('com-foto'); av.dataset.chave = '|' + l.nome; });
  img.src = foto;
  av.append(img);
  if (img.complete && img.naturalWidth) pronta();
}

function pintarLista(r, editar, carregando) {
  const c = state.config, lista = $('lista'), noCiclo = state.filtro === 'ciclo';
  $('legenda').hidden = true;
  lista.querySelectorAll('.vazio').forEach(n => n.remove());

  if (!r.linhas.length) {
    for (const n of linhasDom.values()) n.remove();
    linhasDom.clear(); valorAntes.clear(); posAntes.clear();
    const v = el('li', { class: 'vazio' });
    if (carregando) v.append(el('strong', { text: 'Carregando o ranking' }));
    else {
      v.append(el('strong', { text: 'Nenhum consultor cadastrado' }), el('span', { text: 'Cadastre a equipe e lance as vendas. O ranking se monta sozinho, do maior crédito vendido para o menor.' }));
      if (editar) v.append(el('button', { class: 'btn principal', type: 'button', text: 'Cadastrar consultores', onclick: abrirEquipe }));
    }
    lista.append(v);
    return;
  }

  const topo = new Map();
  for (const [id, n] of linhasDom) topo.set(id, n.getBoundingClientRect().top);
  const escala = r.linhas[0].valor || 1;          // barras proporcionais ao líder
  const vivos = new Set();

  r.linhas.forEach((l, i) => {
    vivos.add(l.id);
    let n = linhasDom.get(l.id);
    if (!n) { n = criarLinha(); linhasDom.set(l.id, n); }
    const p = n._p, lider = i === 0 && l.valor > 0;
    n.style.setProperty('--i', i);
    n.className = 'linha' + (i < 3 && l.valor > 0 ? ' top' : '') + (lider ? ' lider' : '');
    p.pos.textContent = l.valor > 0 ? i + 1 : '–';
    pintarAvatar(p.av, l);
    if (p.nome._t !== l.nome + '|' + !!l.cargo) { p.nome._t = l.nome + '|' + !!l.cargo; p.nome.textContent = l.nome; const s = seloVip(l); if (s) p.nome.append(s); }
    p.sub.textContent = '';
    if (rotulo(l)) p.sub.append(el('b', { class: 'eq', text: rotulo(l) }), ' · ');
    p.sub.append(l.cotas ? (l.cotas === 1 ? '1 cota' : l.cotas + ' cotas') + (l.ultima ? ' · última ' + quando(l.ultima) : '') : noCiclo ? 'sem venda no ciclo' : 'sem venda no período');
    p.cheio.style.width = (l.valor / escala * 100) + '%';
    p.marca.hidden = true;
    contarValor(p.val, l.valor);
    p.nota.className = '';
    p.nota.textContent = !noCiclo && r.somaFiltro ? pctTxt(Math.round(l.valor / r.somaFiltro * 100)) + ' do período' : '';
    lista.append(n);
    const antes = valorAntes.get(l.id), posAnt = posAntes.get(l.id);
    if (noCiclo && antes != null && l.valor > antes && !semMovimento) { n.classList.remove('pulsa'); void n.offsetWidth; n.classList.add('pulsa'); }
    /* subiu de posição com venda nova: selo verde com quantas posições ganhou */
    if (noCiclo && antes != null && l.valor > antes && posAnt != null && i < posAnt) seloSobe(n, posAnt - i);
    if (noCiclo) { valorAntes.set(l.id, l.valor); posAntes.set(l.id, i); }
  });
  for (const [id, n] of linhasDom) if (!vivos.has(id)) { n.remove(); linhasDom.delete(id); valorAntes.delete(id); posAntes.delete(id); }

  if (!semMovimento) for (const [id, n] of linhasDom) {
    const a = topo.get(id); if (a == null) continue;
    const d = a - n.getBoundingClientRect().top;
    if (Math.abs(d) > 1) n.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

const equipesDom = new Map();
function pintarEquipes(r, carregando) {
  const sec = $('sec-equipes'), lista = $('equipes');
  sec.hidden = carregando || !r.equipes.length;
  if (sec.hidden) return;
  const topo = new Map();
  for (const [nome, n] of equipesDom) topo.set(nome, n.getBoundingClientRect().top);
  const metaEq = state.config.metaEquipe, maior = metaEq || r.equipes[0].valor || 1, vivas = new Set();
  r.equipes.forEach((e, i) => {
    vivas.add(e.nome);
    let n = equipesDom.get(e.nome);
    if (!n) {
      const pos = el('span', { class: 'eq-pos' }), nome = el('strong', { class: 'eq-nome' }), sup = el('span', { class: 'eq-sup' }), sub = el('span', { class: 'eq-sub' }), val = el('strong'), pct = el('span'), cheio = el('i');
      /* bolinha da supervisão: foto recortada dentro de um anel que enche com a meta da equipe */
      const av = el('span', { class: 'avatar', 'aria-hidden': 'true' }), anel = el('span', { class: 'eq-av' }, av);
      n = el('li', { class: 'eq-linha' }, maoEl('eq-mao'), pos, anel, el('div', { class: 'eq-quem' }, nome, sup, sub), el('div', { class: 'eq-valor' }, val, pct), el('div', { class: 'eq-barra' }, cheio));
      n._p = { pos, anel, av, nome, sup, sub, val, pct, cheio };
      equipesDom.set(e.nome, n);
    }
    const p = n._p, lider = i === 0 && e.valor > 0;
    n.style.setProperty('--i', i + 2);
    n.classList.toggle('lider', lider);
    n.classList.toggle('com-sup', !!e.sup);
    p.pos.textContent = e.valor > 0 ? i + 1 : '–';
    p.nome.textContent = e.nome;
    p.anel.hidden = !e.sup;
    p.sup.hidden = !e.sup;
    if (e.sup) {
      pintarAvatar(p.av, e.sup);
      p.sup.textContent = '';
      p.sup.append(el('b', { text: e.sup.nome }), e.sup.cargo ? ' · ' + cargoTxt(e.sup.cargo) : '');
      p.anel.style.setProperty('--p', metaEq && e.nome !== SEM_EQUIPE ? Math.min(e.valor / metaEq * 100, 100).toFixed(2) : r.total ? (e.valor / r.total * 100).toFixed(2) : 0);
    }
    /* espaços fixos dentro de cada trecho: a quebra de linha só acontece entre os trechos */
    p.sub.textContent = [e.membros === 1 ? '1 consultor' : e.membros + ' consultores',
      e.cotas ? (e.cotas === 1 ? '1 cota' : e.cotas + ' cotas') : 'sem venda no ciclo',
      metaEq && e.nome !== SEM_EQUIPE ? (e.valor >= metaEq ? 'meta batida' : 'faltam ' + curto(metaEq - e.valor)) : ''].filter(Boolean).map(t => t.replace(/ /g, '\u00a0')).join(' · ');
    contarValor(p.val, e.valor);
    p.pct.textContent = metaEq && e.nome !== SEM_EQUIPE ? pctTxt(Math.floor(e.valor / metaEq * 1000) / 10) + ' de ' + curto(metaEq)
      : r.total ? pctTxt(Math.round(e.valor / r.total * 100)) + ' do total' : '';
    p.cheio.style.width = Math.min(e.valor / maior * 100, 100) + '%';
    lista.append(n);
  });
  for (const [nome, n] of equipesDom) if (!vivas.has(nome)) { n.remove(); equipesDom.delete(nome); }
  if (!semMovimento) for (const [nome, n] of equipesDom) {
    const a = topo.get(nome); if (a == null) continue;
    const d = a - n.getBoundingClientRect().top;
    if (Math.abs(d) > 1) n.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

/* chave estável de cada venda (mesma venda repetida ganha um número de ocorrência) */
function chaves(vendas) {
  const vistos = new Map();
  return vendas.map(v => { const k = v.consultor + '|' + v.valor + '|' + v.categoria + '|' + v.data; const n = (vistos.get(k) || 0) + 1; vistos.set(k, n); return k + '#' + n; });
}
let feedVisto = null;
function pintarFeed(r, editar, carregando) {
  const feed = $('feed'); feed.textContent = '';
  const itens = state.verTodas ? r.feed : r.feed.slice(0, 7);
  const ks = chaves([...r.feed].reverse()).reverse(), primeira = feedVisto === null;
  if (!carregando && primeira) feedVisto = new Set(ks);
  if (!r.feed.length) feed.append(el('li', {}, el('span', { class: 'f-sub', text: carregando ? 'Carregando' : 'Nenhuma venda lançada no ciclo ainda.' })));
  for (const v of itens) {
    const p = state.consultores.get(v.consultor);
    const sub = el('div', { class: 'f-sub' }, [v.categoria !== 'outros' ? CATS[v.categoria] : '', v.cotas > 1 ? v.cotas + ' cotas' : '', v.data ? quando(v.data) : 'sem data'].filter(Boolean).join(' · '));
    const confirmando = editar && state.confirmar === v.id;
    if (editar && !confirmando) sub.append(' · ', el('button', { class: 'btn texto', type: 'button', text: 'Remover', 'aria-label': 'Remover venda de ' + p.nome, onclick: () => { state.confirmar = v.id; render(); } }));
    const li = el('li', {}, el('div', {}, el('div', { class: 'f-nome', text: p.nome }), sub), el('div', { class: 'f-valor', text: brl(v.valor) }));
    if (confirmando) li.append(el('div', { class: 'f-acao' }, 'Remover esta venda?',
      el('button', { class: 'btn texto perigo', type: 'button', text: 'Remover', onclick: () => removerVenda(v) }),
      el('button', { class: 'btn texto', type: 'button', text: 'Manter', onclick: () => { state.confirmar = null; render(); } })));
    const k = ks[r.feed.indexOf(v)];
    if (feedVisto && !feedVisto.has(k)) { feedVisto.add(k); if (!primeira) li.classList.add('novo'); }
    feed.append(li);
  }
  const b = $('btn-todas');
  b.hidden = r.feed.length <= 7;
  b.textContent = state.verTodas ? 'Ver menos' : 'Ver todas (' + r.feed.length + ')';
}

function pintarMix(r) {
  const barra = $('mix-barra'), lista = $('mix'); barra.textContent = ''; lista.textContent = '';
  /* se nenhuma venda tem categoria, o bloco não tem o que mostrar */
  $('h-mix').closest('section').hidden = r.total > 0 && r.porCat.outros === r.total;
  for (const k of Object.keys(CATS)) {
    const v = r.porCat[k], p = r.total ? v / r.total * 100 : 0;
    if (k === 'outros' && !v) continue;
    if (v > 0) barra.append(el('i', { class: 'c-' + k, style: 'width:' + p + '%' }));
    lista.append(el('li', {}, el('i', { class: 'c-' + k }), el('div', { text: CATS[k] }), el('b', { text: curto(v) }), el('span', { text: pctTxt(Math.round(p)) })));
  }
}

let toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800);
}

/* ---------- carga dos dados ---------- */
/* ---------- faixa ao vivo ---------- */
const pecasMao = () => [1, 2, 3, 4].map(n => el('i', { class: 'm' + n }));
let faixaAss = '';
function itensFaixa(r) {
  const c = state.config, itens = [];
  if (r.total > 0) {
    itens.push(['Crédito vendido', curto(r.total) + ' de ' + curto(c.meta) + ' (' + pctTxt(Math.floor(r.total / c.meta * 1000) / 10) + ')']);
    /* equipes com a foto da supervisão; consultores e vendas com a foto de quem vendeu */
    r.equipes.filter(e => e.valor > 0).forEach((e, i) => itens.push([(i + 1) + 'º ' + e.nome, curto(e.valor) + (e.sup ? ' · time de ' + e.sup.nome : ''), e.sup && e.sup.foto]));
    r.lideres.slice(0, 5).forEach((l, i) => itens.push([(i + 1) + 'º ' + l.nome, curto(l.valor), l.foto]));
    r.feed.filter(v => v.data).slice(0, 4).forEach(v => itens.push(['Venda', descrever(v), state.consultores.get(v.consultor).foto]));
    if (r.falta > 0) itens.push(['Faltam', curto(r.falta) + ' para a meta da franquia']);
  } else {
    itens.push(['Meta da franquia', curto(c.meta)]);
    if (c.metaEquipe) itens.push(['Meta por equipe', curto(c.metaEquipe)]);
    r.equipes.filter(e => e.nome !== SEM_EQUIPE).forEach(e => itens.push([e.nome, e.membros + (e.membros === 1 ? ' consultor' : ' consultores') + (e.sup ? ' · supervisão de ' + e.sup.nome : ''), e.sup && e.sup.foto]));
    itens.push(['Placar zerado', 'a primeira venda do ciclo abre o ranking']);
  }
  return itens;
}
function pintarFaixa(r, forcar) {
  const itens = itensFaixa(r), ass = JSON.stringify(itens);
  if (!forcar && ass === faixaAss) return;
  faixaAss = ass;
  const trilho = $('faixa-trilho'), janela = trilho.parentNode;
  const item = ([forte, resto, foto]) => el('span', { class: 'fx' },
    foto && !fotosRuins.has(foto) ? el('img', { class: 'fx-foto', src: foto, alt: '', width: 64, height: 64, decoding: 'async' }) : el('span', { class: 'mao fx-mao' }, ...pecasMao()),
    el('b', { text: forte }), ' ' + resto);
  const grupo = el('div', { class: 'faixa-grupo' }, ...itens.map(item));
  trilho.textContent = ''; trilho.append(grupo);
  /* o grupo precisa ser mais largo que a janela para o laço não deixar buraco */
  const base = grupo.offsetWidth || 1;
  for (let w = base; w < janela.clientWidth + 40 && w < 20000; w += base) itens.forEach(i => grupo.append(item(i)));
  trilho.append(grupo.cloneNode(true));
  trilho.style.setProperty('--dur', Math.max(grupo.offsetWidth / 70, 12).toFixed(1) + 's');   // ~70 px por segundo
}
let faixaT = 0;
addEventListener('resize', () => { clearTimeout(faixaT); faixaT = setTimeout(() => { if (state.modo !== 'carregando') pintarFaixa(calcular(), true); }, 300); });

/* ---------- aviso de venda nova (chega pela conferência automática) ---------- */
const filaAviso = [];
let avisando = false;
function anunciar(v) { filaAviso.push(v); if (!avisando) proximoAviso(); }
function proximoAviso() {
  const v = filaAviso.shift();
  if (!v) { avisando = false; return; }
  const p = state.consultores.get(v.consultor);
  if (!p) { proximoAviso(); return; }
  avisando = true;
  const f = $('flash');
  $('flash-nome').textContent = p.nome;
  $('flash-info').textContent = [v.categoria !== 'outros' ? CATS[v.categoria] : '', rotulo(p)].filter(Boolean).join(' · ');
  $('flash-valor').textContent = brl(v.valor);
  f.getAnimations().forEach(a => a.cancel());
  f.hidden = false;
  maoVai($('flash-mao'));
  const fora = { transform: 'translate(-50%,-170%)', opacity: 0 }, dentro = { transform: 'translate(-50%,0)', opacity: 1 };
  if (!semMovimento && f.animate) f.animate([fora, dentro], { duration: 650, easing: 'cubic-bezier(.34,1.4,.6,1)', fill: 'both' });
  /* venda nova: chuva de mãozinhas saindo do aviso */
  setTimeout(() => { const b = f.getBoundingClientRect(); chuva(b.left + b.width / 2, b.bottom - 10, 46, 1.1); }, 380);
  setTimeout(() => {
    const fim = () => { f.hidden = true; f.getAnimations().forEach(a => a.cancel()); proximoAviso(); };
    if (semMovimento || !f.animate) { fim(); return; }
    f.animate([dentro, fora], { duration: 450, easing: 'cubic-bezier(.6,0,.8,.4)', fill: 'both' }).onfinish = fim;
  }, 5600);
}
function vendasNovas(antes, depois) {
  const ja = new Set(chaves(antes)), ks = chaves(depois);
  return depois.filter((v, i) => !ja.has(ks[i]));
}

async function buscar(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
const lerArquivo = () => buscar(ARQUIVO);

/* ---------- recarregar a TV de longe ----------
   O painel guarda o "sinal" que viu ao abrir e recarrega a página inteira quando ele muda:
   - planilha: a casinha embaixo do título "Recarregar" na aba Telão (conferida a cada 8 s);
   - arquivo: o campo "recarregar" do data/ranking.json (conferido a cada minuto).
   Serve para a TV pegar na hora uma versão nova do site, sem ninguém mexer nela. */
const sinais = new Map();
const VOLTA_TELAO = 'ranking-volta-telao';
let recarregando = false;
function sinal(origem, valor) {
  const v = valor == null ? '' : String(valor).trim().slice(0, 120);
  if (!sinais.has(origem)) { sinais.set(origem, v); return; }
  if (sinais.get(origem) !== v) recarregarTela();
}
function sinalDoArquivo(texto) {
  try { const o = JSON.parse(texto); sinal('arquivo', o && o.recarregar); } catch (e) { /* arquivo no meio de uma publicação: confere na próxima */ }
}
function recarregarTela() {
  if (recarregando) return;
  recarregando = true;
  /* volta no modo telão depois de recarregar */
  try { if (document.documentElement.classList.contains('tv')) sessionStorage.setItem(VOLTA_TELAO, '1'); } catch (e) { /* sem armazenamento: volta pelo #telao do endereço */ }
  location.reload();
}

/* ---------- planilha do Google ---------- */
let base = null, baseTexto = '', baseLidaEm = 0, fonteBoa = 0, ultimoCsv = '', ultimaMudanca = '';
function lerCsv(t) {
  const linhas = []; let linha = [], campo = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; continue; }
    if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}
/* "770000", "770.000", "R$ 770.000,00" e "1,300,000.00" viram reais */
function reais(s) {
  let t = String(s == null ? '' : s).trim().replace(/r\$|\s|\u00a0/gi, '').replace(/[^\d.,]/g, '');
  if (!t) return 0;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = /,\d{3}(,|$)/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (/\.\d{3}(\.|$)/.test(t)) t = t.replace(/\./g, '');
  const v = Number(t);
  return v > 0 ? Math.round(v) : 0;
}
/* "01/10/2026" (planilha em português) ou "2026-10-01" */
function dataIso(s) {
  const t = String(s == null ? '' : s).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  return m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31 ? m[3] + '-' + doisDig(m[2]) + '-' + doisDig(m[1]) : '';
}
const normNome = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
/* Aba Telão: uma linha por consultor, com Consultor, Equipe, Vendido e as colunas Venda 1, Venda 2...
   (cada casinha preenchida é uma venda). Metas e datas vêm na primeira linha, nas colunas com esses nomes.
   Também aceita uma planilha simples só com Consultor, Equipe e Vendido. */
function dadosDaPlanilha(texto, cadastro) {
  const linhas = lerCsv(texto).filter(l => l.some(c => c.trim()));
  const CAB = { nome: /^(consultor|consultora|nome|vendedor)/, equipe: /^(equipe|time)/, valor: /^(vendido|total|valor)/,
    meta: /^meta da franquia/, metaEquipe: /^meta (por|de cada|da) equipe/, inicio: /^inicio/, prazo: /^fim/,
    recarregar: /^(recarregar|atualizar (a )?(tv|tela|telao))/ };
  let ini = -1, col = null, colVendas = [];
  for (let i = 0; i < Math.min(linhas.length, 5) && !col; i++) {
    const achou = {}, vs = [];
    linhas[i].forEach((c, j) => { const t = normNome(c); if (/^venda \d+$/.test(t)) vs.push(j); else for (const k in CAB) if (achou[k] === undefined && CAB[k].test(t)) achou[k] = j; });
    if (achou.nome !== undefined && (achou.valor !== undefined || vs.length)) { ini = i + 1; col = achou; colVendas = vs; }
  }
  if (!col) return null;
  const b = cadastro && typeof cadastro === 'object' ? cadastro : {}, cfg = { ...(b.config || {}) }, primeira = linhas[ini] || [];
  for (const k of ['meta', 'metaEquipe']) if (col[k] !== undefined) { const v = reais(primeira[col[k]]); if (v > 0) cfg[k] = v; }
  for (const k of ['inicio', 'prazo']) if (col[k] !== undefined) { const d = dataIso(primeira[col[k]]); if (d) cfg[k] = d; }
  /* foto e identificador vêm do cadastro (data/ranking.json), pelo nome escrito igual */
  const doCadastro = new Map();
  for (const p of Array.isArray(b.consultores) ? b.consultores : []) if (p && p.nome) { doCadastro.set(normNome(p.nome), p); if (p.id) doCadastro.set('#' + p.id, p); }
  const consultores = [], vendas = [], usados = new Set();
  for (const l of linhas.slice(ini)) {
    const nome = String(l[col.nome] || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!nome) continue;
    const cad = doCadastro.get(normNome(nome)) || doCadastro.get('#' + slug(nome));
    const raizId = cad && cad.id ? String(cad.id) : slug(nome);
    let id = raizId, n = 2;
    while (usados.has(id)) id = raizId + '-' + n++;
    usados.add(id);
    const equipe = (col.equipe !== undefined ? String(l[col.equipe] || '').trim() : '') || (cad && cad.equipe) || '';
    consultores.push({ id, nome, equipe, ...(cad && cad.cargo ? { cargo: cad.cargo } : {}), ...(cad && cad.foto ? { foto: cad.foto } : {}) });
    if (colVendas.length) colVendas.forEach((j, k) => { const v = reais(l[j]); if (v > 0) vendas.push({ consultor: id, valor: v, chave: id + '|' + (k + 1) + '|' + v }); });
    else { const v = reais(l[col.valor]); if (v > 0) vendas.push({ consultor: id, valor: v, chave: id + '|total|' + v }); }
  }
  /* a supervisão de cada equipe também vem do cadastro */
  /* casinha embaixo do título "Recarregar": mudou o que está escrito nela, a TV recarrega o painel */
  const sinal = col.recarregar !== undefined ? String(primeira[col.recarregar] || '').trim() : '';
  return { config: { ...cfg, exemplo: false }, consultores, supervisores: Array.isArray(b.supervisores) ? b.supervisores : [], vendas, sinal };
}
/* A planilha não guarda o dia de cada venda: o painel anota o dia em que viu cada casinha nova pela
   primeira vez (guardado neste navegador). O que já estava lá na primeira leitura fica sem data. */
const VISTOS = 'ranking-planilha-vistos-v1';
function carimbar(vendas) {
  let mapa = null;
  try { mapa = JSON.parse(localStorage.getItem(VISTOS) || 'null'); } catch (e) { mapa = null; }
  const primeira = !mapa || typeof mapa !== 'object', hoje = hojeISO(), novo = {};
  if (primeira) mapa = {};
  for (const v of vendas) {
    const d = Object.prototype.hasOwnProperty.call(mapa, v.chave) ? mapa[v.chave] : primeira ? '' : hoje;
    novo[v.chave] = ehData(d) ? d : '';
    if (novo[v.chave]) v.data = novo[v.chave];
  }
  try { localStorage.setItem(VISTOS, JSON.stringify(novo)); } catch (e) { /* sem armazenamento local: as vendas ficam sem data */ }
}
async function lerPlanilha() {
  let erro = null;
  for (let i = fonteBoa; i < FONTES_PLANILHA.length; i++) {
    try {
      const t = await buscar(FONTES_PLANILHA[i]);
      if (!dadosDaPlanilha(t, base)) throw new Error('a aba lida não tem as colunas Consultor e Vendido');
      fonteBoa = i;
      return t;
    } catch (e) { erro = e; }
  }
  throw erro || new Error('link da planilha não reconhecido');
}
function dePlanilha(t) {
  const d = dadosDaPlanilha(t, base);
  if (!d) return null;
  carimbar(d.vendas);
  if (t !== ultimoCsv) { ultimoCsv = t; ultimaMudanca = new Date().toISOString(); }
  d.atualizadoEm = ultimaMudanca;
  return d;
}
/* com a planilha, o cadastro (fotos, ciclo) é relido de tempos em tempos; a "marca" junta os dois textos */
function guardarCadastro(json) {
  try { base = JSON.parse(json); baseTexto = json; } catch (e) { /* mantém o cadastro anterior */ }
  baseLidaEm = Date.now();
}
async function lerTudo() {
  if (!PLANILHA) { const t = await lerArquivo(); sinalDoArquivo(t); return { marca: t, dados: () => JSON.parse(t) }; }
  const reler = Date.now() - baseLidaEm > INTERVALO_CADASTRO;
  const [csv, json] = await Promise.all([lerPlanilha(), reler ? lerArquivo().catch(() => '') : '']);
  if (json) { guardarCadastro(json); sinalDoArquivo(json); }
  return { marca: csv + '\u0000' + baseTexto, dados: () => dePlanilha(csv) };
}
function carregarDemo() {
  aplicar({ config: { ...DEMO.config }, consultores: DEMO.consultores.map(([id, nome, equipe]) => ({ id, nome, equipe })), vendas: [] });
  state.modo = 'demo';
}
let conferindo = false;
async function conferir() {
  if (conferindo || document.hidden || state.rascunho || state.modo !== 'arquivo') return;
  conferindo = true;
  try {
    const l = await lerTudo();
    state.conferidoEm = new Date();
    if (l.marca === textoArquivo) { render(); return; }
    const d = l.dados(), antes = state.vendas;
    if (!d) return;
    if (PLANILHA) { sinal('planilha', d.sinal); if (recarregando) return; }
    const liderAntes = (calcular().lideres[0] || {}).id;
    textoArquivo = l.marca; aplicar(d); render();
    const novas = vendasNovas(antes, state.vendas);
    novas.slice(-3).forEach(anunciar);
    checarLider(liderAntes, novas.length);
  } catch (e) { /* falha de rede ou arquivo no meio de uma publicação: tenta de novo no próximo ciclo */ }
  finally { conferindo = false; }
}
/* a linha do alto da faixa enche no tempo exato entre uma conferência e a próxima */
function marcarConferencia() {
  const f = $('faixa');
  if (semMovimento || !f) return;
  f.style.setProperty('--confere', INTERVALO + 'ms');
  f.classList.remove('confere'); void f.offsetWidth; f.classList.add('confere');
}
/* tela de abertura: fica o tempo de a animação se completar e sai quando os dados chegam */
const telaLoad = $('load');
const ABERTURA = { barraDe: 350, barraPor: 2100, minimo: 2650 };
const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
(function contarCarga() {
  const pct = $('load-pct');
  if (!pct || !telaLoad.isConnected) return;
  const t = Math.min(Math.max((performance.now() - ABERTURA.barraDe) / ABERTURA.barraPor, 0), 1);
  pct.textContent = Math.round((semMovimento ? 1 : io(t)) * 100) + '%';
  if (t < 1) requestAnimationFrame(contarCarga);
})();
/* barras crescem do zero quando o painel aparece */
function reencher() {
  if (semMovimento) return;
  const barras = [$('regua-cheio'), ...document.querySelectorAll('#lista .barra-cheio, #equipes .eq-barra i')];
  barras.forEach(b => { b._alvo = b.style.width; b.style.transition = 'none'; b.style.width = '0%'; });
  void document.body.offsetWidth;
  barras.forEach((b, i) => { b.style.transition = 'width 1.5s cubic-bezier(.2,.8,.2,1) ' + (.45 + Math.min(i, 22) * .045) + 's'; b.style.width = b._alvo; });
  setTimeout(() => barras.forEach(b => { b.style.transition = ''; }), 3200);
  /* anel da supervisão enche junto com as barras das equipes */
  const aneis = [...document.querySelectorAll('#equipes .eq-av')];
  aneis.forEach(a => { a._alvo = a.style.getPropertyValue('--p'); a.style.transition = 'none'; a.style.setProperty('--p', 0); });
  void document.body.offsetWidth;
  aneis.forEach((a, i) => { a.style.transition = '--p 1.8s cubic-bezier(.2,.8,.2,1) ' + (.9 + i * .12) + 's'; a.style.setProperty('--p', a._alvo); });
  setTimeout(() => aneis.forEach(a => { a.style.transition = ''; }), 3600);
}
/* linhas entram em cascata */
function cascata() {
  if (semMovimento) return;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  document.querySelectorAll('#lista .linha').forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateX(-2.5rem)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 380 + Math.min(i, 16) * 48, easing: ease, fill: 'backwards' }));
  document.querySelectorAll('#equipes .eq-linha').forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(1.25rem)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 560 + i * 110, easing: ease, fill: 'backwards' }));
  /* a foto da supervisão salta para dentro do anel */
  document.querySelectorAll('#equipes .eq-av .avatar').forEach((a, i) => a.animate([{ opacity: 0, transform: 'scale(.3) rotate(-25deg)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 820 + i * 120, easing: 'cubic-bezier(.34,1.5,.6,1)', fill: 'backwards' }));
}
function depoisDeAbrir() { app.classList.add('entra'); entrar(telaAtual, true); }
function abrirPainel() {
  if (!telaLoad || !telaLoad.isConnected) return;
  $('load-pct').textContent = '100%';
  if (semMovimento || !telaLoad.animate) { telaLoad.remove(); depoisDeAbrir(); return; }
  const lam = $('load-lamina'), sai = 'cubic-bezier(.6,0,.8,.4)', corte = 'cubic-bezier(.7,0,.2,1)';
  $('load-in').animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-1.25rem) scale(.97)' }], { duration: 380, easing: sai, fill: 'forwards' });
  /* 1. a lâmina na cor de destaque cruza a tela na diagonal */
  lam.animate([{ clipPath: 'polygon(-60% 0,-60% 0,-85% 100%,-85% 100%)' }, { clipPath: 'polygon(-60% 0,160% 0,135% 100%,-85% 100%)' }], { duration: 640, delay: 160, easing: corte, fill: 'forwards' })
    .onfinish = () => {
      /* 2. a tela inteira se abre da esquerda para a direita, revelando o painel */
      telaLoad.style.background = 'transparent';
      depoisDeAbrir();
      telaLoad.animate([{ clipPath: 'polygon(-25% 0,200% 0,200% 100%,-50% 100%)' }, { clipPath: 'polygon(200% 0,200% 0,200% 100%,175% 100%)' }], { duration: 900, easing: corte, fill: 'forwards' })
        .onfinish = () => telaLoad.remove();
    };
}
async function iniciar() {
  render();
  const minimo = semMovimento ? 300 : ABERTURA.minimo;
  const espera = new Promise(r => setTimeout(r, Math.max(minimo - performance.now(), 0)));
  const demora = setTimeout(() => { if (telaLoad) { telaLoad.classList.add('espera'); $('load-pct').hidden = true; } }, 3400);
  let texto = '', dados = null;
  try { texto = await lerArquivo(); sinalDoArquivo(texto); dados = JSON.parse(texto); } catch (e) { dados = null; }
  if (PLANILHA) {
    /* a planilha manda; se ela não responder agora, abre com o data/ranking.json e tenta de novo a cada minuto */
    if (dados) guardarCadastro(texto);   // sem o cadastro agora, ele é relido na próxima conferência
    try { const csv = await lerPlanilha(); const d = dePlanilha(csv); if (d) { sinal('planilha', d.sinal); texto = csv + '\u0000' + baseTexto; dados = d; } }
    catch (e) { console.warn('Planilha não lida, usando data/ranking.json:', e.message); }
  }
  await espera;
  clearTimeout(demora);
  if (!dados) { carregarDemo(); render(); requestAnimationFrame(abrirPainel); iniciarGiros(); return; }
  textoArquivo = texto;
  let rasc = null;
  try { rasc = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { rasc = null; }
  if (!PLANILHA && rasc && rasc.base === marca(texto) && rasc.dados) { aplicar(rasc.dados); state.rascunho = true; }
  else { if (rasc) apagarRascunho(); aplicar(dados); }
  state.modo = 'arquivo';
  state.conferidoEm = new Date();
  render();
  requestAnimationFrame(abrirPainel);   // pinta primeiro, depois revela (as barras crescem do zero)
  iniciarGiros();
  marcarConferencia();
  setInterval(() => { marcarConferencia(); conferir(); }, INTERVALO);
  document.addEventListener('visibilitychange', conferir);
}

/* ---------- ações ---------- */
function mascara(input) {
  input.addEventListener('input', () => { const d = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12); input.value = d ? nf.format(Number(d)) : ''; });
}
const lerValor = input => Number(input.value.replace(/\D/g, '')) || 0;
['v-valor', 'a-meta', 'a-metac'].forEach(id => mascara($(id)));

document.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
addEventListener('hashchange', () => { state.podeEditar = !PLANILHA && location.hash === '#editar'; if (location.hash === '#telao') marcarTelao(true); render(); });

function abrirVenda() {
  if (!state.consultores.size) { abrirEquipe(); toast('Cadastre um consultor antes de lançar a venda.'); return; }
  const sel = $('v-consultor'), atual = sel.value; sel.textContent = '';
  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), pessoas = [...state.consultores.values()];
  const grupos = ordemEquipes();
  if (!grupos.length) pessoas.sort(porNome).forEach(p => sel.append(el('option', { value: p.id, text: p.nome })));
  else {
    if (pessoas.some(p => !p.equipe)) grupos.push('');
    for (const g of grupos) {
      const og = el('optgroup', { label: g || SEM_EQUIPE });
      pessoas.filter(p => p.equipe === g).sort(porNome).forEach(p => og.append(el('option', { value: p.id, text: p.nome })));
      sel.append(og);
    }
  }
  if (state.consultores.has(atual)) sel.value = atual;
  $('v-valor').value = ''; $('v-data').value = hojeISO(); $('v-erro').textContent = '';
  $('dlg-venda').showModal(); $('v-valor').focus();
}
$('btn-venda').addEventListener('click', abrirVenda);
$('v-atalhos').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('v-valor').value = nf.format(Number(b.dataset.v)); $('v-valor').focus(); });
$('form-venda').addEventListener('submit', e => {
  e.preventDefault();
  const valor = lerValor($('v-valor')), data = $('v-data').value, consultor = $('v-consultor').value;
  if (!valor) { $('v-erro').textContent = 'Informe o valor do crédito vendido.'; $('v-valor').focus(); return; }
  if (!ehData(data)) { $('v-erro').textContent = 'Escolha a data da venda.'; return; }
  const categoria = document.querySelector('input[name="v-cat"]:checked').value;
  state.vendas = [...state.vendas, normVenda({ consultor, valor, categoria, data })];
  $('dlg-venda').close();
  mudou('Venda lançada: ' + brl(valor) + ' para ' + state.consultores.get(consultor).nome);
});
function removerVenda(v) {
  state.confirmar = null;
  state.vendas = state.vendas.filter(x => x.id !== v.id);
  mudou('Venda removida');
}

function abrirEquipe() { state.confirmarEquipe = null; pintarEquipe(true); $('dlg-equipe').showModal(); $('n-nome').focus(); }
$('btn-equipe').addEventListener('click', abrirEquipe);
let assinaturaEquipe = '';
function pintarEquipe(forcar) {
  const ordemEq = ordemEquipes(), posEq = e => e ? ordemEq.indexOf(e) : ordemEq.length;
  const pessoas = [...state.consultores.values()].sort((a, b) => posEq(a.equipe) - posEq(b.equipe) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const ass = pessoas.map(p => p.id + ':' + p.nome + ':' + p.equipe).join('|') + '#' + state.confirmarEquipe;
  if (!forcar && ass === assinaturaEquipe) return;
  assinaturaEquipe = ass;
  const dl = $('lista-equipes'); dl.textContent = '';
  for (const e of ordemEq) dl.append(el('option', { value: e }));
  const ul = $('equipe'), ativo = document.activeElement, foco = ativo && ativo.dataset && ativo.dataset.pid ? '[data-pid="' + ativo.dataset.pid + '"][data-campo="' + ativo.dataset.campo + '"]' : null;
  ul.textContent = '';
  let grupo = null;
  for (const p of pessoas) {
    if (ordemEq.length && p.equipe !== grupo) { grupo = p.equipe; ul.append(el('li', { class: 'grupo', text: grupo || SEM_EQUIPE })); }
    const input = el('input', { type: 'text', value: p.nome, 'data-pid': p.id, 'data-campo': 'nome', 'aria-label': 'Nome de ' + p.nome, maxlength: '60', id: 'eq-' + p.id });
    input.addEventListener('change', () => {
      const novo = input.value.trim().replace(/\s+/g, ' ');
      if (!novo) { input.value = p.nome; return; }
      if (novo !== p.nome) { p.nome = novo; mudou('Nome atualizado'); }
    });
    const eq = el('input', { type: 'text', value: p.equipe, 'data-pid': p.id, 'data-campo': 'equipe', 'aria-label': 'Equipe de ' + p.nome, maxlength: '40', placeholder: 'Equipe', autocomplete: 'off' });
    eq.setAttribute('list', 'lista-equipes');
    eq.addEventListener('change', () => {
      const nova = limparEquipe(eq.value);
      if (nova !== p.equipe) { p.equipe = nova; mudou(nova ? p.nome + ' agora está em ' + nova : p.nome + ' ficou sem equipe'); pintarEquipe(); }
    });
    const li = el('li', {}, el('div', { class: 'campo c-nome' }, input), el('div', { class: 'campo c-equipe' }, eq),
      el('button', { class: 'btn', type: 'button', text: 'Remover', onclick: () => { state.confirmarEquipe = p.id; pintarEquipe(); } }));
    if (state.confirmarEquipe === p.id) {
      const n = state.vendas.filter(v => v.consultor === p.id).length;
      li.append(el('div', { class: 'conf' }, 'Remover ' + p.nome + (n ? ' e ' + (n === 1 ? 'a venda lançada?' : 'as ' + n + ' vendas lançadas?') : '?'),
        el('button', { class: 'btn texto perigo', type: 'button', text: 'Remover', onclick: () => {
          state.confirmarEquipe = null; state.consultores.delete(p.id);
          state.vendas = state.vendas.filter(v => v.consultor !== p.id);
          mudou(p.nome + ' saiu do ranking'); pintarEquipe();
        } }),
        el('button', { class: 'btn texto', type: 'button', text: 'Manter', onclick: () => { state.confirmarEquipe = null; pintarEquipe(); } })));
    }
    ul.append(li);
  }
  if (foco) { const alvo = ul.querySelector(foco); if (alvo) alvo.focus(); }
}
$('form-novo').addEventListener('submit', e => {
  e.preventDefault();
  const nome = $('n-nome').value.trim().replace(/\s+/g, ' '), equipe = limparEquipe($('n-equipe').value);
  if (!nome) { $('n-nome').focus(); return; }
  let base = slug(nome), id = base, i = 2;
  while (state.consultores.has(id)) id = base + '-' + i++;
  state.consultores.set(id, { id, nome, equipe });
  $('n-nome').value = '';
  mudou(nome + ' entrou no ranking' + (equipe ? ' (' + equipe + ')' : '')); pintarEquipe();
  $('n-nome').focus();
});

$('btn-ajustes').addEventListener('click', () => {
  const c = state.config;
  $('a-meta').value = nf.format(c.meta); $('a-metac').value = c.metaEquipe ? nf.format(c.metaEquipe) : '';
  $('a-unidade').value = c.unidade; $('a-ciclo').value = c.ciclo; $('a-inicio').value = c.inicio; $('a-prazo').value = c.prazo;
  $('a-erro').textContent = ''; $('dlg-ajustes').showModal();
});
$('form-ajustes').addEventListener('submit', e => {
  e.preventDefault();
  const meta = lerValor($('a-meta')), metaEquipe = lerValor($('a-metac')), inicio = $('a-inicio').value, prazo = $('a-prazo').value;
  if (!meta) { $('a-erro').textContent = 'Preencha a meta da franquia com um valor acima de zero.'; return; }
  if (inicio && prazo && prazo < inicio) { $('a-erro').textContent = 'O fim do ciclo precisa ser depois do início.'; return; }
  state.config = normConfig({ meta, metaEquipe, metaConsultor: state.config.metaConsultor, unidade: $('a-unidade').value, ciclo: $('a-ciclo').value, inicio, prazo, exemplo: state.config.exemplo });
  $('dlg-ajustes').close();
  mudou('Ajustes salvos');
});

function limparExemplos() {
  state.confirmarLimpar = false;
  state.consultores = new Map(); state.vendas = [];
  state.config = { ...state.config, ciclo: '', inicio: '', prazo: '', exemplo: false };
  mudou('Exemplos apagados. Cadastre os consultores e lance as vendas reais.');
}

document.querySelector('.filtro').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.filtro = b.dataset.filtro;
  document.querySelectorAll('.filtro button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
});
$('btn-todas').addEventListener('click', () => { state.verTodas = !state.verTodas; render(); });

/* tema: claro (padrão) ou vermelho; a escolha fica guardada neste navegador */
const raiz = document.documentElement;
function aplicarTema(tema, guardar) {
  const vermelho = tema === 'vermelho';
  if (vermelho) raiz.dataset.tema = 'vermelho'; else delete raiz.dataset.tema;
  $('btn-tema-txt').textContent = vermelho ? 'Tema claro' : 'Tema vermelho';
  $('btn-tema').setAttribute('aria-pressed', String(vermelho));
  $('cor-tema').setAttribute('content', vermelho ? '#ED1C24' : '#F5F3F3');
  if (guardar) { try { localStorage.setItem('ranking-tema', vermelho ? 'vermelho' : 'claro'); } catch (e) { /* sem armazenamento local: vale só nesta visita */ } }
  posicionarRitmo();
}
aplicarTema(raiz.dataset.tema === 'vermelho' ? 'vermelho' : 'claro', false);
$('btn-tema').addEventListener('click', () => aplicarTema(raiz.dataset.tema === 'vermelho' ? 'claro' : 'vermelho', true));

/* ---------- giros contínuos ---------- */
function iniciarGiros() {
  setInterval(() => { giroStatus++; pintarStatus(); }, 5000);
  setInterval(() => { giroDestaque++; if (state.modo !== 'carregando') pintarDestaque(calcular()); }, 6500);
  setInterval(onda, 45000);
  setInterval(giroSupervisao, 16000);
  /* mural: a frase grande troca a cada 4,2 s; pódio: uma chuvinha de mãozinhas sobre o 1º a cada 5 s */
  setInterval(() => { if (telaAtual === 'mural' && !trocando && !document.hidden) girarMural(); }, 4200);
  setInterval(() => { if (telaAtual === 'podio' && !trocando) confetePodio(.3); }, 5200);
  /* tarja de destaque: a primeira entra 14 s depois de abrir, as outras a cada ~26 s */
  tarja.proxima = performance.now() + TARJA.primeira;
  setInterval(tarjaTic, 1000);
}
relogio();
setInterval(relogio, 1000);
/* a cada 45 s os nomes e valores do ranking somem e voltam, de cima para baixo */
function onda() {
  if (semMovimento || document.hidden || document.querySelector('dialog[open]')) return;
  const quadros = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-45%)', offset: .42 }, { opacity: 0, transform: 'translateY(45%)', offset: .58 }, { opacity: 1, transform: 'none' }];
  document.querySelectorAll('#lista .linha').forEach((li, i) => li.querySelectorAll('.quem, .valor').forEach(x => x.animate(quadros, { duration: 1050, delay: i * 55, easing: 'ease-in-out' })));
  document.querySelectorAll('#equipes .eq-linha').forEach((li, i) => li.querySelectorAll('.eq-quem > *, .eq-valor > *').forEach(x => x.animate(quadros, { duration: 1050, delay: 300 + i * 120, easing: 'ease-in-out' })));
}
/* a cada 16 s as fotos da supervisão dão um giro de moeda, uma depois da outra */
function giroSupervisao() {
  if (semMovimento || document.hidden || document.querySelector('dialog[open]')) return;
  document.querySelectorAll('#equipes .eq-av .avatar').forEach((a, i) => a.animate([{ transform: 'perspective(14rem) rotateY(0)' }, { transform: 'perspective(14rem) rotateY(360deg)' }], { duration: 1100, delay: i * 180, easing: 'cubic-bezier(.7,0,.2,1)' }));
}
/* relógio da faixa ao vivo */
function relogio() {
  const h = $('faixa-hora'); if (!h) return;
  const d = new Date();
  rolar(h.firstChild, doisDig(d.getHours()));
  rolar(h.lastChild, doisDig(d.getMinutes()));
  contagem();
}

/* ==========================================================================
   Telas: Ranking (o painel de sempre), Pódio, Equipes e Mural.
   No telão giram sozinhas; no celular e no computador, troca pela barra de abas.
   Toda troca passa por uma cortina com a mão da Embracon se montando e o nome da franquia.
   ========================================================================== */
const TELAS = {
  ranking: { nome: 'Ranking', titulo: 'Ranking ao vivo' },
  podio: { nome: 'Pódio', titulo: 'Pódio do ciclo' },
  equipes: { nome: 'Equipes', titulo: 'Equipes' },
  mural: { nome: 'Mural', titulo: 'Mural da franquia' }
};
let telaAtual = 'ranking', equipeAtual = '', trocando = false;
const maoEl = cls => el('span', { class: 'mao ' + cls, 'aria-hidden': 'true' }, ...pecasMao());
const equipesValidas = r => r.equipes.filter(e => e.nome !== SEM_EQUIPE);
const cotasTxt = n => n === 1 ? '1 cota' : n + ' cotas';

/* ordem do giro no telão: ranking, pódio, uma tela por equipe (da que está na frente para trás) e mural */
function sequencia(r) {
  const s = [{ tela: 'ranking' }];
  if (r.pessoas.length) s.push({ tela: 'podio' });
  for (const e of equipesValidas(r)) s.push({ tela: 'equipes', equipe: e.nome });
  if (r.pessoas.length) s.push({ tela: 'mural' });
  return s;
}
function depoisDaAtual(r) {
  const s = sequencia(r);
  const i = s.findIndex(x => x.tela === telaAtual && (x.tela !== 'equipes' || x.equipe === equipeAtual));
  return s[(i + 1) % s.length];
}
function proximaTela() {
  const prox = depoisDaAtual(calcular());
  if (!irPara(prox.tela, { equipe: prox.equipe })) rolagem.fase = 'parado';
}

/* troca de tela; devolve false quando não há o que trocar */
function irPara(tela, opc = {}) {
  if (trocando || !TELAS[tela] || state.modo === 'carregando') return false;
  const r = calcular();
  let equipe = '';
  if (tela === 'equipes') {
    const eqs = equipesValidas(r);
    if (!eqs.length) return false;
    equipe = eqs.some(e => e.nome === opc.equipe) ? opc.equipe : eqs.some(e => e.nome === equipeAtual) ? equipeAtual : eqs[0].nome;
  }
  if (tela === telaAtual && equipe === equipeAtual) return false;
  const titulo = tela === 'equipes' ? equipe : TELAS[tela].titulo;
  if (semMovimento || !$('cortina').animate) { mostrarTela(tela, equipe); entrar(tela); return true; }
  cortina(titulo, !!opc.rapida, () => mostrarTela(tela, equipe), () => { acenar(); entrar(tela); });
  return true;
}
function mostrarTela(tela, equipe) {
  telaAtual = tela; equipeAtual = equipe || '';
  for (const s of document.querySelectorAll('#telas .tela')) s.hidden = s.dataset.tela !== tela;
  scrollTo(0, 0);
  rolagem.fase = 'parado';
  if (tela === 'ranking') posicionarRitmo();
  pintarTela(calcular(), true);
}
function pintarTela(r, forcar) {
  pintarPlacarzinho(r);
  if (telaAtual === 'podio') montarPodio(r, forcar);
  else if (telaAtual === 'equipes') montarEquipe(r, forcar);
  else if (telaAtual === 'mural') montarMural(r, forcar);
  pintarNav(r);
}
function entrar(tela, primeira) {
  if (semMovimento) return;
  if (tela === 'ranking') {
    reencher(); cascata();
    document.querySelectorAll('#tela-ranking .h2-mao').forEach((m, i) => setTimeout(() => maoVai(m), 300 + i * 220));
    if (!primeira) contar($('total'), 0, mostrado.total, v => nf.format(Math.round(v)));
  } else if (tela === 'podio') entrarPodio();
  else if (tela === 'equipes') entrarEquipe();
  else if (tela === 'mural') entrarMural();
}

/* ---------- barra de abas ---------- */
function pintarNav(r) {
  const tv = raiz.classList.contains('tv');
  document.querySelectorAll('#telas-nav .tn').forEach(b => {
    const ativo = b.dataset.tela === telaAtual;
    if (ativo) b.setAttribute('aria-current', 'page'); else { b.removeAttribute('aria-current'); progressoAba(0, b); }
    if (ativo && !b._ativo) maoVai(b.querySelector('.mao'));
    b._ativo = ativo;
  });
  const prox = $('tn-prox');
  if (!tv || !r) { prox.textContent = ''; prox._t = ''; return; }
  const p = depoisDaAtual(r), nome = p.tela === 'equipes' ? p.equipe : TELAS[p.tela].nome;
  if (prox._t === nome) return;
  prox._t = nome; prox.textContent = '';
  prox.append(maoEl('tn-prox-mao'), el('span', { text: 'A seguir' }), el('b', { text: nome }));
}
function progressoAba(p, botao) {
  const b = (botao || document.querySelector('#telas-nav .tn[aria-current] ')) ;
  const barra = b && b.querySelector('.tn-prog');
  if (!barra || barra._p === p) return;
  barra._p = p; barra.style.transform = 'scaleX(' + p.toFixed(4) + ')';
}
$('telas-nav').addEventListener('click', e => { const b = e.target.closest('.tn'); if (b) irPara(b.dataset.tela, { rapida: true }); });

/* ---------- cortina da troca de tela ----------
   1. a cortina vermelha entra na diagonal com mãozinhas voando junto
   2. a mão da Embracon se monta no centro, com um anel saindo dela, e o nome da tela sobe
   3. a tela troca por baixo e a cortina sai na mesma diagonal, revelando a tela nova */
function cortina(titulo, rapida, noMeio, noFim) {
  trocando = true;
  const c = $('cortina'), corte = 'cubic-bezier(.7,0,.2,1)', fechada = 'polygon(-60% 0,160% 0,135% 100%,-85% 100%)';
  c.getAnimations({ subtree: true }).forEach(a => a.cancel());
  $('cortina-rot').textContent = 'Franquia ' + state.config.unidade;
  const tit = $('cortina-tit'); tit._texto = null; tit.textContent = ''; trocar(tit, titulo);
  c.hidden = false;
  maoVai($('cortina-mao'));
  $('cortina-anel').animate([{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(2.6)' }], { duration: 1150, delay: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  c.querySelectorAll('.cortina-voo').forEach((m, i) => m.animate([
    { transform: 'translateX(-40vw) rotate(-28deg) scale(.8)', opacity: 0 }, { opacity: 1, offset: .18 }, { opacity: 1, offset: .8 },
    { transform: 'translateX(140vw) rotate(24deg) scale(1.1)', opacity: 0 }], { duration: 1650 + i * 140, delay: i * 85, easing: 'cubic-bezier(.35,.45,.25,1)', fill: 'both' }));
  $('cortina-in').animate([{ opacity: 0, transform: 'translateY(1.5rem) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  c.animate([{ clipPath: 'polygon(-60% 0,-60% 0,-85% 100%,-85% 100%)' }, { clipPath: fechada }], { duration: 580, easing: corte, fill: 'forwards' }).onfinish = () => {
    noMeio();
    setTimeout(() => {
      $('cortina-in').animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-1rem) scale(.98)' }], { duration: 300, easing: 'cubic-bezier(.6,0,.8,.4)', fill: 'forwards' });
      c.animate([{ clipPath: fechada }, { clipPath: 'polygon(160% 0,160% 0,135% 100%,135% 100%)' }], { duration: 720, delay: 120, easing: corte, fill: 'forwards' }).onfinish = () => {
        c.hidden = true; c.getAnimations({ subtree: true }).forEach(a => a.cancel()); trocando = false;
      };
      setTimeout(noFim, 330);   // a tela nova começa a se montar enquanto a cortina sai
    }, rapida ? 560 : 1300);
  };
}

/* ---------- chuva de mãozinhas e confete ---------- */
function chuva(x, y, n, forca) {
  if (semMovimento || document.hidden) return;
  const camada = $('chuva'), cores = ['var(--cf-1)', 'var(--cf-2)', 'var(--cf-3)'], f = forca || 1;
  for (let i = 0; i < n; i++) {
    const ehMao = Math.random() < .34, cor = cores[i % 3];
    const p = ehMao ? maoEl('cf-mao') : el('i', { class: 'cf-papel' });
    if (ehMao) { p.style.width = (14 + Math.random() * 18).toFixed(0) + 'px'; p.style.setProperty('--mao-cor', cor); }
    else { p.style.background = cor; if (Math.random() < .4) p.style.borderRadius = '50%'; }
    camada.append(p);
    const ang = (-90 + (Math.random() - .5) * 120) * Math.PI / 180, vel = f * (180 + Math.random() * 340);
    const dx = Math.cos(ang) * vel, dy = Math.sin(ang) * vel, queda = innerHeight - y + 60 + Math.random() * 80;
    const giro = (Math.random() - .5) * 1000, deriva = (Math.random() - .5) * 160;
    p.animate([
      { transform: `translate(${x}px,${y}px) rotate(0deg) scale(.6)`, opacity: 1, easing: 'cubic-bezier(.12,.75,.3,1)' },
      { transform: `translate(${x + dx}px,${y + dy}px) rotate(${giro * .3}deg) scale(1)`, opacity: 1, offset: .26, easing: 'cubic-bezier(.45,0,.75,.55)' },
      { transform: `translate(${x + dx * 1.35 + deriva}px,${y + queda}px) rotate(${giro}deg) scale(1)`, opacity: .85 }
    ], { duration: 2300 + Math.random() * 1700, fill: 'forwards' }).onfinish = () => p.remove();
  }
}

/* ---------- tela: pódio ---------- */
let podioAss = '';
function montarPodio(r, forcar) {
  const c = state.config, top = r.lideres;
  $('pd-rot').textContent = 'Pódio do ciclo' + (c.ciclo ? ' · ' + c.ciclo : '');
  const ass = JSON.stringify([top.slice(0, 8).map(p => [p.id, p.valor, p.cotas, p.foto, p.equipe]), r.total, r.venderam]);
  if (!forcar && ass === podioAss) return;
  podioAss = ass;
  const num = $('pd-num'); num.textContent = '';
  num.append(el('strong', { text: curto(r.total) }), el('span', { text: r.venderam + ' de ' + state.consultores.size + ' consultores já venderam' }));
  const palco = $('pd-palco'); palco.textContent = '';
  palco.append(el('div', { class: 'pd-raios', 'aria-hidden': 'true' }));
  for (const i of [1, 0, 2]) palco.append(lugarPodio(top[i], i + 1));
  const cola = $('pd-cola'); cola.textContent = '';
  top.slice(3, 8).forEach((p, k) => {
    const av = el('span', { class: 'avatar', 'aria-hidden': 'true' }); pintarAvatar(av, p);
    cola.append(el('li', { class: 'pd-chip' }, el('b', { class: 'pd-chip-pos', text: (k + 4) + 'º' }), av,
      el('span', { class: 'pd-chip-txt' }, el('strong', { text: p.nome }), el('span', { text: rotulo(p) || cotasTxt(p.cotas) })),
      el('strong', { class: 'pd-chip-v', text: curto(p.valor) })));
  });
  $('pd-cola-sec').hidden = top.length <= 3;
}
function lugarPodio(p, n) {
  const av = el('span', { class: 'avatar pd-av', 'aria-hidden': 'true' });
  if (p) pintarAvatar(av, p); else av.append(el('span', { class: 'av-ini', text: '?' }));
  const val = el('strong', { class: 'pd-valor', text: p ? brl(p.valor) : '—' });
  val._alvo = p ? p.valor : 0;
  return el('div', { class: 'pd-lugar pd-' + n + (p ? '' : ' vago') },
    el('div', { class: 'pd-pessoa' },
      n === 1 ? maoEl('pd-coroa') : null,
      el('div', { class: 'pd-foto' }, av),
      el('strong', { class: 'pd-nome' }, p ? p.nome : 'Vaga aberta', seloVip(p)),
      el('span', { class: 'pd-eq', text: p ? [rotulo(p), cotasTxt(p.cotas)].filter(Boolean).join(' · ') : 'a próxima venda entra aqui' }),
      val),
    el('div', { class: 'pd-bloco' }, maoEl('pd-bloco-mao'), el('span', { class: 'pd-pos', text: n + 'º' })));
}
function entrarPodio() {
  const ease = 'cubic-bezier(.2,.8,.2,1)', mola = 'cubic-bezier(.34,1.5,.6,1)', atraso = { 3: 0, 2: 280, 1: 600 };
  maoVai(document.querySelector('#tela-podio .tl-mao'));
  for (const n of [1, 2, 3]) {
    const l = document.querySelector('#pd-palco .pd-' + n); if (!l) continue;
    const d = 250 + atraso[n];
    l.querySelector('.pd-bloco').animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 950, delay: d, easing: ease, fill: 'backwards' });
    l.querySelector('.pd-pessoa').animate([{ opacity: 0, transform: 'translateY(-55%) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 950, delay: d + 420, easing: mola, fill: 'backwards' });
    const v = l.querySelector('.pd-valor');
    if (v._alvo) { v.textContent = brl(0); setTimeout(() => contar(v, 0, v._alvo, brl), d + 760); }
  }
  setTimeout(() => maoVai(document.querySelector('#pd-palco .pd-coroa')), 1500);
  document.querySelectorAll('#pd-cola .pd-chip').forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(1rem)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 1500 + i * 90, easing: ease, fill: 'backwards' }));
  setTimeout(() => { if (telaAtual === 'podio') confetePodio(1); }, 1650);
}
function confetePodio(forca) {
  const f = document.querySelector('#pd-palco .pd-1:not(.vago) .pd-foto');
  if (!f) return;
  const b = f.getBoundingClientRect();
  chuva(b.left + b.width / 2, b.top + b.height * .35, Math.round(64 * forca), 1.3 * Math.max(forca, .55));
}

/* ---------- tela: uma por equipe ----------
   À esquerda, quem supervisiona: foto num anel que enche com a meta da equipe e mãozinhas em órbita.
   À direita, os números da equipe e o time em ordem, do maior vendido para o menor. */
let equipeAss = '';
function montarEquipe(r, forcar) {
  const eqs = equipesValidas(r), corpo = $('te-corpo'), chips = $('te-chips');
  if (!eqs.length) { corpo.textContent = ''; chips.textContent = ''; equipeAss = ''; return; }
  const e = eqs.find(x => x.nome === equipeAtual) || eqs[0];
  equipeAtual = e.nome;
  const metaEq = state.config.metaEquipe, membros = r.pessoas.filter(p => (p.equipe || SEM_EQUIPE) === e.nome);
  const ass = JSON.stringify([e.nome, e.valor, e.cotas, metaEq, e.sup, membros.map(p => [p.id, p.valor, p.cotas, p.foto]), r.equipes.indexOf(e), r.total, eqs.map(x => x.nome)]);
  if (!forcar && ass === equipeAss) return;
  equipeAss = ass;
  chips.textContent = '';
  for (const x of eqs) chips.append(el('button', { type: 'button', class: 'te-chip', 'aria-pressed': String(x.nome === e.nome), text: x.nome, onclick: () => irPara('equipes', { equipe: x.nome, rapida: true }) }));

  const pos = r.equipes.indexOf(e) + 1, pct = metaEq ? e.valor / metaEq * 100 : r.total ? e.valor / r.total * 100 : 0;
  const pctLegivel = pctTxt(Math.floor(pct * 10) / 10);
  const anel = el('span', { class: 'te-anel', style: '--p:' + Math.min(pct, 100).toFixed(2) });
  const av = el('span', { class: 'avatar te-av', 'aria-hidden': 'true' });
  if (e.sup) pintarAvatar(av, e.sup); else av.append(maoEl('te-av-mao'));
  anel.append(av);
  const sup = el('aside', { class: 'te-sup' },
    el('span', { class: 'te-pos' }, maoEl('te-pos-mao'), e.valor > 0 ? pos + 'º entre as equipes' : 'Na largada'),
    el('div', { class: 'te-foto' }, el('div', { class: 'te-orbita', 'aria-hidden': 'true' }, maoEl('te-o te-o1'), maoEl('te-o te-o2'), maoEl('te-o te-o3')), anel),
    el('strong', { class: 'te-sup-nome', text: e.sup ? e.sup.nome : e.nome }),
    el('span', { class: 'te-sup-cargo', text: e.sup ? (e.sup.cargo ? e.sup.cargo + ' da equipe' : 'Supervisão da equipe') : 'Equipe sem supervisão cadastrada' }),
    el('p', { class: 'te-sup-meta' }, el('strong', { text: pctLegivel }), metaEq ? ' da meta da equipe' : ' do crédito da franquia'));

  const total = el('span', { class: 'te-total-v', text: nf.format(e.valor) }); total._alvo = e.valor;
  const cheio = el('div', { class: 'barra-cheio' }); cheio.style.width = Math.min(pct, 100) + '%';
  const falta = metaEq ? Math.max(metaEq - e.valor, 0) : 0, maior = (membros[0] && membros[0].valor) || 1;
  const fato = (rot, val, sub) => el('div', { class: 'te-fato' }, el('dt', { text: rot }), el('dd', {}, el('strong', { text: val }), el('span', { text: sub })));
  const regua = metaEq ? el('div', { class: 'te-meta' },
    el('div', { class: 'te-regua' }, cheio),
    el('div', { class: 'te-marcas' }, el('span', { text: 'R$ 0' }), el('span', { text: curto(metaEq / 2) }), el('span', { text: 'Meta ' + curto(metaEq) }))) : el('div', { class: 'te-meta' }, el('div', { class: 'te-regua' }, cheio));
  const dados = el('div', { class: 'te-dados' },
    el('div', { class: 'te-topo' },
      el('h2', { class: 'te-nome', id: 'te-nome', text: e.nome }),
      el('div', { class: 'te-num' },
        el('p', { class: 'te-total' }, el('small', { text: 'R$' }), total),
        el('p', { class: 'te-de' }, metaEq ? 'de ' + curto(metaEq) + ' de meta' : 'do total da franquia'))),
    regua,
    el('dl', { class: 'te-fatos' },
      fato('Falta vender', metaEq ? (falta > 0 ? curto(falta) : 'Meta batida') : '—', metaEq ? 'para fechar a meta' : 'sem meta por equipe'),
      fato('Já venderam', e.venderam + ' de ' + e.membros, 'consultores'),
      fato('Cotas', nf.format(e.cotas), e.cotas ? 'ticket médio ' + curto(e.valor / e.cotas) : 'nenhuma ainda'),
      fato('Na franquia', r.total ? pctTxt(Math.round(e.valor / r.total * 100)) : '0%', 'do crédito vendido')),
    el('ol', { class: 'te-time', style: 'grid-template-rows:repeat(' + Math.max(Math.ceil(membros.length / 2), 1) + ',auto)' }, ...membros.map((p, k) => pessoaEquipe(p, k, maior))));
  corpo.textContent = '';
  corpo.append(sup, dados);
}
function pessoaEquipe(p, k, maior) {
  const av = el('span', { class: 'avatar', 'aria-hidden': 'true' }); pintarAvatar(av, p);
  const cheio = el('i'); cheio.style.width = (p.valor / maior * 100) + '%';
  const destaque = k === 0 && p.valor > 0;
  return el('li', { class: 'te-p' + (destaque ? ' destaque' : '') + (p.valor > 0 ? '' : ' zerado') },
    el('span', { class: 'te-p-pos', text: p.valor > 0 ? k + 1 : '–' }), av,
    el('div', { class: 'te-p-txt' },
      el('strong', { class: 'te-p-nome' }, el('span', { text: p.nome }), seloVip(p), destaque ? maoEl('te-p-mao') : null),
      el('span', { class: 'te-p-sub', text: p.valor > 0 ? cotasTxt(p.cotas) : 'sem venda no ciclo' })),
    el('strong', { class: 'te-p-v', text: p.valor > 0 ? curto(p.valor) : 'R$ 0' }),
    el('span', { class: 'te-p-barra' }, cheio));
}
function encherDe0(b, dur, atraso) {
  const alvo = b.style.width;
  b.style.transition = 'none'; b.style.width = '0%'; void b.offsetWidth;
  b.style.transition = 'width ' + dur + 'ms cubic-bezier(.2,.8,.2,1) ' + atraso + 'ms'; b.style.width = alvo;
  setTimeout(() => { b.style.transition = ''; }, dur + atraso + 100);
}
function entrarEquipe() {
  const t = $('te-corpo'), ease = 'cubic-bezier(.2,.8,.2,1)', mola = 'cubic-bezier(.34,1.5,.6,1)';
  const anel = t.querySelector('.te-anel');
  if (anel) {
    anel.animate([{ transform: 'scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 150, easing: mola, fill: 'backwards' });
    const p = anel.style.getPropertyValue('--p');
    anel.style.transition = 'none'; anel.style.setProperty('--p', 0); void anel.offsetWidth;
    anel.style.transition = '--p 1.9s cubic-bezier(.2,.8,.2,1) .7s'; anel.style.setProperty('--p', p);
  }
  t.querySelectorAll('.te-o').forEach((m, i) => setTimeout(() => maoVai(m), 600 + i * 160));
  t.querySelectorAll('.te-pos-mao, .te-p-mao').forEach((m, i) => setTimeout(() => maoVai(m), 400 + i * 700));
  t.querySelectorAll('.te-sup-nome, .te-sup-cargo, .te-sup-meta').forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(.6rem)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 420 + i * 90, easing: ease, fill: 'backwards' }));
  const nome = t.querySelector('.te-nome');
  if (nome) nome.animate([{ clipPath: 'inset(-10% 100% -10% 0)', transform: 'translateX(-2%)' }, { clipPath: 'inset(-10% 0 -10% 0)', transform: 'none' }], { duration: 850, delay: 260, easing: ease, fill: 'backwards' });
  const tot = t.querySelector('.te-total-v');
  if (tot) { tot.textContent = '0'; setTimeout(() => contar(tot, 0, tot._alvo, v => nf.format(Math.round(v))), 420); }
  const regua = t.querySelector('.te-regua .barra-cheio'); if (regua) encherDe0(regua, 1600, 520);
  t.querySelectorAll('.te-fato').forEach((f, i) => f.animate([{ opacity: 0, transform: 'translateY(.8rem)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 560 + i * 80, easing: ease, fill: 'backwards' }));
  t.querySelectorAll('.te-p').forEach((p, i) => {
    p.animate([{ opacity: 0, transform: 'translateX(-1rem)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 760 + i * 60, easing: ease, fill: 'backwards' });
    const b = p.querySelector('.te-p-barra i'); if (b) encherDe0(b, 1200, 960 + i * 60);
  });
}

/* ---------- tela: mural ----------
   Uma frase que troca (slogans e números do momento) e duas faixas de retratos andando em sentidos
   opostos, com algumas frases curtas no meio. */
let muralAss = '', giroMural = 0;
function frasesMural(r) {
  return ['Porque sonhar não tem limites', 'Quem faz conta, faz consórcio', ...mensagens(r)].filter(f => f.length <= 84);
}
function girarMural(r) {
  const f = frasesMural(r || calcular());
  if (f.length && trocar($('mu-frase'), f[giroMural++ % f.length])) maoVai($('mu-mao'));
}
function montarMural(r, forcar) {
  const c = state.config, sups = [...state.supervisores.values()];
  $('mu-rot').textContent = 'Franquia ' + c.unidade + (c.ciclo ? ', ' + c.ciclo : '');
  const num = $('mu-num'); num.textContent = '';
  num.append(
    el('div', {}, el('dt', { text: 'vendidos no ciclo' }), el('dd', { text: curto(r.total) })),
    el('div', {}, el('dt', { text: 'consultores já venderam' }), el('dd', { text: r.venderam + ' de ' + state.consultores.size })));
  const ass = JSON.stringify([r.pessoas.map(p => [p.id, p.valor, p.foto]), sups.map(s => [s.nome, s.foto, s.equipe]), c.meta, c.ciclo]);
  if (!forcar && ass === muralAss) return;
  muralAss = ass;
  const box = $('mu-linhas'); box.textContent = '';
  const palavras = ['Porque sonhar não tem limites', 'Quem faz conta, faz consórcio', 'Meta de ' + curto(c.meta) + ' no ciclo', 'Franquia ' + c.unidade];
  const metade = Math.ceil(r.pessoas.length / 2);
  const a = intercalar(r.pessoas.slice(0, metade).map(cartaoPessoa), palavras.filter((_, i) => i % 2 === 0));
  const b = intercalar([...sups.map(cartaoSup), ...r.pessoas.slice(metade).map(cartaoPessoa)], palavras.filter((_, i) => i % 2 === 1));
  for (const [itens, dir] of [[a, 'esq'], [b, 'dir']]) {
    if (!itens.length) continue;
    const grupo = el('div', { class: 'mu-grupo' }, ...itens), trilho = el('div', { class: 'mu-trilho' }, grupo);
    box.append(el('div', { class: 'mu-linha mu-' + dir }, trilho));
    /* o grupo precisa ser mais largo que a tela para o laço não deixar buraco */
    const base = grupo.offsetWidth || 1;
    for (let w = base; w < box.clientWidth + 60 && w < 30000; w += base) itens.forEach(n => grupo.append(n.cloneNode(true)));
    trilho.append(grupo.cloneNode(true));
    trilho.style.setProperty('--dur', Math.max(grupo.offsetWidth / 34, 20).toFixed(1) + 's');   // ~34 px por segundo
  }
}
/* uma frase curta a cada quatro retratos */
function intercalar(cartas, palavras) {
  const out = [];
  cartas.forEach((c, i) => { out.push(c); if (i % 4 === 2 && palavras.length) out.push(cartaoPalavra(palavras[Math.floor(i / 4) % palavras.length])); });
  if (cartas.length < 3 && palavras.length) out.push(cartaoPalavra(palavras[0]));
  return out;
}
function fotoMural(nome, foto) {
  return foto && !fotosRuins.has(foto) ? el('img', { src: foto, alt: '', decoding: 'async', width: 200, height: 200 }) : el('span', { class: 'mu-ini', text: iniciais(nome) });
}
function cartaoPessoa(p) {
  return el('figure', { class: 'mu-card' + (p.valor > 0 ? ' vendeu' : '') },
    fotoMural(p.nome, p.foto),
    p.valor > 0 ? el('b', { class: 'mu-valor' }, maoEl('mu-valor-mao'), curto(p.valor)) : null,
    el('figcaption', {}, el('strong', {}, p.nome, seloVip(p)), el('span', { text: rotulo(p) })));
}
function cartaoSup(s) {
  return el('figure', { class: 'mu-card sup' },
    fotoMural(s.nome, s.foto),
    el('b', { class: 'mu-tag', text: 'Supervisão' }),
    el('figcaption', {}, el('strong', { text: s.nome }), el('span', { text: s.equipe })));
}
const cartaoPalavra = txt => el('div', { class: 'mu-palavra' }, maoEl('mu-palavra-mao'), el('span', { text: txt }));
function entrarMural() {
  const f = $('mu-frase'); f._texto = null; f.textContent = '';
  giroMural = 0; girarMural();
  document.querySelectorAll('#mu-num > div').forEach((d, i) => d.animate([{ opacity: 0, transform: 'translateY(.6rem)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 350 + i * 110, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  document.querySelectorAll('#mu-linhas .mu-linha').forEach((l, i) => l.animate([{ opacity: 0, transform: 'translateX(' + (i ? '-' : '') + '4rem)' }, { opacity: 1, transform: 'none' }], { duration: 1100, delay: 300 + i * 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}
let muralT = 0;
addEventListener('resize', () => { clearTimeout(muralT); muralT = setTimeout(() => { if (telaAtual === 'mural' && state.modo !== 'carregando') montarMural(calcular(), true); }, 300); });

/* ---------- telão: as telas giram sozinhas ----------
   Cada tela para no topo; se for mais alta que a TV, desce devagar até o fim, arrancando e
   freando suave, espera, volta ao topo numa subida com aceleração e a mão do logo acena.
   Depois a cortina com a mão da Embracon passa e entra a próxima tela. Tela que cabe inteira
   fica parada o tempo dela. Qualquer toque, rolagem ou tecla pausa por 20 s. */
const TEMPOS = {
  ranking: { espera: 9000, fundo: 6000, fixa: 30000 },
  podio: { espera: 9000, fundo: 4000, fixa: 20000 },
  equipes: { espera: 8000, fundo: 4000, fixa: 16000 },
  mural: { espera: 10000, fundo: 4000, fixa: 26000 }
};
const rolagem = { fase: 'parado', ate: 0, pausaAte: 0, y: 0, ult: 0, ini: 0, de: 0, dur: 0, telaIni: 0, total: 1 };
const suave = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function acenar() {
  if (semMovimento) return;
  const m = document.querySelector('.marca');
  m.classList.remove('acena'); void m.offsetWidth; m.classList.add('acena');
  clearTimeout(acenar.t); acenar.t = setTimeout(() => m.classList.remove('acena'), 2100);
}
function passoRolagem(t) {
  requestAnimationFrame(passoRolagem);
  if (!raiz.classList.contains('tv') || state.modo === 'carregando' || document.querySelector('dialog[open]') || t < rolagem.pausaAte || trocando) {
    if (!trocando) { rolagem.fase = 'parado'; progressoAba(0); }
    return;
  }
  const max = document.documentElement.scrollHeight - innerHeight, tempo = TEMPOS[telaAtual] || TEMPOS.ranking;
  if (rolagem.fase === 'parado') {
    rolagem.fase = 'espera'; rolagem.telaIni = t;
    if (max < 40) { rolagem.ate = t + tempo.fixa; rolagem.total = tempo.fixa; }
    else {
      rolagem.ate = t + tempo.espera;
      rolagem.total = tempo.espera + max / .045 * 1.08 + 1200 + tempo.fundo + Math.min(2600, Math.max(1300, max * .8)) + 1400;
    }
  } else if (rolagem.fase === 'espera' && t >= rolagem.ate) {
    if (max < 40) { rolagem.fase = 'fim'; proximaTela(); return; }
    rolagem.fase = 'desce'; rolagem.y = scrollY; rolagem.ult = t; rolagem.ini = t;
  } else if (rolagem.fase === 'desce') {
    // ~45 px por segundo, ganhando velocidade no primeiro 1,5 s e freando nos últimos 160 px
    const ritmo = Math.max(.12, Math.min(1, (t - rolagem.ini) / 1500, (max - rolagem.y) / 160));
    rolagem.y = Math.min(rolagem.y + Math.min(t - rolagem.ult, 100) * .045 * ritmo, max); rolagem.ult = t;
    scrollTo(0, rolagem.y);
    if (rolagem.y >= max - 1) { rolagem.fase = 'fundo'; rolagem.ate = t + tempo.fundo; }
  } else if (rolagem.fase === 'fundo' && t >= rolagem.ate) {
    rolagem.fase = 'sobe'; rolagem.ini = t; rolagem.de = scrollY; rolagem.dur = semMovimento ? 0 : Math.min(2600, Math.max(1300, scrollY * .8));
  } else if (rolagem.fase === 'sobe') {
    const k = rolagem.dur ? Math.min((t - rolagem.ini) / rolagem.dur, 1) : 1;
    scrollTo(0, Math.round(rolagem.de * (1 - suave(k))));
    if (k >= 1) { rolagem.fase = 'acena'; rolagem.ate = t + 1400; acenar(); }
  } else if (rolagem.fase === 'acena' && t >= rolagem.ate) { rolagem.fase = 'fim'; proximaTela(); return; }
  progressoAba(Math.min((t - rolagem.telaIni) / rolagem.total, 1));
}
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, () => { rolagem.pausaAte = performance.now() + 20000; }, { passive: true }));
requestAnimationFrame(passoRolagem);

let trava = null;
function marcarTelao(ligar) {
  raiz.classList.toggle('tv', ligar);
  $('btn-tv').textContent = ligar ? 'Sair do telão' : 'Modo telão';
  rolagem.fase = 'parado';
  pintarNav();
}
/* endereço com #telao abre direto no modo telão (sem tela cheia, que exige um clique) */
if (location.hash === '#telao') marcarTelao(true);
/* recarregada de longe (planilha ou ranking.json): volta no modo telão e tenta manter a tela ligada */
try {
  if (sessionStorage.getItem(VOLTA_TELAO)) {
    sessionStorage.removeItem(VOLTA_TELAO);
    marcarTelao(true);
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(t => { trava = t; }).catch(() => {});
  }
} catch (e) { /* sem armazenamento: segue normal */ }
$('btn-tv').addEventListener('click', async () => {
  const ligar = !raiz.classList.contains('tv');
  marcarTelao(ligar);
  try {
    if (ligar) { if (raiz.requestFullscreen) await raiz.requestFullscreen(); if (navigator.wakeLock) trava = await navigator.wakeLock.request('screen'); }
    else { if (document.fullscreenElement) await document.exitFullscreen(); if (trava) { await trava.release(); trava = null; } }
  } catch (e) { /* tela cheia e bloqueio de tela são opcionais */ }
  posicionarRitmo();
});

/* ==========================================================================
   Apetrechos de transmissão: dígitos que rolam, contagem regressiva do ciclo,
   tarja de destaque no canto (estilo TV), placar fixo e selo de quem subiu.
   ========================================================================== */

/* dígitos que rolam: cada caractere fica numa casinha; o que mudou sai por cima e o novo entra por baixo */
function rolar(caixa, texto) {
  if (!caixa || caixa._txt === texto) return;
  const antes = caixa._txt;
  caixa._txt = texto;
  if (antes == null || antes.length !== texto.length) {
    caixa.textContent = '';
    for (const ch of texto) caixa.append(el('span', { class: 'rl' + (/\d/.test(ch) ? '' : ' rl-sep') }, el('span', { class: 'rl-d', text: ch })));
    return;
  }
  for (let i = 0; i < texto.length; i++) {
    if (antes[i] === texto[i]) continue;
    const casa = caixa.children[i];
    while (casa.children.length > 1) casa.firstElementChild.remove();   // sobra de um giro que não terminou
    const velho = casa.firstElementChild, novo = el('span', { class: 'rl-d', text: texto[i] });
    casa.append(novo);
    if (semMovimento || document.hidden || !novo.animate) { if (velho) velho.remove(); continue; }
    if (velho) velho.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-105%)', opacity: 0 }], { duration: 460, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }).onfinish = () => velho.remove();
    novo.animate([{ transform: 'translateY(105%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, delay: 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  }
}

/* ---------- contagem regressiva até o fim do ciclo (23:59:59 do último dia) ---------- */
function contagem() {
  const caixa = $('faixa-conta'), c = state.config;
  if (!caixa) return;
  const fim = ehData(c.prazo) ? new Date(c.prazo + 'T23:59:59') : null;
  const resta = fim ? fim - Date.now() : -1;
  if (state.modo === 'carregando' || !(resta > 0)) { caixa.hidden = true; return; }
  if (caixa.hidden) { caixa.hidden = false; if (!semMovimento) { caixa.classList.remove('entra'); void caixa.offsetWidth; caixa.classList.add('entra'); } }
  const s = Math.floor(resta / 1000), d = Math.floor(s / 86400);
  const ultimo = c.prazo === hojeISO();
  const rot = ultimo ? (resta < 3600e3 ? 'Reta final' : 'Último dia') : 'Fim do ciclo';
  if ($('fc-rot').textContent !== rot) $('fc-rot').textContent = rot;
  caixa.classList.toggle('urgente', ultimo);
  rolar($('fc-num'), (d ? d + 'd ' : '') + doisDig(Math.floor(s % 86400 / 3600)) + ':' + doisDig(Math.floor(s % 3600 / 60)) + ':' + doisDig(s % 60));
}

/* ---------- placar fixo: aparece no alto quando o placar grande sai da tela ---------- */
let placarNaTela = true;
if ('IntersectionObserver' in window) new IntersectionObserver(es => { placarNaTela = es[es.length - 1].isIntersecting; pintarPlacarzinho(); }, { threshold: 0, rootMargin: '-40px 0px 0px 0px' }).observe(document.querySelector('#tela-ranking .placar'));
function pintarPlacarzinho(r) {
  const pz = $('placarzinho'); if (!pz) return;
  pz.classList.toggle('on', !placarNaTela && telaAtual === 'ranking' && state.modo !== 'carregando');
  if (!r) return;
  const c = state.config, pct = c.meta ? r.total / c.meta * 100 : 0;
  contarValor($('pz-total'), r.total);
  $('pz-pct').textContent = pctTxt(Math.floor(pct * 10) / 10);
  $('pz-cheio').style.width = Math.min(pct, 100) + '%';
}

/* ---------- selo de destaque da diretoria (quem tem cargo: CEO, proprietária) ----------
   roseta vermelha girando devagar, com a mão da Embracon no meio e um anel que pulsa */
function seloVip(p) {
  if (!p || !p.cargo) return null;
  return el('span', { class: 'vip', 'aria-hidden': 'true' }, maoEl('vip-mao'));
}

/* ---------- selo de quem subiu no ranking ---------- */
function seloSobe(li, n) {
  if (semMovimento) return;
  li.querySelectorAll('.sobe').forEach(s => s.remove());
  const s = el('span', { class: 'sobe', text: n === 1 ? '1 posição' : n + ' posições' });
  li.append(s);
  s.animate([{ opacity: 0, transform: 'translateY(.7rem) scale(.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 450, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  setTimeout(() => { if (!s.isConnected) return; s.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-.5rem)' }], { duration: 500, fill: 'forwards' }).onfinish = () => s.remove(); }, 15000);
}

/* ---------- tarja de destaque, estilo transmissão de TV ----------
   1. o rótulo vermelho abre da esquerda e o painel vem atrás, com uma lâmina vermelha cruzando
   2. a foto salta para dentro do anel, nome e informação sobem, o valor conta do zero
   3. a linha de baixo esvazia no tempo em que a tarja fica e ela sai pelo mesmo lado
   Gira entre: líder, quem está na cola, equipe na frente, última venda e quanto falta da meta.
   Quando uma venda troca o líder, entra uma tarja especial de novo líder, toda vermelha. */
const TARJA = { primeira: 14000, intervalo: 26000, fica: 7000 };
const tarja = { fila: [], giro: 0, proxima: 0, ativa: false, calma: 0, t: 0 };
const primeiroNome = n => String(n).trim().split(/\s+/)[0];
function podeTarja() {
  return !semMovimento && innerWidth > 992 && (telaAtual === 'ranking' || telaAtual === 'mural') && state.modo !== 'carregando' && !document.hidden && !trocando && !avisando
    && !document.querySelector('dialog[open]') && !(telaLoad && telaLoad.isConnected);
}
function conteudosTarja(r) {
  const c = state.config, l = r.lideres, lista = [];
  const pessoa = (rot, p, info, extra) => ({ rot, nome: p.nome, info, valor: p.valor, foto: p.foto, vip: !!p.cargo, ...extra });
  if (l[0]) lista.push(pessoa('Líder do ciclo', l[0], [rotulo(l[0]), cotasTxt(l[0].cotas)].filter(Boolean).join(' · ') + (l[1] ? ' · ' + curto(l[0].valor - l[1].valor) + ' à frente' : ''), { coroa: true }));
  const voltas = Math.max(Math.min(l.length, 5) - 1, 1), k = 1 + (Math.floor(tarja.giro / 5) % voltas);
  if (l[k]) {
    const dif = l[k - 1].valor - l[k].valor;
    lista.push(pessoa(k + 1 + 'º no ranking', l[k], dif > 0 ? 'faltam ' + curto(dif) + ' para passar ' + primeiroNome(l[k - 1].nome) : 'empatado com ' + primeiroNome(l[k - 1].nome)));
  }
  const eq = r.equipes.find(e => e.valor > 0 && e.nome !== SEM_EQUIPE);
  if (eq) lista.push({ rot: 'Equipe na frente', nome: eq.nome, valor: eq.valor, foto: eq.sup && eq.sup.foto,
    info: [eq.sup ? 'time de ' + eq.sup.nome : '', eq.venderam + ' de ' + eq.membros + ' já venderam'].filter(Boolean).join(' · ') });
  const v = r.feed.find(x => x.data), pv = v && state.consultores.get(v.consultor);
  if (pv) lista.push({ rot: 'Última venda', nome: pv.nome, valor: v.valor, foto: pv.foto, vip: !!pv.cargo, info: [v.categoria !== 'outros' ? CATS[v.categoria] : '', quando(v.data), rotulo(pv)].filter(Boolean).join(' · ') });
  if (c.meta && r.falta > 0) lista.push({ rot: 'Meta da franquia', nome: 'Faltam ' + curto(r.falta), valorTxt: pctTxt(Math.floor(r.total / c.meta * 1000) / 10),
    info: r.total > 0 ? curto(r.total) + ' vendidos de ' + curto(c.meta) : 'a primeira venda do ciclo abre o placar' });
  return lista;
}
function checarLider(antes, novas) {
  if (!novas || semMovimento) return;
  const r = calcular(), l = r.lideres[0];
  if (!l || !antes || l.id === antes) return;
  const ant = state.consultores.get(antes);
  tarja.fila = tarja.fila.filter(t => !t.novo);
  tarja.fila.unshift({ rot: 'Novo líder do ciclo', nome: l.nome, valor: l.valor, foto: l.foto, vip: !!l.cargo, coroa: true, novo: true,
    info: [rotulo(l), ant ? 'passou ' + primeiroNome(ant.nome) : ''].filter(Boolean).join(' · ') });
}
function tarjaTic() {
  const agora = performance.now();
  if (trocando) tarja.calma = agora + 3500;          // deixa a tela nova se montar antes
  if (tarja.ativa || agora < tarja.calma || !podeTarja()) return;
  if (!tarja.fila.length && agora < tarja.proxima) return;
  let t = tarja.fila.shift();
  if (!t) { const l = conteudosTarja(calcular()); t = l.length ? l[tarja.giro++ % l.length] : null; }
  if (t) mostrarTarja(t); else tarja.proxima = agora + TARJA.intervalo;
}
function mostrarTarja(t) {
  const box = $('tarja'), corpo = $('tarja-corpo'), foto = $('tarja-foto'), val = $('tarja-valor');
  const ease = 'cubic-bezier(.2,.8,.2,1)', corte = 'cubic-bezier(.7,0,.2,1)';
  tarja.ativa = true;
  box.getAnimations({ subtree: true }).forEach(a => a.cancel());
  box.classList.toggle('virou', !!t.novo);
  $('tarja-rot').textContent = t.rot;
  $('tarja-nome').textContent = t.nome;
  if (t.vip) $('tarja-nome').append(seloVip({ cargo: true }));
  $('tarja-info').textContent = t.info || '';
  foto.textContent = '';
  if (t.foto && !fotosRuins.has(t.foto)) foto.append(el('img', { src: t.foto, alt: '', width: 160, height: 160, decoding: 'async' }));
  else foto.append(maoEl('tarja-foto-mao'));
  if (t.coroa) foto.append(maoEl('tarja-coroa'));
  cancelAnimationFrame(val._q);
  val.textContent = t.valor != null ? brl(0) : t.valorTxt || '';
  box.hidden = false;

  $('tarja-rot-caixa').animate([{ clipPath: 'polygon(0 0,0 0,0 100%,0 100%)' }, { clipPath: 'polygon(0 0,100% 0,calc(100% - .8rem) 100%,0 100%)' }], { duration: 440, easing: corte, fill: 'both' });
  corpo.animate([{ clipPath: 'inset(-3rem 100% -3rem -3rem)' }, { clipPath: 'inset(-3rem -3rem -3rem -3rem)' }], { duration: 640, delay: 150, easing: corte, fill: 'both' });
  $('tarja-lamina').animate([{ transform: 'translateX(-130%) skewX(-24deg)' }, { transform: 'translateX(680%) skewX(-24deg)' }], { duration: 950, delay: 200, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' });
  foto.animate([{ transform: 'scale(.2) rotate(-35deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 720, delay: 440, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' });
  [$('tarja-nome'), $('tarja-info')].forEach((n, i) => n.animate([{ transform: 'translateY(1rem)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 580, delay: 540 + i * 120, easing: ease, fill: 'both' }));
  val.animate([{ transform: 'translateX(1.25rem)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 620, easing: ease, fill: 'both' });
  if (t.valor != null) setTimeout(() => contar(val, 0, t.valor, brl), 640);
  setTimeout(() => { maoVai($('tarja-mao')); maoVai(foto.querySelector('.tarja-coroa')); maoVai(foto.querySelector('.tarja-foto-mao')); }, 120);
  $('tarja-tempo').animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: TARJA.fica, delay: 800, easing: 'linear', fill: 'both' });
  /* novo líder: chuva de mãozinhas saindo da foto */
  if (t.novo) setTimeout(() => { const b = foto.getBoundingClientRect(); chuva(b.left + b.width / 2, b.top + b.height / 2, 44, 1.05); }, 760);
  clearTimeout(tarja.t);
  tarja.t = setTimeout(esconderTarja, 800 + TARJA.fica);
}
function esconderTarja() {
  const box = $('tarja'), corte = 'cubic-bezier(.7,0,.2,1)';
  const fim = () => { box.hidden = true; box.getAnimations({ subtree: true }).forEach(a => a.cancel()); tarja.ativa = false; tarja.proxima = performance.now() + TARJA.intervalo; };
  if (document.hidden || !box.animate) { fim(); return; }
  [$('tarja-nome'), $('tarja-info'), $('tarja-valor'), $('tarja-foto')].forEach(n => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }));
  $('tarja-corpo').animate([{ clipPath: 'inset(-3rem -3rem -3rem -3rem)' }, { clipPath: 'inset(-3rem 100% -3rem -3rem)' }], { duration: 520, delay: 120, easing: corte, fill: 'forwards' });
  $('tarja-rot-caixa').animate([{ clipPath: 'polygon(0 0,100% 0,calc(100% - .8rem) 100%,0 100%)' }, { clipPath: 'polygon(0 0,0 0,0 100%,0 100%)' }], { duration: 400, delay: 360, easing: corte, fill: 'forwards' }).onfinish = fim;
}

iniciar();
})();
