# @nerp/site-content

O contrato do conteúdo do site institucional da ÓRBITA HUB.

Existe porque duas pontas precisam concordar sobre o mesmo formato e nenhuma
das duas pode ser dona dele:

- **`apps/web`** é quem tem o banco. Ele guarda os blocos de uma página como
  JSON e expõe o conteúdo publicado em `/api/site/*`.
- **`apps/site`** é quem desenha. Ele consome aquele JSON e monta a página.

Se o formato morasse em um dos dois, o outro importaria de dentro de um app —
que é exatamente o que um monorepo existe para evitar. Aqui não há React, não
há Prisma e não há acesso a rede: só os schemas Zod e os tipos.

Ao evoluir um bloco, campo novo entra **opcional ou com `.default()`**. Um campo
obrigatório novo invalida de uma vez todas as páginas já salvas — e quem
descobre isso é o visitante, porque `parseBlocks` descarta o que não bate.
