# Painel de Produção — Antilhas

Dashboard interno com login, upload de planilha e cálculo automático de OEE, Desempenho, Disponibilidade e indicadores de etiquetas de manutenção.

## O que tem aqui
- `server.js` — servidor (Node.js + Express)
- `views/` — páginas (login, dashboard, upload)
- `public/` — CSS e logo
- `data/users.json` — usuários e senhas (já criptografadas)
- `data/latest.json` — últimos dados processados (gerado automaticamente após o 1º upload)
- `gerar-usuario.js` — script para criar novos usuários

## Login inicial
| Usuário | Senha | Papel |
|---|---|---|
| GRicomine | admin01234 | Admin (sobe a planilha) |
| Flex | Flex123 | Visualizador |

## Como funciona
1. O **admin** loga e vai em "Subir planilha" (`/admin`) → envia o `.xlsx` do dia
2. O servidor lê as abas `bd_producao_26` e `etiquetas_26`, calcula:
   - **Desempenho** = Quant. Prod. Final ÷ Capacidade produtiva utilizada
   - **Disponibilidade** = Tempo Trabalhando ÷ Tempo Programado
   - **OEE** = Desempenho × Disponibilidade
   - (linhas com "Nº O.P." = 0 são ignoradas, como combinado)
3. Os **visualizadores** logam e veem o dashboard atualizado — sem precisar subir nada

## Deploy no Render (Web Service — não é Static Site)

1. Suba a pasta inteira para um repositório no GitHub (extraia o zip antes, não suba o .zip direto — mesma pegadinha de antes!)
2. No [Render](https://dashboard.render.com): **New +** → **Web Service**
3. Conecte o repositório
4. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Crie o serviço. Após o deploy, acesse a URL gerada e faça login.

## ⚠️ Importante: armazenamento

Este projeto guarda os dados (`data/latest.json`) e usuários (`data/users.json`) em arquivos simples no servidor. Isso é suficiente para o uso diário, mas:

- Se você fizer um **novo deploy** (ex: alterar o código e subir de novo no GitHub), os dados do último upload são apagados — basta o admin subir a planilha de novo depois.
- Se quiser adicionar mais usuários, rode localmente: `node gerar-usuario.js NOME SENHA admin|viewer`, copie a linha gerada para dentro de `data/users.json`, suba a alteração no GitHub e aguarde o redeploy.
- Para um projeto maior/mais gente usando, o próximo passo natural seria trocar esse arquivo por um banco de dados (ex: Postgres, que o Render também oferece). Posso te ajudar a migrar quando fizer sentido.

## Testando localmente (opcional)
```bash
npm install
npm start
```
Acesse `http://localhost:3000`
