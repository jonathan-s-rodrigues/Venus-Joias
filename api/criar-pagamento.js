import { db, mp, CFG, r2, siteUrl } from './_lib.js';

const erro = (res, s, m) => res.status(s).json({ erro: m });

export default async function handler(req, res) {
  if (req.method !== 'POST') return erro(res, 405, 'Método não permitido');
  try {
    const orderId = req.body?.orderId;
    if (typeof orderId !== 'string' || !orderId) return erro(res, 400, 'Pedido inválido');
    const ref = db.collection('pedidos').doc(orderId), snap = await ref.get();
    if (!snap.exists) return erro(res, 404, 'Pedido não encontrado');
    const o = snap.data();
    if (o.origem !== 'site' || !['pix', 'cartao'].includes(o.pagamento) || o.entrega?.tipo === 'correios') return erro(res, 400, 'Pedido não é elegível para pagamento online');
    if (o.status === 'pago') return erro(res, 409, 'Pedido já pago');
    if (o.mpInitPoint) return res.json({ url: o.mpInitPoint });

    // Recalcula TUDO no servidor a partir do catálogo (ignora valores enviados pelo navegador)
    if (!Array.isArray(o.itens) || !o.itens.length || o.itens.length > 50) return erro(res, 400, 'Itens inválidos');
    let sub = 0; const itens = [];
    for (const i of o.itens) {
      const qtd = Math.floor(Number(i.qtd));
      if (!i.produtoId || !(qtd >= 1 && qtd <= 50)) return erro(res, 400, 'Item inválido');
      const p = await db.collection('produtos').doc(String(i.produtoId)).get();
      if (!p.exists) return erro(res, 400, 'Produto não encontrado');
      const d = p.data(), preco = Number(d.precoFinal), est = parseInt(d.estoque ?? 0, 10) || 0;
      if (!(preco > 0)) return erro(res, 400, 'Produto sem preço');
      if (est < qtd) return erro(res, 409, `Estoque insuficiente: ${d.descricao}`);
      itens.push({ produtoId: p.id, nome: d.descricao, valor: preco, qtd, total: r2(preco * qtd) });
      sub += preco * qtd;
    }
    sub = r2(sub);
    const desconto = o.pagamento === 'pix' ? r2(sub * CFG.DESCONTO_PIX) : 0;
    const frete = o.entrega?.tipo === 'entrega' ? (CFG.FRETE_GRATIS_ACIMA && sub >= CFG.FRETE_GRATIS_ACIMA ? 0 : CFG.FRETE_ENTREGA) : 0;
    const total = r2(sub - desconto + frete);
    if (!(total > 0)) return erro(res, 400, 'Total inválido');

    const site = siteUrl(req), https = site.startsWith('https://');
    const back = s => `${site}/?mp=${s}&pedido=${orderId}`;
    const excluidos = o.pagamento === 'pix'
      ? ['credit_card', 'debit_card', 'ticket', 'account_money', 'prepaid_card']       // só Pix
      : ['ticket', 'bank_transfer', 'account_money', 'prepaid_card'];                  // só cartão
    const qtdTotal = itens.reduce((s, i) => s + i.qtd, 0);
    const pref = await mp('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: orderId, title: `Pedido Vênus Joias (${qtdTotal} ${qtdTotal === 1 ? 'item' : 'itens'})`, quantity: 1, unit_price: total, currency_id: 'BRL' }],
        external_reference: orderId,
        statement_descriptor: 'VENUS JOIAS',
        notification_url: https ? `${site}/api/webhook-mp` : undefined,
        back_urls: { success: back('ok'), pending: back('pendente'), failure: back('falhou') },
        ...(https ? { auto_return: 'approved' } : {}),
        payment_methods: { excluded_payment_types: excluidos.map(id => ({ id })), installments: o.pagamento === 'cartao' ? CFG.PARCELAS_MAX : 1 },
      }),
    });

    await ref.update({ itens, subtotal: sub, desconto, frete, totalGeral: total, mpPreferenceId: pref.id, mpInitPoint: pref.init_point, mpStatus: 'aguardando' });
    return res.json({ url: pref.init_point });
  } catch (e) {
    console.error('[criar-pagamento]', e);
    return erro(res, 500, 'Não foi possível iniciar o pagamento');
  }
}
