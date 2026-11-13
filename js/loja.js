import { db, auth } from './firebase.js';
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { CONFIG as C } from './config.js';

const $ = id => document.getElementById(id);
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAT = { pulseiras: 'Pulseiras', colares: 'Colares', brincos: 'Brincos', conjuntos: 'Conjuntos', correntes: 'Correntes', tornozeleiras: 'Tornozeleiras', acessorios: 'Acessórios', itens: 'Itens' };
const catLabel = c => CAT[c] || (c.charAt(0).toUpperCase() + c.slice(1));
const normCat = c => String(c || 'itens').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_') || 'itens';

let PRODUCTS = [], cat = 'todos', termo = '', ordem = 'rel', pdpId = null, pdpQtd = 1, lastOrder = null;
let cart = new Map(Object.entries(JSON.parse(localStorage.getItem('venus_cart') || '{}')));
const save = () => localStorage.setItem('venus_cart', JSON.stringify(Object.fromEntries(cart)));

function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 1800); }

/* ---------- Carrossel genérico ---------- */
function carousel(root, track, dotsEl, auto = 0) {
  const slides = [...track.children]; if (!slides.length) return;
  dotsEl.innerHTML = slides.map((_, i) => `<button aria-label="Slide ${i + 1}"></button>`).join('');
  const dots = [...dotsEl.children]; let idx = 0, timer;
  const go = i => { idx = (i + slides.length) % slides.length; track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' }); };
  const mark = () => { idx = Math.round(track.scrollLeft / track.clientWidth); dots.forEach((d, i) => d.classList.toggle('on', i === idx)); };
  track.addEventListener('scroll', mark, { passive: true }); mark();
  dots.forEach((d, i) => d.onclick = () => go(i));
  root.querySelector('.prev').onclick = () => go(idx - 1);
  root.querySelector('.next').onclick = () => go(idx + 1);
  const start = () => { if (auto) { clearInterval(timer); timer = setInterval(() => go(idx + 1), auto); } };
  ['pointerdown', 'mouseenter', 'focusin'].forEach(e => root.addEventListener(e, () => clearInterval(timer)));
  ['mouseleave', 'pointerup'].forEach(e => root.addEventListener(e, start)); start();
}

function renderHero() {
  const dest = PRODUCTS.filter(p => p.destaque && p.imagem).slice(0, 4);
  const brand = `<div class="slide brand"><div><span class="tag">Vênus Joias</span><h1>Detalhes que contam histórias</h1><p>Uma seleção curada de joias com acabamento delicado, feita para elevar o seu dia a dia com sofisticação.</p><a href="#catalogo" class="btn btn-primary"><i class="fa-solid fa-gem"></i> Ver coleção</a></div><img src="Imagens/venusjoiaslogo.jpeg" alt="Vênus Joias"></div>`;
  const items = dest.map(p => `<div class="slide"><div><span class="tag">Destaque • ${esc(catLabel(p.categoria))}</span><h1>${esc(p.nome)}</h1><p>${BRL.format(p.preco)} • ou ${C.PARCELAS_MAX}x de ${BRL.format(p.preco / C.PARCELAS_MAX)}</p><button class="btn btn-primary" data-open="${p.id}">Ver detalhes</button></div><img src="${p.imagem}" alt="${esc(p.nome)}"></div>`).join('');
  $('heroTrack').innerHTML = brand + items;
  carousel($('hero'), $('heroTrack'), $('heroDots'), 6000);
}

/* ---------- Catálogo ---------- */
const card = p => {
  const ok = p.estoque > 0, low = ok && p.estoque <= 2;
  return `<article class="product-card" data-open="${p.id}">
    ${!ok ? '<span class="badge" style="background:#777">Esgotado</span>' : p.destaque ? '<span class="badge">Destaque</span>' : low ? '<span class="badge">Últimas unidades</span>' : ''}
    <img class="product-img" src="${p.imagem || ''}" alt="${esc(p.nome)}" loading="lazy">
    <div class="product-info"><div>
      <div class="product-title">${esc(p.nome)}</div>
      <div class="product-meta"><div class="product-cat">${esc(catLabel(p.categoria))}</div><div class="product-price">${BRL.format(p.preco)}</div></div>
      <div class="product-sub">ou ${C.PARCELAS_MAX}x de ${BRL.format(p.preco / C.PARCELAS_MAX)}</div></div>
      <button class="btn-add" ${ok ? `data-add="${p.id}"` : 'disabled'}>${ok ? 'Adicionar à sacola' : 'Indisponível'}</button></div></article>`;
};

function filtered() {
  let l = PRODUCTS.filter(p => (cat === 'todos' || p.categoria === cat) && (!termo || (p.nome + ' ' + catLabel(p.categoria)).toLowerCase().includes(termo)));
  if (ordem === 'menor') l.sort((a, b) => a.preco - b.preco);
  else if (ordem === 'maior') l.sort((a, b) => b.preco - a.preco);
  else if (ordem === 'az') l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  else l.sort((a, b) => (b.estoque > 0) - (a.estoque > 0) || b.destaque - a.destaque || b.created - a.created);
  return l;
}

function renderCatalog() {
  const l = filtered();
  $('resultCount').textContent = `${l.length} ${l.length === 1 ? 'peça' : 'peças'}`;
  $('products-grid').innerHTML = l.length ? l.map(card).join('') : '<p class="muted" style="grid-column:1/-1">Nenhuma peça encontrada. Tente outra busca ou categoria.</p>';
}

function renderFilters() {
  const cats = ['todos', ...[...new Set(PRODUCTS.map(p => p.categoria))].sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'pt-BR'))];
  const mk = (cls) => cats.map(c => `<button class="${cls} ${c === cat ? 'active' : ''}" data-cat="${c}">${c === 'todos' ? 'Todos' : esc(catLabel(c))}</button>`).join('');
  $('filters').innerHTML = mk('filter-btn'); $('menu-categories').innerHTML = mk('menu-filter-btn');
}

