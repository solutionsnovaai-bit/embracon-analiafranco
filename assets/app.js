(() => {
'use strict';

/* Fonte dos dados:
   - com o link da planilha do Google em assets/config.js, as vendas, as metas e as datas vêm da
     aba Telão da planilha; do data/ranking.json continuam vindo a unidade, o nome do ciclo e as fotos;
   - sem o link, tudo vem do data/ranking.json (atualizado por commit, IA ou automação). Alterações
     feitas pela tela ficam só neste navegador até o arquivo ser baixado e substituído no repositório. */
const ARQUIVO = 'data/ranking.json';
const CHAVE = 'ranking-rascunho-v1';
const INTERVALO = 60000; // confere o arquivo a cada 60 s (útil no telão)
const PLANILHA = (window.RANKING_CONFIG && String(window.RANKING_CONFIG.planilha || '').trim()) || '';
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
    ['sueli-teixeira', 'Suli Teixeira', 'Esquadrão Alpha'], ['izabella-nascimento', 'Izabella Nascimento', 'Esquadrão Alpha'],
    ['alex-sandro', 'Alex Sandro', 'Artilheiros'], ['edvan-fernandes', 'Edvan Fernandes', 'Artilheiros'],
    ['enzo-santorelli', 'Enzo Santorelli', 'Artilheiros'], ['pedro-lucas', 'Pedro Lucas', 'Artilheiros'],
    ['ricardo-neves', 'Ricardo Neves', 'Artilheiros'], ['tamyres-reis', 'Tamyres Reis', 'Artilheiros'],
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
  vendas: [],                   // {id, ordem, consultor, valor, categoria, data}
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
    state.consultores.set(id, { id, nome, equipe: limparEquipe(p.equipe), foto: fotoValida(p.foto) });
  }
  state.vendas = (Array.isArray(d.vendas) ? d.vendas : []).filter(v => v && typeof v === 'object').map(normVenda);
  state.atualizadoEm = typeof d.atualizadoEm === 'string' ? d.atualizadoEm : '';
  state.confirmar = null;
}
function exportar() {
  return {
    atualizadoEm: new Date().toISOString(),
    config: { ...state.config },
    consultores: [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome, ...(p.equipe ? { equipe: p.equipe } : {}), ...(p.foto ? { foto: p.foto } : {}) })),
    vendas: [...state.vendas].sort((a, b) => a.ordem - b.ordem).map(v => ({ consultor: v.consultor, valor: v.valor, categoria: v.categoria, ...(v.data ? { data: v.data } : {}), ...(v.cotas > 1 ? { cotas: v.cotas } : {}) }))
  };
}
function textoJson(d) {
  const bloco = lista => lista.length ? '[\n' + lista.map(o => '    ' + JSON.stringify(o)).join(',\n') + '\n  ]' : '[]';
  return '{\n  "atualizadoEm": ' + JSON.stringify(d.atualizadoEm) + ',\n  "config": ' + JSON.stringify(d.config, null, 2).replace(/\n/g, '\n  ') +
    ',\n  "consultores": ' + bloco(d.consultores) + ',\n  "vendas": ' + bloco(d.vendas) + '\n}\n';
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
  const linhas = [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome, equipe: p.equipe, foto: p.foto, valor: 0, cotas: 0, ultima: '' }));
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
  const equipes = ordemEq.length ? [...porEquipe.values()].sort((a, b) => b.valor - a.valor || a.ordem - b.ordem) : [];

  let ideal = null, restantes = null;
  if (c.prazo) restantes = Math.max(dias(hoje, c.prazo) + 1, 0);
  if (c.inicio && c.prazo && c.prazo >= c.inicio) {
    const totalDias = dias(c.inicio, c.prazo) + 1;
    const passados = Math.min(Math.max(dias(c.inicio, hoje) + 1, 0), totalDias);
    ideal = c.meta * passados / totalDias;
  }
  const feed = [...ciclo].sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.ordem - a.ordem);
  const lideres = [...state.consultores.values()].map(p => ({ nome: p.nome, equipe: p.equipe, valor: cicloPor.get(p.id) || 0 }))
    .filter(l => l.valor > 0).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { total, porCat, linhas, equipes, lideres, venderam, ideal, restantes, feed, cotas: ciclo.reduce((s, v) => s + v.cotas, 0), falta: Math.max(c.meta - total, 0), somaFiltro: base.reduce((s, v) => s + v.valor, 0) };
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
    if (r.equipes.length && r.equipes[0].valor > 0) m.push(r.equipes[0].nome + ' está na frente entre as equipes com ' + curto(r.equipes[0].valor));
    const u = r.feed.find(v => v.data);
    if (u) m.push('Última venda: ' + descrever(u));
    m.push(r.falta > 0 ? 'Faltam ' + curto(r.falta) + ' para a meta de ' + curto(c.meta) : 'Meta de ' + curto(c.meta) + ' batida');
    m.push(r.venderam + ' de ' + n + (r.venderam === 1 ? ' consultor já vendeu' : ' consultores já venderam') + ' neste ciclo');
    if (r.restantes > 0 && r.falta > 0) m.push('Para fechar a meta: ' + curto(r.falta / r.restantes) + ' por dia até ' + dataCurta(c.prazo));
  } else if (n) {
    m.push('Placar zerado: a primeira venda do ciclo abre o ranking');
    m.push('Meta da franquia de ' + curto(c.meta) + (c.metaEquipe ? ' e ' + curto(c.metaEquipe) + ' por equipe' : ''));
    const eqs = r.equipes.filter(e => e.nome !== SEM_EQUIPE).map(e => e.nome);
    if (eqs.length > 1) m.push(n + ' consultores em ' + eqs.length + ' equipes: ' + listaNatural(eqs));
  }
  return m;
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
  if (!carregando) pintarFaixa(r);
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

