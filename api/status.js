// Diagnóstico: abra https://SEU-SITE/api/status  (não mostra nenhum segredo, só sim/não)
import { db, initError, mp } from './_lib.js';

export default async function handler(req, res) {
  const out = {
    MP_ACCESS_TOKEN: !!process.env.MP_ACCESS_TOKEN,
    MP_TOKEN_TIPO: (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-') ? 'teste' : (process.env.MP_ACCESS_TOKEN ? 'produção' : null),
    FIREBASE_SERVICE_ACCOUNT: !process.env.FIREBASE_SERVICE_ACCOUNT ? 'ausente' : (initError ? 'inválida' : 'ok'),
    SITE_URL: process.env.SITE_URL || '(não definida: usando o domínio da requisição)',
  };
  try { if (db) { await db.collection('produtos').limit(1).get(); out.FIRESTORE = 'ok'; } else out.FIRESTORE = 'sem conexão'; }
  catch (e) { out.FIRESTORE = 'erro: ' + String(e.message).slice(0, 120); }
  try { if (process.env.MP_ACCESS_TOKEN) { const u = await mp('/users/me'); out.MERCADO_PAGO = 'ok (conta ' + u.id + ')'; } else out.MERCADO_PAGO = 'sem token'; }
  catch (e) { out.MERCADO_PAGO = 'erro: ' + String(e.message).slice(0, 120); }
  res.status(200).json(out);
}