function renderDestaques() {
  const d = PRODUCTS.filter(p => p.destaque && p.estoque > 0);
  $('destaques-sec').hidden = !d.length;
  $('destaquesTrack').innerHTML = d.map(card).join('');
}

/* ---------- Detalhe ---------- */
function openPdp(id) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return; pdpId = id; pdpQtd = 1;
  $('pdpImg').src = p.imagem || ''; $('pdpImg').alt = p.nome; $('pdpCat').textContent = catLabel(p.categoria); $('pdpNome').textContent = p.nome;
  $('pdpPreco').textContent = BRL.format(p.preco);
  $('pdpParc').textContent = `ou ${C.PARCELAS_MAX}x de ${BRL.format(p.preco / C.PARCELAS_MAX)} no cartão`;
  $('pdpPix').textContent = C.DESCONTO_PIX ? `${BRL.format(p.preco * (1 - C.DESCONTO_PIX))} no Pix (${Math.round(C.DESCONTO_PIX * 100)}% off)` : '';
  $('pdpEstoque').innerHTML = p.estoque > 0 ? `<span class="stock-badge">Em estoque: ${p.estoque}</span>` : '<span class="stock-badge out">Esgotado</span>';
  $('pdpAdd').disabled = p.estoque <= 0; $('pdpQtd').textContent = 1; $('pdp').classList.add('open');
}
$('pdpMais').onclick = () => { const p = PRODUCTS.find(x => x.id === pdpId); if (p && pdpQtd < p.estoque) $('pdpQtd').textContent = ++pdpQtd; };
$('pdpMenos').onclick = () => { if (pdpQtd > 1) $('pdpQtd').textContent = --pdpQtd; };
$('pdpAdd').onclick = () => { addToCart(pdpId, pdpQtd); $('pdp').classList.remove('open'); };
$('pdpClose').onclick = () => $('pdp').classList.remove('open');
$('pdp').onclick = e => { if (e.target === $('pdp')) $('pdp').classList.remove('open'); };

