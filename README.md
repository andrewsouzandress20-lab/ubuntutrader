## Execução de scripts TypeScript

### Localmente (desenvolvimento)

Você pode rodar scripts diretamente com ts-node:

```
npm run send-signals-open
npm run send-analysis-open
```

Ou, para simular produção (igual ao Actions):

```
npx tsc --project tsconfig.scripts.json
node dist/send_signals_action.js open
node dist/send_signals_action.js open analysis
```

### No GitHub Actions (produção)

O workflow já está configurado para:

- Compilar o TypeScript (`npx tsc`)
- Executar o arquivo .js gerado:
   - `node dist/send_signals_action.js open`
   - `node dist/send_signals_action.js open analysis`

**Nunca use `npx ts-node ...` no GitHub Actions**, pois pode gerar erro de ES module.
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1UYxH8gF1WEa0lbaiyV1FqBCY13lY9HFI

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy no Render.com

1. No painel do Render, crie um novo serviço Web Static Site ou Web Service.
2. Configure as variáveis de ambiente necessárias (ex: VITE_GEMINI_API_KEY, VITE_TELEGRAM_BOT_TOKEN, VITE_TELEGRAM_CHAT_ID).
3. Use as configurações abaixo:

**Build Command:**
```sh
npm run build
```

**Start Command:**
```sh
npm run preview -- --port $PORT
```

Se o preview não funcionar corretamente, instale um servidor estático:
```sh
npm install -g serve
```
E use como Start Command:
```sh
serve -s dist -l $PORT
```

O Render irá expor a variável $PORT automaticamente.
