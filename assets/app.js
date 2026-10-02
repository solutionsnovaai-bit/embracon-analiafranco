(() => {
'use strict';

/* Fonte dos dados: data/ranking.json (atualizado por commit, IA ou automação).
   Alterações feitas pela tela ficam só neste navegador até o arquivo ser
   baixado e substituído no repositório. */
const ARQUIVO = 'data/ranking.json';
const CHAVE = 'ranking-rascunho-v1';
const INTERVALO = 60000; // confere o arquivo a cada 60 s (útil no telão)

/* Reserva usada só quando data/ranking.json não pode ser lido
   (por exemplo, index.html aberto direto do disco): equipe sem vendas. */
const DEMO = {
  config: { meta: 21000000, metaConsultor: 2000000, unidade: 'Anália Franco' },
  consultores: [
    ['pedro', 'Pedro'], ['enzo', 'Enzo'], ['caselli', 'Caselli'], ['sales', 'Sales'],
    ['detilio', 'Detilio'], ['letycia', 'Letycia'], ['tamy', 'Tamy'], ['juliana', 'Juliana']
  ]
};

const CATS = { imovel: 'Imóvel', auto: 'Automóvel', pesados: 'Pesados', servicos: 'Serviços' };
const PADRAO = { meta: 21000000, metaConsultor: 2000000, unidade: 'Anália Franco', ciclo: '', inicio: '', prazo: '', exemplo: false };
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
  podeEditar: location.hash === '#editar',
  config: { ...PADRAO },
  consultores: new Map(),       // id -> {id, nome}
  vendas: [],                   // {id, ordem, consultor, valor, categoria, data}
  atualizadoEm: '',
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
  if (typeof d.unidade === 'string' && d.unidade.trim()) c.unidade = d.unidade.trim().slice(0, 40);
  if (typeof d.ciclo === 'string') c.ciclo = d.ciclo.trim().slice(0, 40);
  if (ehData(d.inicio)) c.inicio = d.inicio;
  if (ehData(d.prazo)) c.prazo = d.prazo;
  c.exemplo = d.exemplo === true;
  return c;
}
function normVenda(d) {
  return {
    id: 'v' + (++ordem), ordem, consultor: String(d.consultor || ''), valor: Math.max(0, Number(d.valor) || 0),
    categoria: CATS[d.categoria] ? d.categoria : 'imovel', data: ehData(d.data) ? d.data : hojeISO()
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
    state.consultores.set(id, { id, nome });
  }
  state.vendas = (Array.isArray(d.vendas) ? d.vendas : []).filter(v => v && typeof v === 'object').map(normVenda);
  state.atualizadoEm = typeof d.atualizadoEm === 'string' ? d.atualizadoEm : '';
  state.confirmar = null;
}
function exportar() {
  return {
    atualizadoEm: new Date().toISOString(),
    config: { ...state.config },
    consultores: [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome })),
    vendas: [...state.vendas].sort((a, b) => a.ordem - b.ordem).map(v => ({ consultor: v.consultor, valor: v.valor, categoria: v.categoria, data: v.data }))
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
  const noCiclo = v => state.consultores.has(v.consultor) && (!c.inicio || v.data >= c.inicio) && (!c.prazo || v.data <= c.prazo);
  const ciclo = state.vendas.filter(noCiclo);
  const total = ciclo.reduce((s, v) => s + v.valor, 0);
  const porCat = { imovel: 0, auto: 0, pesados: 0, servicos: 0 };
  const cicloPor = new Map();
  for (const v of ciclo) { porCat[v.categoria] += v.valor; cicloPor.set(v.consultor, (cicloPor.get(v.consultor) || 0) + v.valor); }

  const corte = state.filtro === 'hoje' ? hoje : state.filtro === '7d' ? somaDias(hoje, -6) : null;
  const base = corte ? ciclo.filter(v => v.data >= corte && v.data <= hoje) : ciclo;
  const linhas = [...state.consultores.values()].map(p => ({ id: p.id, nome: p.nome, valor: 0, cotas: 0, ultima: '' }));
  const porId = new Map(linhas.map(l => [l.id, l]));
  for (const v of base) { const l = porId.get(v.consultor); l.valor += v.valor; l.cotas++; if (v.data > l.ultima) l.ultima = v.data; }
  linhas.sort((a, b) => b.valor - a.valor || b.cotas - a.cotas || a.nome.localeCompare(b.nome, 'pt-BR'));

  let naMeta = 0;
  for (const p of state.consultores.keys()) if ((cicloPor.get(p) || 0) >= c.metaConsultor) naMeta++;

  let ideal = null, restantes = null;
  if (c.prazo) restantes = Math.max(dias(hoje, c.prazo) + 1, 0);
  if (c.inicio && c.prazo && c.prazo >= c.inicio) {
    const totalDias = dias(c.inicio, c.prazo) + 1;
    const passados = Math.min(Math.max(dias(c.inicio, hoje) + 1, 0), totalDias);
    ideal = c.meta * passados / totalDias;
  }
  const feed = [...ciclo].sort((a, b) => b.data.localeCompare(a.data) || b.ordem - a.ordem);
  return { total, porCat, linhas, naMeta, ideal, restantes, feed, cotas: ciclo.length, falta: Math.max(c.meta - total, 0), somaFiltro: base.reduce((s, v) => s + v.valor, 0) };
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

function textoStatus() {
  if (state.modo === 'carregando') return 'Carregando';
  if (state.rascunho) return 'Alterações não publicadas';
  if (state.modo === 'demo') return 'Dados de exemplo';
  const d = new Date(state.atualizadoEm);
  if (isNaN(d)) return 'Dados do repositório';
  return 'Atualizado em ' + doisDig(d.getDate()) + '/' + doisDig(d.getMonth() + 1) + ' às ' + doisDig(d.getHours()) + ':' + doisDig(d.getMinutes());
}

function pintar() {
  const c = state.config, r = calcular(), carregando = state.modo === 'carregando';
  app.dataset.modo = carregando ? 'carregando' : state.rascunho ? 'rascunho' : state.modo === 'demo' ? 'demo' : 'vivo';
  const editar = state.podeEditar && !carregando;

  $('status').textContent = textoStatus();
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

  $('f-meta').textContent = r.naMeta + ' de ' + state.consultores.size;
  $('f-meta-n').textContent = 'consultores com ' + curto(c.metaConsultor) + ' ou mais';
  $('f-cotas').textContent = nf.format(r.cotas);
  $('f-cotas-n').textContent = r.cotas ? 'ticket médio de ' + curto(r.total / r.cotas) : 'nenhuma venda no ciclo';

  pintarLista(r, editar, carregando);
  pintarFeed(r, editar, carregando);
  pintarMix(r);
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

function pintarLista(r, editar, carregando) {
  const c = state.config, lista = $('lista'), noCiclo = state.filtro === 'ciclo';
  $('legenda').hidden = !noCiclo || !r.linhas.length;
  $('legenda-txt').textContent = 'meta individual de ' + curto(c.metaConsultor);
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
  const escala = Math.max(noCiclo ? c.metaConsultor : 0, r.linhas[0].valor) || 1;
  const vivos = new Set();

  r.linhas.forEach((l, i) => {
    vivos.add(l.id);
    let n = linhasDom.get(l.id);
    if (!n) { n = criarLinha(); linhasDom.set(l.id, n); }
    const p = n._p, lider = i === 0 && l.valor > 0;
    n.className = 'linha' + (i < 3 && l.valor > 0 ? ' top' : '') + (lider ? ' lider' : '');
    p.pos.textContent = l.valor > 0 ? i + 1 : '–';
    p.av.textContent = iniciais(l.nome);
    p.nome.textContent = l.nome;
    p.sub.textContent = l.cotas ? (l.cotas === 1 ? '1 cota' : l.cotas + ' cotas') + ' · última ' + quando(l.ultima) : noCiclo ? 'ainda sem venda no ciclo' : 'sem venda no período';
    p.cheio.style.width = (l.valor / escala * 100) + '%';
    p.marca.hidden = !noCiclo;
    p.marca.style.left = (c.metaConsultor / escala * 100) + '%';
    p.val.textContent = brl(l.valor);
    if (noCiclo) {
      const bateu = l.valor >= c.metaConsultor;
      p.nota.className = bateu ? 'batida' : '';
      p.nota.textContent = bateu ? 'Meta batida' : 'faltam ' + curto(c.metaConsultor - l.valor);
    } else {
      p.nota.className = '';
      p.nota.textContent = r.somaFiltro ? pctTxt(Math.round(l.valor / r.somaFiltro * 100)) + ' do período' : '';
    }
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

function pintarFeed(r, editar, carregando) {
  const feed = $('feed'); feed.textContent = '';
  const itens = state.verTodas ? r.feed : r.feed.slice(0, 7);
  if (!r.feed.length) feed.append(el('li', {}, el('span', { class: 'f-sub', text: carregando ? 'Carregando' : 'Nenhuma venda lançada no ciclo ainda.' })));
  for (const v of itens) {
    const p = state.consultores.get(v.consultor);
    const sub = el('div', { class: 'f-sub' }, CATS[v.categoria] + ' · ' + quando(v.data));
    const confirmando = editar && state.confirmar === v.id;
    if (editar && !confirmando) sub.append(' · ', el('button', { class: 'btn texto', type: 'button', text: 'Remover', 'aria-label': 'Remover venda de ' + p.nome, onclick: () => { state.confirmar = v.id; render(); } }));
    const li = el('li', {}, el('div', {}, el('div', { class: 'f-nome', text: p.nome }), sub), el('div', { class: 'f-valor', text: brl(v.valor) }));
    if (confirmando) li.append(el('div', { class: 'f-acao' }, 'Remover esta venda?',
      el('button', { class: 'btn texto perigo', type: 'button', text: 'Remover', onclick: () => removerVenda(v) }),
      el('button', { class: 'btn texto', type: 'button', text: 'Manter', onclick: () => { state.confirmar = null; render(); } })));
    feed.append(li);
  }
  const b = $('btn-todas');
  b.hidden = r.feed.length <= 7;
  b.textContent = state.verTodas ? 'Ver menos' : 'Ver todas (' + r.feed.length + ')';
}

function pintarMix(r) {
  const barra = $('mix-barra'), lista = $('mix'); barra.textContent = ''; lista.textContent = '';
  for (const k of Object.keys(CATS)) {
    const v = r.porCat[k], p = r.total ? v / r.total * 100 : 0;
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
async function lerArquivo() {
  const r = await fetch(ARQUIVO + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
function carregarDemo() {
  aplicar({ config: { ...DEMO.config }, consultores: DEMO.consultores.map(([id, nome]) => ({ id, nome })), vendas: [] });
  state.modo = 'demo';
}
async function conferir() {
  if (document.hidden || state.rascunho || state.modo !== 'arquivo') return;
  try {
    const t = await lerArquivo();
    if (t === textoArquivo) return;
    const d = JSON.parse(t);
    textoArquivo = t; aplicar(d); render();
  } catch (e) { /* falha de rede ou arquivo no meio de uma publicação: tenta de novo no próximo ciclo */ }
}
/* tela de abertura: fica o tempo de a animação se completar e sai quando os dados chegam */
const telaLoad = $('load');
function abrirPainel() {
  if (!telaLoad) return;
  telaLoad.classList.add('sai');
  app.classList.add('entra');
  setTimeout(() => telaLoad.remove(), 1300);
}
async function iniciar() {
  render();
  const minimo = semMovimento ? 300 : 1750;
  const espera = new Promise(r => setTimeout(r, Math.max(minimo - performance.now(), 0)));
  const demora = setTimeout(() => { if (telaLoad) telaLoad.classList.add('espera'); }, 2000);
  let texto = '', dados = null;
  try { texto = await lerArquivo(); dados = JSON.parse(texto); } catch (e) { dados = null; }
  await espera;
  clearTimeout(demora);
  if (!dados) { carregarDemo(); abrirPainel(); render(); return; }
  textoArquivo = texto;
  let rasc = null;
  try { rasc = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { rasc = null; }
  if (rasc && rasc.base === marca(texto) && rasc.dados) { aplicar(rasc.dados); state.rascunho = true; }
  else { if (rasc) apagarRascunho(); aplicar(dados); }
  state.modo = 'arquivo';
  abrirPainel();
  render();
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
addEventListener('hashchange', () => { state.podeEditar = location.hash === '#editar'; render(); });

function abrirVenda() {
  if (!state.consultores.size) { abrirEquipe(); toast('Cadastre um consultor antes de lançar a venda.'); return; }
  const sel = $('v-consultor'), atual = sel.value; sel.textContent = '';
  [...state.consultores.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(p => sel.append(el('option', { value: p.id, text: p.nome })));
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
  const pessoas = [...state.consultores.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ass = pessoas.map(p => p.id + ':' + p.nome).join('|') + '#' + state.confirmarEquipe;
  if (!forcar && ass === assinaturaEquipe) return;
  assinaturaEquipe = ass;
  const ul = $('equipe'), foco = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pid : null;
  ul.textContent = '';
  for (const p of pessoas) {
    const input = el('input', { type: 'text', value: p.nome, 'data-pid': p.id, 'aria-label': 'Nome de ' + p.nome, maxlength: '60', id: 'eq-' + p.id });
    input.addEventListener('change', () => {
      const novo = input.value.trim().replace(/\s+/g, ' ');
      if (!novo) { input.value = p.nome; return; }
      if (novo !== p.nome) { p.nome = novo; mudou('Nome atualizado'); }
    });
    const li = el('li', {}, el('div', { class: 'campo' }, input),
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
  if (foco) { const alvo = ul.querySelector('[data-pid="' + foco + '"]'); if (alvo) alvo.focus(); }
}
$('form-novo').addEventListener('submit', e => {
  e.preventDefault();
  const nome = $('n-nome').value.trim().replace(/\s+/g, ' ');
  if (!nome) { $('n-nome').focus(); return; }
  let base = slug(nome), id = base, i = 2;
  while (state.consultores.has(id)) id = base + '-' + i++;
  state.consultores.set(id, { id, nome });
  $('n-nome').value = '';
  mudou(nome + ' entrou no ranking'); pintarEquipe();
  $('n-nome').focus();
});

$('btn-ajustes').addEventListener('click', () => {
  const c = state.config;
  $('a-meta').value = nf.format(c.meta); $('a-metac').value = nf.format(c.metaConsultor);
  $('a-unidade').value = c.unidade; $('a-ciclo').value = c.ciclo; $('a-inicio').value = c.inicio; $('a-prazo').value = c.prazo;
  $('a-erro').textContent = ''; $('dlg-ajustes').showModal();
});
$('form-ajustes').addEventListener('submit', e => {
  e.preventDefault();
  const meta = lerValor($('a-meta')), metaConsultor = lerValor($('a-metac')), inicio = $('a-inicio').value, prazo = $('a-prazo').value;
  if (!meta || !metaConsultor) { $('a-erro').textContent = 'Preencha as duas metas com valores acima de zero.'; return; }
  if (inicio && prazo && prazo < inicio) { $('a-erro').textContent = 'O fim do ciclo precisa ser depois do início.'; return; }
  state.config = normConfig({ meta, metaConsultor, unidade: $('a-unidade').value, ciclo: $('a-ciclo').value, inicio, prazo, exemplo: state.config.exemplo });
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

let trava = null;
$('btn-tv').addEventListener('click', async () => {
  const ligar = !raiz.classList.contains('tv');
  raiz.classList.toggle('tv', ligar);
  $('btn-tv').textContent = ligar ? 'Sair do telão' : 'Modo telão';
  try {
    if (ligar) { if (raiz.requestFullscreen) await raiz.requestFullscreen(); if (navigator.wakeLock) trava = await navigator.wakeLock.request('screen'); }
    else { if (document.fullscreenElement) await document.exitFullscreen(); if (trava) { await trava.release(); trava = null; } }
  } catch (e) { /* tela cheia e bloqueio de tela são opcionais */ }
  posicionarRitmo();
});

iniciar();
})();