const linhasDom = new Map(), valorAntes = new Map();
function criarLinha() {
  const pos = el('span', { class: 'pos' }), av = el('span', { class: 'avatar', 'aria-hidden': 'true' });
  const nome = el('strong', { class: 'nome' }), sub = el('span', { class: 'sub' });
  const cheio = el('div', { class: 'barra-cheio' }), marcaMeta = el('i', { class: 'barra-meta' });
  const val = el('strong'), nota = el('span');
  const li = el('li', { class: 'linha' }, pos, av, el('div', { class: 'quem' }, nome, sub), el('div', { class: 'barra' }, cheio, marcaMeta), el('div', { class: 'valor' }, val, nota));
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
    linhasDom.clear(); valorAntes.clear();
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
    p.nome.textContent = l.nome;
    p.sub.textContent = '';
    if (l.equipe) p.sub.append(el('b', { class: 'eq', text: l.equipe }), ' · ');
    p.sub.append(l.cotas ? (l.cotas === 1 ? '1 cota' : l.cotas + ' cotas') + (l.ultima ? ' · última ' + quando(l.ultima) : '') : noCiclo ? 'sem venda no ciclo' : 'sem venda no período');
    p.cheio.style.width = (l.valor / escala * 100) + '%';
    p.marca.hidden = true;
    p.val.textContent = brl(l.valor);
    p.nota.className = '';
    p.nota.textContent = !noCiclo && r.somaFiltro ? pctTxt(Math.round(l.valor / r.somaFiltro * 100)) + ' do período' : '';
    lista.append(n);
    const antes = valorAntes.get(l.id);
    if (noCiclo && antes != null && l.valor > antes && !semMovimento) { n.classList.remove('pulsa'); void n.offsetWidth; n.classList.add('pulsa'); }
    if (noCiclo) valorAntes.set(l.id, l.valor);
  });
  for (const [id, n] of linhasDom) if (!vivos.has(id)) { n.remove(); linhasDom.delete(id); valorAntes.delete(id); }

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
      const pos = el('span', { class: 'eq-pos' }), nome = el('strong'), sub = el('span'), val = el('strong'), pct = el('span'), cheio = el('i');
      n = el('li', { class: 'eq-linha' }, pos, el('div', { class: 'eq-quem' }, nome, sub), el('div', { class: 'eq-valor' }, val, pct), el('div', { class: 'eq-barra' }, cheio));
      n._p = { pos, nome, sub, val, pct, cheio };
      equipesDom.set(e.nome, n);
    }
    const p = n._p, lider = i === 0 && e.valor > 0;
    n.style.setProperty('--i', i + 2);
    n.classList.toggle('lider', lider);
    p.pos.textContent = e.valor > 0 ? i + 1 : '–';
    p.nome.textContent = e.nome;
    /* espaços fixos dentro de cada trecho: a quebra de linha só acontece entre os trechos */
    p.sub.textContent = [e.membros === 1 ? '1 consultor' : e.membros + ' consultores',
      e.cotas ? (e.cotas === 1 ? '1 cota' : e.cotas + ' cotas') : 'sem venda no ciclo',
      metaEq && e.nome !== SEM_EQUIPE ? (e.valor >= metaEq ? 'meta batida' : 'faltam ' + curto(metaEq - e.valor)) : ''].filter(Boolean).map(t => t.replace(/ /g, '\u00a0')).join(' · ');
    p.val.textContent = brl(e.valor);
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
    r.equipes.filter(e => e.valor > 0).forEach((e, i) => itens.push([(i + 1) + 'º ' + e.nome, curto(e.valor)]));
    r.lideres.slice(0, 5).forEach((l, i) => itens.push([(i + 1) + 'º ' + l.nome, curto(l.valor)]));
    r.feed.filter(v => v.data).slice(0, 4).forEach(v => itens.push(['Venda', descrever(v)]));
    if (r.falta > 0) itens.push(['Faltam', curto(r.falta) + ' para a meta da franquia']);
  } else {
    itens.push(['Meta da franquia', curto(c.meta)]);
    if (c.metaEquipe) itens.push(['Meta por equipe', curto(c.metaEquipe)]);
    r.equipes.filter(e => e.nome !== SEM_EQUIPE).forEach(e => itens.push([e.nome, e.membros + (e.membros === 1 ? ' consultor' : ' consultores')]));
    itens.push(['Placar zerado', 'a primeira venda do ciclo abre o ranking']);
  }
  return itens;
}
function pintarFaixa(r, forcar) {
  const itens = itensFaixa(r), ass = JSON.stringify(itens);
  if (!forcar && ass === faixaAss) return;
  faixaAss = ass;
  const trilho = $('faixa-trilho'), janela = trilho.parentNode;
  const item = ([forte, resto]) => el('span', { class: 'fx' }, el('span', { class: 'mao fx-mao' }, ...pecasMao()), el('b', { text: forte }), ' ' + resto);
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
  $('flash-info').textContent = [v.categoria !== 'outros' ? CATS[v.categoria] : '', p.equipe].filter(Boolean).join(' · ');
  $('flash-valor').textContent = brl(v.valor);
  f.getAnimations().forEach(a => a.cancel());
  f.hidden = false;
  maoVai($('flash-mao'));
  const fora = { transform: 'translate(-50%,-170%)', opacity: 0 }, dentro = { transform: 'translate(-50%,0)', opacity: 1 };
  if (!semMovimento && f.animate) f.animate([fora, dentro], { duration: 650, easing: 'cubic-bezier(.34,1.4,.6,1)', fill: 'both' });
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

/* ---------- planilha do Google ---------- */
let base = null, fonteBoa = 0, ultimoCsv = '', ultimaMudanca = '';
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
    meta: /^meta da franquia/, metaEquipe: /^meta (por|de cada|da) equipe/, inicio: /^inicio/, prazo: /^fim/ };
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
    consultores.push({ id, nome, equipe, ...(cad && cad.foto ? { foto: cad.foto } : {}) });
    if (colVendas.length) colVendas.forEach((j, k) => { const v = reais(l[j]); if (v > 0) vendas.push({ consultor: id, valor: v, chave: id + '|' + (k + 1) + '|' + v }); });
    else { const v = reais(l[col.valor]); if (v > 0) vendas.push({ consultor: id, valor: v, chave: id + '|total|' + v }); }
  }
  return { config: { ...cfg, exemplo: false }, consultores, vendas };
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
/* com a planilha, o cadastro (fotos, ciclo) é relido a cada conferência; a "marca" junta os dois textos */
async function lerTudo() {
  if (!PLANILHA) { const t = await lerArquivo(); return { marca: t, dados: () => JSON.parse(t) }; }
  const [csv, json] = await Promise.all([lerPlanilha(), lerArquivo().catch(() => '')]);
  return { marca: csv + '\u0000' + json, dados: () => { if (json) { try { base = JSON.parse(json); } catch (e) { /* mantém o cadastro anterior */ } } return dePlanilha(csv); } };
}
function carregarDemo() {
  aplicar({ config: { ...DEMO.config }, consultores: DEMO.consultores.map(([id, nome, equipe]) => ({ id, nome, equipe })), vendas: [] });
  state.modo = 'demo';
}
async function conferir() {
  if (document.hidden || state.rascunho || state.modo !== 'arquivo') return;
  try {
    const l = await lerTudo();
    state.conferidoEm = new Date();
    if (l.marca === textoArquivo) { render(); return; }
    const d = l.dados(), antes = state.vendas;
    if (!d) return;
    textoArquivo = l.marca; aplicar(d); render();
    vendasNovas(antes, state.vendas).slice(-3).forEach(anunciar);
  } catch (e) { /* falha de rede ou arquivo no meio de uma publicação: tenta de novo no próximo ciclo */ }
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
}
/* linhas entram em cascata */
function cascata() {
  if (semMovimento) return;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  document.querySelectorAll('#lista .linha').forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateX(-2.5rem)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 380 + Math.min(i, 16) * 48, easing: ease, fill: 'backwards' }));
  document.querySelectorAll('#equipes .eq-linha').forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(1.25rem)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 560 + i * 110, easing: ease, fill: 'backwards' }));
}
function depoisDeAbrir() { app.classList.add('entra'); reencher(); cascata(); }
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
  try { texto = await lerArquivo(); dados = JSON.parse(texto); } catch (e) { dados = null; }
  if (PLANILHA) {
    /* a planilha manda; se ela não responder agora, abre com o data/ranking.json e tenta de novo a cada minuto */
    base = dados;
    try { const csv = await lerPlanilha(); const d = dePlanilha(csv); if (d) { texto = csv + '\u0000' + texto; dados = d; } }
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
  setInterval(conferir, INTERVALO);
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
}
/* a cada 45 s os nomes e valores do ranking somem e voltam, de cima para baixo */
function onda() {
  if (semMovimento || document.hidden || document.querySelector('dialog[open]')) return;
  const quadros = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-45%)', offset: .42 }, { opacity: 0, transform: 'translateY(45%)', offset: .58 }, { opacity: 1, transform: 'none' }];
  document.querySelectorAll('#lista .linha').forEach((li, i) => li.querySelectorAll('.quem, .valor').forEach(x => x.animate(quadros, { duration: 1050, delay: i * 55, easing: 'ease-in-out' })));
  document.querySelectorAll('#equipes .eq-linha').forEach((li, i) => li.querySelectorAll('.eq-quem, .eq-valor').forEach(x => x.animate(quadros, { duration: 1050, delay: 300 + i * 120, easing: 'ease-in-out' })));
}

