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

## Mercado Pago (Pix e cartão automáticos)
Fluxo: cliente escolhe Pix ou cartão → pedido é salvo → site abre o Checkout do Mercado Pago → ao aprovar, o webhook marca o pedido como **pago** e baixa o estoque.
1. **Credenciais**: Mercado Pago → *Suas integrações* → crie uma aplicação (Checkout Pro) → copie o **Access Token**. Comece com o de **teste**; troque pelo de produção quando for vender de verdade.
2. **Conta de serviço**: Firebase → ⚙️ Configurações do projeto → *Contas de serviço* → *Gerar nova chave privada*. Cole o JSON inteiro (uma linha) na variável `FIREBASE_SERVICE_ACCOUNT`.
3. **Vercel → Settings → Environment Variables**: crie `MP_ACCESS_TOKEN`, `FIREBASE_SERVICE_ACCOUNT` e (opcional) `SITE_URL`. Veja `.env.example`. Refaça o deploy depois.
4. **Webhook**: Mercado Pago → sua aplicação → *Webhooks* → URL `https://SEU-SITE/api/webhook-mp` → evento **Pagamentos**.
5. `DESCONTO_PIX`, `FRETE_ENTREGA`, `FRETE_GRATIS_ACIMA` e `PARCELAS_MAX` existem em `js/config.js` (exibição) e nas variáveis da Vercel (cálculo real). **Mantenha os dois iguais**; o servidor sempre recalcula os valores.
- Correios: sem pagamento online (frete a confirmar) → "Combinar com a loja".
