# Como a Central funciona (para quem for mexer no código)

## Visão geral
- App web de uma página só (HTML + CSS + JS puro, sem framework), instalável como app (PWA).
- **Hospedagem:** GitHub Pages deste repositório (branch `main`, pasta raiz) → https://patrickaguilar-pixel.github.io/central/
- **Login e dados:** Firebase do projeto `central-f39fb` (plano Spark, gratuito).
  - Authentication: provedor Google. Domínio `patrickaguilar-pixel.github.io` autorizado.
  - Firestore (banco `(default)`, região southamerica-east1). Estrutura: `users/{uid}/items/{id}` (tarefas e anotações) e `users/{uid}/config/settings` (`{areas, pin, sheet}`).
  - Regras: cada usuário só lê e grava `users/{seu uid}/**`.
- **Google Agenda:** API REST do Calendar com o token OAuth do login (escopo `calendar.events`), que dura cerca de 1 hora; depois o app mostra "Conectar Google Agenda".

## Estrutura
- `src/central.html`: **fonte principal**. É a mesma Central que roda como artefato no claude.ai, onde usa `window.claude.use('db'|'mcp'|'dictation'|'sample')`.
- `src/shim.js`: substitui o `window.claude.use` do Claude. Faz o login Firebase com a tela de entrada, o banco (Firestore com a mesma interface `doc().set/delete/onSnapshot`), o Google Agenda (`callTool` com `list_events`, `create_event`, `update_event` e `delete_event`) e o ditado (Web Speech API). `sample`, a IA, não existe fora do Claude.
- `src/extra.css`: estilos só do app (tela de login etc.).
- `src/sw.js` e `src/manifest.webmanifest`: PWA. O service worker busca primeiro na rede, para o app sempre abrir a versão mais nova.
- `build.py`: junta tudo e gera `index.html`, `sw.js` e os ícones na raiz. Também faz pequenas trocas de texto, como as mensagens que falavam de claude.ai.

## Fluxo de atualização
1. Editar `src/central.html` (e/ou `src/shim.js`, `src/extra.css`).
2. Rodar `python3 build.py` na raiz.
3. Fazer commit e push na `main`. O GitHub Pages publica em cerca de 1 minuto, e o app instalado se atualiza sozinho ao ser reaberto.
4. Para manter a versão do Claude igual, publicar o mesmo `src/central.html` no artefato "Central" do claude.ai.

## Transferir dados
Menu → "Transferir dados": exporta e importa um código `CENTRALDATA1:` com itens, áreas e senha (base64 de JSON). Serve para levar dados entre a versão do Claude e o app.
