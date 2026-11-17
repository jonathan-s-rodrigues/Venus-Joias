import { db, initError, cotarFrete, r2 } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });
  if (initError) return res.status(500).json({ erro: 'Configuração do servidor incompleta', detalhe: initError });
  try {
    const cep = String(req.body?.cep || '').replace(/\D/g, '');
    const req_itens = req.body?.itens;
    if (cep.length !== 8 || !Array.isArray(req_itens) || !req_itens.length || req_itens.length > 50) return res.status(400).json({ erro: 'CEP ou itens inválidos' });
    let sub = 0; const itens = [];
    for (const i of req_itens) {
      const qtd = Math.floor(Number(i.qtd));
      if (!i.produtoId || !(qtd >= 1 && qtd <= 50)) return res.status(400).json({ erro: 'Item inválido' });
      const p = await db.collection('produtos').doc(String(i.produtoId)).get();
      if (!p.exists) return res.status(400).json({ erro: 'Produto não encontrado' });
      const valor = Number(p.data().precoFinal); if (!(valor > 0)) return res.status(400).json({ erro: 'Produto sem preço' });
      itens.push({ produtoId: p.id, valor, qtd }); sub += valor * qtd;
    }
    return res.json({ opcoes: await cotarFrete({ cep, itens, sub: r2(sub) }) });
  } catch (e) {
    console.error('[frete]', e);
    return res.status(502).json({ erro: 'Não foi possível calcular o frete agora', detalhe: String(e.message).slice(0, 300) });
  }
}