/* ---------- Sacola ---------- */
function addToCart(id, q = 1) {
  const p = PRODUCTS.find(x => x.id === id); if (!p || p.estoque <= 0) return;
  const cur = cart.get(id)?.qtd || 0, qtd = Math.min(cur + q, p.estoque);
  if (cur + q > p.estoque) toast(`Só temos ${p.estoque} em estoque`);
  cart.set(id, { id, qtd }); save(); renderCart(); view('cart'); openCart();
}
const items = () => [...cart.values()].map(c => { const p = PRODUCTS.find(x => x.id === c.id); return p && { ...p, qtd: Math.min(c.qtd, p.estoque) }; }).filter(i => i && i.qtd > 0);
const subtotal = () => Math.round(items().reduce((s, i) => s + Math.round(i.preco * 100) * i.qtd, 0)) / 100;

function renderCart() {
  const its = items(), count = its.reduce((s, i) => s + i.qtd, 0);
  $('cart-count').textContent = count; $('cart-total').textContent = BRL.format(subtotal()); $('goCheckout').disabled = !its.length;
  $('cart-items').innerHTML = its.length ? its.map(i => `
    <div class="cart-item"><div style="display:flex;gap:12px"><img class="cart-thumb" src="${i.imagem || ''}" alt="">
      <div><strong>${esc(i.nome)}</strong><small>${BRL.format(i.preco)}</small>
        <div style="margin-top:8px" class="qty-controls"><button class="qty-btn" data-dec="${i.id}">−</button><strong>${i.qtd}</strong><button class="qty-btn" data-inc="${i.id}" ${i.qtd >= i.estoque ? 'disabled' : ''}>+</button></div></div></div>
      <div style="display:grid;gap:10px;justify-items:end;align-content:start"><strong>${BRL.format(i.qtd * i.preco)}</strong><button class="remove-btn" data-rm="${i.id}">Remover</button></div></div>`).join('')
    : '<div class="muted" style="padding:18px;border:1px dashed var(--border);border-radius:16px">Sua sacola está vazia. Escolha uma joia para continuar.</div>';
}
const view = v => { $('viewCart').hidden = v !== 'cart'; $('viewCheckout').hidden = v !== 'checkout'; $('viewOk').hidden = v !== 'ok'; $('cartTitle').textContent = v === 'checkout' ? 'Finalizar pedido' : v === 'ok' ? 'Pedido enviado' : 'Sua Sacola'; };
const openCart = () => $('cart-modal').classList.add('open'), closeCart = () => $('cart-modal').classList.remove('open');

/* ---------- Checkout: entrega + pagamento ---------- */
const radio = n => document.querySelector(`input[name=${n}]:checked`).value;
function totals() {
  const sub = subtotal(), ent = radio('entrega'), pag = radio('pag');
  const desc = pag === 'pix' ? Math.round(sub * C.DESCONTO_PIX * 100) / 100 : 0;
  let frete = 0, freteTxt = 'Grátis';
  if (ent === 'entrega') { frete = C.FRETE_GRATIS_ACIMA && sub >= C.FRETE_GRATIS_ACIMA ? 0 : C.FRETE_ENTREGA; freteTxt = frete ? BRL.format(frete) : 'Grátis'; }
  if (ent === 'correios') freteTxt = 'A confirmar';
  return { sub, desc, frete, freteTxt, total: Math.round((sub - desc + frete) * 100) / 100, ent, pag };
}
function renderTotals() {
  const t = totals();
  $('sumSub').textContent = BRL.format(t.sub); $('sumDesc').textContent = '− ' + BRL.format(t.desc); $('rowDesc').hidden = !t.desc;
  $('sumFrete').textContent = t.freteTxt; $('sumTotal').textContent = BRL.format(t.total) + (t.ent === 'correios' ? ' + frete' : '');
  $('endBox').hidden = t.ent === 'retirada';
  const online = t.ent !== 'correios';
  document.querySelectorAll('input[name=pag][value=pix],input[name=pag][value=cartao]').forEach(r => { r.disabled = !online; r.closest('.opt').style.opacity = online ? 1 : .45; });
  if (!online && t.pag !== 'combinar') { document.querySelector('input[name=pag][value=combinar]').checked = true; return renderTotals(); }
  $('btnPedido').textContent = ['pix', 'cartao'].includes(t.pag) ? 'Pagar agora' : 'Enviar pedido';
}
$('viewCheckout').addEventListener('change', renderTotals);

