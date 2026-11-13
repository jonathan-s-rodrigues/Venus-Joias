# Vênus Joias — projeto unificado
- `/` loja (PWA instalável) · `/admin/` painel (PWA) · `js/config.js` ajustes da loja
## Antes de publicar
1. **js/config.js**: coloque sua chave Pix (`PIX_CHAVE`), frete e desconto.
2. **Firebase → Firestore → Regras**: cole o conteúdo de `firestore.rules` e publique.
3. **Authentication → Sign-in method**: mantenha *Anônimo* e *E-mail/senha* ativos; em *Authorized domains* adicione seu domínio.
4. Publique a pasta inteira na Vercel (raiz = esta pasta). Precisa ser HTTPS para instalar como app.
## Como funciona
- Produto marcado com ⭐ no painel aparece em **Destaques** e no **carrossel**.
- Pedido do site cai em **Pedidos** (origem "site") com entrega, pagamento e status. Ao marcar **pago**, o estoque baixa sozinho.
- Cartão: a loja envia o link de pagamento no WhatsApp (gateway automático = próxima etapa, exige backend).
- Ícones do app gerados da logo em `/icons` (192, 512, maskable, Apple).
