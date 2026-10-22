<div align="center">

<img src="assets/icon.png" width="110" alt="Incompletos Launcher">

# Incompletos Launcher

**Launcher autônomo do modpack ModPack de Cria — Incompletos Gaming (Minecraft 1.20.1 + Forge)**
Aceita conta **pirata (offline)** e **original (Microsoft)**. Java e CurseForge integrados: é só abrir e jogar.

[![Release](https://img.shields.io/github/v/release/ryan1235/imcompletos-launcher?style=for-the-badge&color=e09612)](https://github.com/ryan1235/imcompletos-launcher/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/ryan1235/imcompletos-launcher/total?style=for-the-badge&color=222)](https://github.com/ryan1235/imcompletos-launcher/releases)
[![Discord](https://img.shields.io/badge/Discord-entrar-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/PxfytFvuhx)
[![Website](https://img.shields.io/badge/Website-incompletos.com.br-00bcd4?style=for-the-badge)](https://incompletos.com.br)

</div>

## ⬇️ Baixar

Vá em **[Releases](https://github.com/ryan1235/imcompletos-launcher/releases/latest)** e escolha:

| Arquivo | Para quê |
|---|---|
| `Incompletos-Launcher-Setup-*.exe` | Instala com atalho na área de trabalho e no menu iniciar (recomendado) |
| `Incompletos-Launcher-Portable-*.exe` | Roda direto, sem precisar instalar |

> O Windows pode mostrar o aviso do SmartScreen na primeira vez (o executável não é assinado por certificado comercial). Basta clicar em **Mais informações → Executar assim mesmo**.

## ✨ Recursos

- 🎮 **Conta pirata e original** — nickname offline ou login seguro via Microsoft / Xbox Live
- ☕ **Java 17 Automático** — baixa o Eclipse Temurin JRE 17 headless se você não tiver instalado
- 📦 **Sincronização CurseForge Dinâmica** — suporte a código de compartilhamento direto do CurseForge, com modal automático para trocar link caso expire
- 🛡️ **Verificação de Integridade** — confere todos os JARs e modpacks para evitar arquivos truncados
- 🧭 **Assistente Inicial de Configuração** — testa memória RAM recomendada, Java e baixa os componentes necessários
- 📰 **Novidades do Incompletos Gaming** — notas de atualização do GitHub e servidor de Discord integrados
- 🔄 **Auto-update** via GitHub Releases
- ⚙️ Controle de memória RAM (2 GB a 16 GB), tela cheia, argumentos JVM e ferramentas de diagnóstico
- 🫥 O launcher minimiza ou oculta automaticamente ao abrir o jogo e reaparece ao fechar

## 💻 Requisitos

- Windows 10/11 64 bits
- Mínimo de 4 GB de RAM (recomendado 8 GB ou mais) e ~3 GB de espaço livre em disco

## 🛠️ Desenvolvimento

```bash
npm install
npm start                 # abre o launcher em modo de desenvolvimento
npm run build             # compila o instalador NSIS e a versão portátil em dist/
```

---

<div align="center">Feito com ⚔️ para a comunidade <b>Incompletos Gaming</b></div>