$('coCep').addEventListener('input', async e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
  if (v.length !== 8) return;
  try { const r = await (await fetch(`https://viacep.com.br/ws/${v}/json/`)).json(); if (r.erro) return;
    $('coRua').value = r.logradouro || ''; $('coBairro').value = r.bairro || ''; $('coCidade').value = r.localidade || ''; $('coUf').value = r.uf || ''; $('coNum').focus(); } catch { }
});

function summaryText(o) {
  const L = ['*Vênus Joias — Novo pedido*', '', `*Cliente:* ${o.cliente}`, `*WhatsApp:* ${o.telefone}`, ''];
  o.itens.forEach(i => L.push(`• ${i.qtd}x ${i.nome} — ${BRL.format(i.total)}`));
  L.push('', `Subtotal: ${BRL.format(o.subtotal)}`);
  if (o.desconto) L.push(`Desconto Pix: − ${BRL.format(o.desconto)}`);
  L.push(`Frete: ${o.entrega.tipo === 'correios' ? 'a confirmar' : BRL.format(o.frete)}`, `*Total:* ${BRL.format(o.totalGeral)}`, '');
  const e = o.entrega;
  L.push(e.tipo === 'retirada' ? '*Entrega:* Retirada' : `*Entrega:* ${e.tipo === 'correios' ? 'Correios' : 'Entrega local'} — ${e.rua}, ${e.numero}${e.complemento ? ' ' + e.complemento : ''} — ${e.bairro}, ${e.cidade}/${e.uf} — CEP ${e.cep}`);
  L.push(`*Pagamento:* ${{ pix: 'Pix', cartao: 'Cartão de crédito', combinar: 'A combinar' }[o.pagamento]}`);
  if (o.obs) L.push(`*Obs:* ${o.obs}`);
  return L.join('\n');
}

