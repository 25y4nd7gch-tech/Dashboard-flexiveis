# Portal Antilhas — Painel de Indicadores

Página estática de acesso ao relatório Power BI (OEE, desempenho, disponibilidade, etiquetas).

## Estrutura
- `index.html` — página única (HTML + CSS + SVG, sem dependências externas além de fontes do Google)
- `logo.png` — logo da Antilhas

## Como testar localmente
Basta abrir o `index.html` no navegador, ou rodar um servidor simples:
```
python3 -m http.server 8000
```
e acessar `http://localhost:8000`

## Deploy no Render (Static Site)

1. Suba esses arquivos para um repositório no GitHub (crie um repo novo, ex: `antilhas-portal`)
2. No [Render](https://dashboard.render.com), clique em **New +** → **Static Site**
3. Conecte o repositório do GitHub
4. Configure:
   - **Build Command:** (deixe em branco — não há build)
   - **Publish Directory:** `.` (raiz do projeto)
5. Clique em **Create Static Site**
6. Em alguns minutos você recebe uma URL tipo `https://antilhas-portal.onrender.com`

Pronto — sem backend, sem variáveis de ambiente, sem custo (plano free do Render cobre isso).

## Atualizando o link do relatório
Se o link do Power BI mudar, edite a linha do botão em `index.html`:
```html
<a class="cta" href="SEU_LINK_AQUI" ...>
```
e suba a alteração no GitHub — o Render republica automaticamente.
