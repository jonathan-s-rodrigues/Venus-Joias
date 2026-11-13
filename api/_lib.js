import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
export const db = getFirestore();

const n = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
export const CFG = {
  DESCONTO_PIX: n(process.env.DESCONTO_PIX, 0.05),
  FRETE_ENTREGA: n(process.env.FRETE_ENTREGA, 15),
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
