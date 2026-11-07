# links

Mural minimalista para arquivar e organizar links e mídias da web (YouTube, X/Twitter, Instagram, TikTok e outros), com geração automática de prévia, categorização por tags e pessoas foco, e busca textual completa.

---

## Recursos

- **Design Minimalista Dark**: Foco no conteúdo, sem poluição visual.
- **Prévia Rica Automática**: Extração de título, descrição, autor e thumbnail estilo WhatsApp.
- **Persistência de Thumbnails**: Imagens salvas localmente para evitar links quebrados quando mídias externas expiram.
- **Filtros e Busca**:
  - Busca inteligente em título, URL, descrição e metadados com suporte a remoção de acentos (`unaccent`).
  - Filtros combináveis por rede social, tag (`#`) e pessoa foco (`@`).
- **Paginação**: Navegação rápida e leve entre páginas.
- **Importação em Massa**: Extração de URLs de blocos de texto ou arquivos `.txt`/`.csv`, suporte a tags e pessoas inline (`#tag @pessoa`), e deduplicação inteligente com limpeza de parâmetros de rastreio (`utm_*`, `si`, etc.).
- **Área Administrativa Privativa**: Acesso por senha para criação, edição e exclusão de itens e gerenciamento de pessoas e tags.

---

## Tecnologias

- **Framework**: React Router v7 (SSR)
- **Estilo**: Tailwind CSS v4
- **Banco de Dados**: PostgreSQL + Drizzle ORM
- **Runtime**: Node.js 22

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Subir banco de dados local via Docker
docker compose -f docker-compose.dev.yml up -d

# Executar migrações do banco
npm run db:migrate

# Iniciar servidor de desenvolvimento
npm run dev
```

---

## Licença

MIT