$('viewCheckout').addEventListener('submit', async ev => {
  ev.preventDefault(); const erro = m => $('coErro').textContent = m; erro('');
  const t = totals(), its = items(); if (!its.length) return erro('Sua sacola está vazia.');
  const nome = $('coNome').value.trim(), fone = $('coFone').value.replace(/\D/g, '');
  if (nome.length < 3) return erro('Informe seu nome completo.');
  if (fone.length < 10) return erro('Informe um WhatsApp válido com DDD.');
  let end = { tipo: t.ent };
  if (t.ent !== 'retirada') {
    end = { tipo: t.ent, cep: $('coCep').value, rua: $('coRua').value.trim(), numero: $('coNum').value.trim(), complemento: $('coComp').value.trim(), bairro: $('coBairro').value.trim(), cidade: $('coCidade').value.trim(), uf: $('coUf').value.trim().toUpperCase() };
    if (!end.rua || !end.numero || !end.cidade || end.cep.replace(/\D/g, '').length !== 8) return erro('Preencha CEP, rua, número e cidade para a entrega.');
  }
  const d = new Date(), data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const order = {
    cliente: nome, telefone: $('coFone').value.trim(), data, origem: 'site', status: 'novo', pagamento: t.pag, entrega: end, obs: $('coObs').value.trim(),
    itens: its.map(i => ({ produtoId: i.id, nome: i.nome, valor: i.preco, qtd: i.qtd, total: Math.round(i.preco * 100) * i.qtd / 100 })),
    subtotal: t.sub, desconto: t.desc, frete: t.frete, totalGeral: t.total, createdAt: new Date()
  };
  const btn = $('btnPedido'); btn.disabled = true; btn.textContent = 'Enviando…';
  let salvo = true, ref = null; try { ref = await addDoc(collection(db, 'pedidos'), order); } catch (e) { salvo = false; console.error(e); }
  // Pix / cartão: segue para o pagamento seguro do Mercado Pago
  if (ref && ['pix', 'cartao'].includes(t.pag) && t.ent !== 'correios') {
    btn.textContent = 'Abrindo pagamento…';
    try {
      const r = await fetch('/api/criar-pagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: ref.id }) });
      const j = await r.json().catch(() => ({ erro: `Servidor de pagamento indisponível (código ${r.status}). Confira se o site foi publicado na Vercel com a pasta api/.` }));
      if (!r.ok) console.error('[pagamento]', r.status, j);
      if (r.ok && j.url) { cart.clear(); save(); location.href = j.url; return; }
      erro((j.erro || 'Não foi possível abrir o pagamento.') + (j.detalhe ? ` [${j.detalhe}]` : ''));
    } catch (e) { console.error(e); erro('Não foi possível abrir o pagamento.'); }
    btn.disabled = false; btn.textContent = 'Pagar agora';
    $('coErro').textContent += ' Tente novamente ou escolha "Combinar com a loja".';
    return;
  }
  btn.disabled = false; btn.textContent = 'Enviar pedido';
  lastOrder = order; cart.clear(); save(); renderCart();
  $('okMsg').textContent = salvo ? 'Seu pedido foi registrado. Agora é só enviá-lo pelo WhatsApp para confirmarmos tudo.' : 'Não conseguimos registrar online, mas você pode enviar o pedido pelo WhatsApp abaixo.';
  $('pixBox').hidden = t.pag !== 'pix'; $('pixChave').textContent = C.PIX_CHAVE; $('pixValor').textContent = `${C.PIX_NOME} • ${BRL.format(t.total)}`;
  $('okWhats').href = `https://api.whatsapp.com/send?phone=${C.WHATSAPP}&text=${encodeURIComponent(summaryText(order))}`;
  view('ok');
});
$('copyPix').onclick = () => navigator.clipboard?.writeText(C.PIX_CHAVE).then(() => toast('Chave Pix copiada'));
$('goCheckout').onclick = () => { if (items().length) { view('checkout'); renderTotals(); } };
$('backCart').onclick = () => view('cart');
$('okFechar').onclick = () => { closeCart(); view('cart'); };

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const add = t.closest('[data-add]'); if (add) { e.stopPropagation(); return addToCart(add.dataset.add); }
  const open = t.closest('[data-open]'); if (open) return openPdp(open.dataset.open);
  const c = t.closest('[data-cat]'); if (c) { cat = c.dataset.cat; renderFilters(); renderCatalog(); $('mobile-menu-modal').classList.remove('open'); return; }
  const inc = t.closest('[data-inc]'); if (inc) { const i = cart.get(inc.dataset.inc); i.qtd++; save(); return renderCart(); }
  const dec = t.closest('[data-dec]'); if (dec) { const i = cart.get(dec.dataset.dec); if (--i.qtd <= 0) cart.delete(i.id); save(); return renderCart(); }
  const rm = t.closest('[data-rm]'); if (rm) { cart.delete(rm.dataset.rm); save(); return renderCart(); }
  const row = t.closest('[data-row]'); if (row) $('destaquesTrack').scrollBy({ left: row.dataset.row * 260, behavior: 'smooth' });
});
$('busca').oninput = e => { termo = e.target.value.trim().toLowerCase(); renderCatalog(); };
$('ordenar').onchange = e => { ordem = e.target.value; renderCatalog(); };
$('cart-btn').onclick = () => { view('cart'); openCart(); };
$('close-cart').onclick = closeCart;
$('cart-modal').onclick = e => { if (e.target === $('cart-modal')) closeCart(); };
$('menu-btn').onclick = () => $('mobile-menu-modal').classList.add('open');
$('close-menu').onclick = () => $('mobile-menu-modal').classList.remove('open');
$('mobile-menu-modal').onclick = e => { if (e.target === $('mobile-menu-modal')) e.target.classList.remove('open'); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); $('pdp').classList.remove('open'); $('mobile-menu-modal').classList.remove('open'); } });