/* ---------- telão: a página rola sozinha para mostrar todo o ranking ----------
   Para no topo e desce devagar até o fim, arrancando e freando suave. Espera, volta ao
   topo numa subida com aceleração e, ao chegar, a mão do logo acena. Qualquer toque,
   rolagem ou tecla pausa por 20 s. */
const rolagem = { fase: 'parado', ate: 0, pausaAte: 0, y: 0, ult: 0, ini: 0, de: 0, dur: 0 };
const suave = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function acenar() {
  if (semMovimento) return;
  const m = document.querySelector('.marca');
  m.classList.remove('acena'); void m.offsetWidth; m.classList.add('acena');
  clearTimeout(acenar.t); acenar.t = setTimeout(() => m.classList.remove('acena'), 2100);
}
function passoRolagem(t) {
  requestAnimationFrame(passoRolagem);
  if (!raiz.classList.contains('tv') || state.modo === 'carregando' || document.querySelector('dialog[open]') || t < rolagem.pausaAte) { rolagem.fase = 'parado'; return; }
  const max = document.documentElement.scrollHeight - innerHeight;
  if (max < 40) return;
  if (rolagem.fase === 'parado') { rolagem.fase = 'espera'; rolagem.ate = t + 9000; }
  else if (rolagem.fase === 'espera' && t >= rolagem.ate) { rolagem.fase = 'desce'; rolagem.y = scrollY; rolagem.ult = t; rolagem.ini = t; }
  else if (rolagem.fase === 'desce') {
    // ~45 px por segundo, ganhando velocidade no primeiro 1,5 s e freando nos últimos 160 px
    const ritmo = Math.max(.12, Math.min(1, (t - rolagem.ini) / 1500, (max - rolagem.y) / 160));
    rolagem.y = Math.min(rolagem.y + Math.min(t - rolagem.ult, 100) * .045 * ritmo, max); rolagem.ult = t;
    scrollTo(0, rolagem.y);
    if (rolagem.y >= max - 1) { rolagem.fase = 'fundo'; rolagem.ate = t + 7000; }
  } else if (rolagem.fase === 'fundo' && t >= rolagem.ate) {
    rolagem.fase = 'sobe'; rolagem.ini = t; rolagem.de = scrollY; rolagem.dur = semMovimento ? 0 : Math.min(2600, Math.max(1300, scrollY * .8));
  } else if (rolagem.fase === 'sobe') {
    const k = rolagem.dur ? Math.min((t - rolagem.ini) / rolagem.dur, 1) : 1;
    scrollTo(0, Math.round(rolagem.de * (1 - suave(k))));
    if (k >= 1) { rolagem.fase = 'espera'; rolagem.ate = t + 9000; acenar(); }
  }
}
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, () => { rolagem.pausaAte = performance.now() + 20000; }, { passive: true }));
requestAnimationFrame(passoRolagem);

let trava = null;
function marcarTelao(ligar) {
  raiz.classList.toggle('tv', ligar);
  $('btn-tv').textContent = ligar ? 'Sair do telão' : 'Modo telão';
  rolagem.fase = 'parado';
}
/* endereço com #telao abre direto no modo telão (sem tela cheia, que exige um clique) */
if (location.hash === '#telao') marcarTelao(true);
$('btn-tv').addEventListener('click', async () => {
  const ligar = !raiz.classList.contains('tv');
  marcarTelao(ligar);
  try {
    if (ligar) { if (raiz.requestFullscreen) await raiz.requestFullscreen(); if (navigator.wakeLock) trava = await navigator.wakeLock.request('screen'); }
    else { if (document.fullscreenElement) await document.exitFullscreen(); if (trava) { await trava.release(); trava = null; } }
  } catch (e) { /* tela cheia e bloqueio de tela são opcionais */ }
  posicionarRitmo();
});

iniciar();
})();
