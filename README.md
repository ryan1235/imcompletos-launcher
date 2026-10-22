<div align="center">

<img src="assets/icon.png" width="110" alt="DeathAwaits">

# DeathAwaits Launcher

**Launcher autônomo do modpack DeathAwaits — Minecraft 1.6.4 + Forge**
Aceita conta **pirata (offline)** e **original (Microsoft)**. Java e Minecraft embutidos: é só abrir e jogar.

[![Release](https://img.shields.io/github/v/release/ryan1235/DeathAwaits?style=for-the-badge&color=d4141c)](https://github.com/ryan1235/DeathAwaits/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/ryan1235/DeathAwaits/total?style=for-the-badge&color=333)](https://github.com/ryan1235/DeathAwaits/releases)
[![Discord](https://img.shields.io/badge/Discord-entrar-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/gc73gQfb5F)

<img src="docs/preview.png" width="760" alt="Preview do launcher">

</div>

## ⬇️ Baixar

Vá em **[Releases](https://github.com/ryan1235/DeathAwaits/releases/latest)** e escolha:

| Arquivo | Para quê |
|---|---|
| `DeathAwaits-Launcher-Setup-*.exe` | Instala com atalho na área de trabalho (recomendado) |
| `DeathAwaits-Launcher-Portable-*.exe` | Roda direto, sem instalar |

> O Windows pode mostrar o aviso do SmartScreen na primeira vez (o launcher não é assinado digitalmente). Clique em **Mais informações → Executar assim mesmo**.

## ✨ Recursos

- 🎮 **Conta pirata e original** — nickname offline ou login Microsoft
- ☕ **Java embutido** — escolhe o Java certo para a versão do Minecraft (8 / 17 / 21) e detecta os que você já tem
- 📦 **Modpack automático** — baixa, instala e atualiza mods e Forge sozinho
- 🛡️ **Integridade** — confere o launcher e todos os arquivos do modpack e repara o que estiver corrompido
- 🧭 **Primeiro uso guiado** — checa o PC, sugere a memória ideal e faz o primeiro download
- 📰 **Novidades** — versão e notas de atualização vêm das Releases do GitHub (Markdown, ícones e imagens)
- 🔄 **Auto-update** do launcher
- ⚙️ Memória RAM, tela cheia, tamanho da janela, argumentos da JVM, logs e muito mais
- 🫥 O launcher some quando o jogo abre e volta quando você fecha o Minecraft

## 💻 Requisitos

- Windows 10/11 64 bits
- 4 GB de RAM (recomendado 8 GB ou mais) e ~2 GB livres em disco

## 🛠️ Desenvolvimento

```bash
npm install
npm start                 # abre o launcher
npm run build             # gera dist/ (instalador + portátil)
```

Estrutura: `src/` (app Electron), `tools/` (scripts de build/pacote), `config.json` (nome, servidor, links).

### Publicar uma versão

1. Gere o pacote do modpack a partir da pasta com `mods/`, `config/` e `bin/` (Forge):
   ```bash
   npm run pack -- <pasta-do-modpack> v1.0.1
   ```
   Isso cria `release/DeathAwaits-modpack.zip` e `release/manifest.json`.
2. Aumente `version` no `package.json` e rode `npm run build`.
3. Crie uma **Release** com a tag `v1.0.1`, escreva as notas em Markdown e anexe:
   `DeathAwaits-modpack.zip`, `manifest.json`, `latest.yml`, o `Setup`, o `Portable` e o `.blockmap`.

O launcher lê `releases/latest/download/manifest.json`, então a release mais recente é sempre a versão oficial.

---

<div align="center">Feito com 💀 para a comunidade DeathAwaits</div>