/* ---------- Textos dinâmicos ---------- */
$('perkPix').textContent = C.DESCONTO_PIX ? `${Math.round(C.DESCONTO_PIX * 100)}% de desconto no pagamento` : 'Pagamento instantâneo';
$('perkParc').textContent = C.PARCELAS_MAX;
$('perkFrete').textContent = C.FRETE_GRATIS_ACIMA ? `Frete grátis acima de ${BRL.format(C.FRETE_GRATIS_ACIMA)}` : 'Consulte o frete';
$('optEntrega').textContent = `${BRL.format(C.FRETE_ENTREGA)}${C.FRETE_GRATIS_ACIMA ? ` (grátis acima de ${BRL.format(C.FRETE_GRATIS_ACIMA)})` : ''}`;
$('optRetirada').textContent = 'Grátis • ' + C.RETIRADA_ENDERECO;
$('optPix').textContent = (C.DESCONTO_PIX ? `${Math.round(C.DESCONTO_PIX * 100)}% de desconto • ` : '') + 'QR Code ou copia-e-cola, aprovação na hora';
$('optCartao').textContent = `Até ${C.PARCELAS_MAX}x no cartão • ambiente seguro do Mercado Pago`;

/* ---------- Dados ---------- */
async function load() {
  // não derruba a sessão do admin se ele estiver logado no mesmo navegador
  try { const u = await new Promise(r => { const off = onAuthStateChanged(auth, x => { off(); r(x); }); }); if (!u) await signInAnonymously(auth); } catch { }
  try {
    const snap = await getDocs(collection(db, 'produtos'));
    PRODUCTS = snap.docs.map(d => { const x = d.data() || {}; const preco = Number(x.precoFinal ?? 0);
      return { id: d.id, nome: String(x.descricao || 'Produto').trim(), preco: isFinite(preco) ? preco : 0, categoria: normCat(x.categoria), imagem: x.foto || '', estoque: parseInt(x.estoque ?? 0, 10) || 0, destaque: !!x.destaque, created: x.createdAt?.toMillis?.() || 0 }; })
      .filter(p => p.preco > 0);
    renderHero(); renderDestaques(); renderFilters(); renderCatalog(); renderCart();
  } catch (e) {
    console.error(e);
    $('products-grid').innerHTML = '<p class="muted" style="grid-column:1/-1">Não foi possível carregar o catálogo agora. Verifique o login Anônimo e as regras do Firestore (veja o LEIA-ME).</p>';
    renderHero();
  }
}
renderCart(); load();

/* ---------- Retorno do Mercado Pago ---------- */
(() => {
  const q = new URLSearchParams(location.search), s = q.get('mp'); if (!s) return;
  const m = { ok: ['✅ Pagamento aprovado! Obrigada pela compra — já vamos separar seu pedido.', 'ok'], pendente: ['⏳ Pagamento pendente. Assim que for confirmado, avisamos você pelo WhatsApp.', 'warn'], falhou: ['❌ O pagamento não foi concluído. Você pode tentar novamente pela sacola.', 'err'] }[s];
  if (m) { const b = $('mpBanner'); b.textContent = m[0]; b.className = 'mp-banner ' + m[1]; b.hidden = false; }
  history.replaceState(null, '', location.pathname);
})();

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
let deferred; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('install-btn').hidden = false; });
$('install-btn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('install-btn').hidden = true; };
