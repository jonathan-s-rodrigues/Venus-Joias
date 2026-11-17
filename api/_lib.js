import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export let initError = null;
let _db = null;
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  _db = getFirestore();
} catch (e) {
  initError = process.env.FIREBASE_SERVICE_ACCOUNT ? 'FIREBASE_SERVICE_ACCOUNT inválida (cole o JSON inteiro, sem aspas extras)' : 'FIREBASE_SERVICE_ACCOUNT ausente';
  console.error('[init]', e.message);
}
export const db = _db;

const n = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
export const CFG = {
  DESCONTO_PIX: n(process.env.DESCONTO_PIX, 0.05),
  FRETE_ENVIO: n(process.env.FRETE_ENVIO, 20),
  FRETE_GRATIS_ACIMA: n(process.env.FRETE_GRATIS_ACIMA, 250),
  PARCELAS_MAX: n(process.env.PARCELAS_MAX, 3),
};
export const r2 = v => Math.round(v * 100) / 100;
export const siteUrl = req => (process.env.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

export async function mp(path, opts = {}) {
  const r = await fetch('https://api.mercadopago.com' + path, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

// Cotação de frete (Melhor Envio). Sem MELHORENVIO_TOKEN usa o frete fixo FRETE_ENVIO.
export async function cotarFrete({ cep, itens, sub }) {
  const token = process.env.MELHORENVIO_TOKEN;
  let opts;
  if (!token) {
    opts = [{ id: 'fixo', nome: 'Frete padrão', preco: CFG.FRETE_ENVIO, prazo: null }];
  } else {
    const origem = String(process.env.CEP_ORIGEM || '').replace(/\D/g, '');
    if (origem.length !== 8) throw new Error('CEP_ORIGEM ausente ou inválido');
    const base = process.env.MELHORENVIO_ENV === 'sandbox' ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br';
    const pk = { w: n(process.env.PACOTE_LARGURA, 11), h: n(process.env.PACOTE_ALTURA, 2), l: n(process.env.PACOTE_COMPRIMENTO, 16), kg: n(process.env.PACOTE_PESO_KG, 0.1) };
    const r = await fetch(base + '/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': `Venus Joias (${process.env.CONTATO_EMAIL || 'contato@venusjoias.com.br'})` },
      body: JSON.stringify({
        from: { postal_code: origem }, to: { postal_code: cep },
        products: itens.map(i => ({ id: i.produtoId, width: pk.w, height: pk.h, length: pk.l, weight: pk.kg, insurance_value: i.valor, quantity: i.qtd })),
        options: { receipt: false, own_hand: false },
        services: '1,2',            // 1 = Correios PAC, 2 = Correios SEDEX
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(j)) throw new Error(`Melhor Envio ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    opts = j.filter(s => !s.error && Number(s.custom_price ?? s.price) > 0).map(s => ({
      id: String(s.id), nome: `${s.company?.name || 'Correios'} ${s.name}`.trim(),
      preco: r2(Number(s.custom_price ?? s.price)), prazo: s.custom_delivery_time ?? s.delivery_time ?? null,
    }));
    if (!opts.length) throw new Error('Nenhum serviço disponível para este CEP');
  }
  opts.sort((a, b) => a.preco - b.preco);
  if (CFG.FRETE_GRATIS_ACIMA && sub >= CFG.FRETE_GRATIS_ACIMA) opts[0] = { ...opts[0], preco: 0, gratis: true };  // frete grátis na opção mais barata
  return opts;
}
