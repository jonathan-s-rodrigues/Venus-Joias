import { db, initError, mp } from './_lib.js';

export default async function handler(req, res) {
  if (initError || !process.env.MP_ACCESS_TOKEN) return res.status(500).end();
  try {
    const type = req.query.type || req.body?.type || req.query.topic;
    const id = req.query['data.id'] || req.body?.data?.id || (req.query.topic === 'payment' ? req.query.id : null);
    if (type !== 'payment' || !id) return res.status(200).end();

    // Nunca confia no corpo da notificação: consulta o pagamento direto no Mercado Pago
    const pay = await mp(`/v1/payments/${encodeURIComponent(id)}`);
    const orderId = pay.external_reference;
    if (!orderId) return res.status(200).end();
    const ref = db.collection('pedidos').doc(orderId);

    await db.runTransaction(async t => {
      const snap = await t.get(ref); if (!snap.exists) return;
      const o = snap.data();
      const upd = { mpPaymentId: String(pay.id), mpStatus: pay.status, mpMetodo: pay.payment_type_id || null };

      if (pay.status === 'approved' && o.status !== 'pago') {
        if (Math.abs(Number(pay.transaction_amount) - Number(o.totalGeral)) > 0.01) {
          upd.mpStatus = 'valor_divergente';           // não confirma: conferir manualmente
          return t.update(ref, upd);
        }
        const prods = [];
        if (!o.estoqueBaixado) for (const i of o.itens) { const pr = db.collection('produtos').doc(i.produtoId); prods.push({ pr, i, snap: await t.get(pr) }); }
        for (const { pr, i, snap: ps } of prods) if (ps.exists) t.update(pr, { estoque: Math.max(0, (parseInt(ps.data().estoque, 10) || 0) - i.qtd) });
        Object.assign(upd, { status: 'pago', estoqueBaixado: true });
      }
      t.update(ref, upd);
    });
    return res.status(200).end();
  } catch (e) {
    console.error('[webhook-mp]', e);
    return res.status(500).end();     // Mercado Pago tenta novamente
  }
}
