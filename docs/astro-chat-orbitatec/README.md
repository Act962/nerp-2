# ASTRO do Órbita no site orbitatec.com.br

O que se cola no app **ASTRO CHAT** do Órbita para o ASTRO de lá atender o site
com o conhecimento do catálogo. A decisão e o desenho estão em
`specs/site-astro-chat-do-orbita.md`.

## Os arquivos

| Arquivo | Onde vai | Como é mantido |
|---|---|---|
| `instrucoes.txt` | ASTRO CHAT → site → aba **Inteligência** → campo **Instruções** (cabe: o limite de lá é 6.000 caracteres) | Escrito à mão. É o tom de voz e as regras do atendimento. |
| `base-1.md`, `base-2.md`, `base-3.md` | Cada um vira uma **base de conhecimento** no ASTRO do Órbita, e as três são marcadas na aba **Inteligência** do site | **Gerados.** Não edite: rode o script. |

## Regenerar as bases

Sempre que o catálogo do site mudar (ferramenta nova, texto de página):

```bash
pnpm --filter @nerp/web exec tsx scripts/gerar-base-do-astro-chat.ts
```

Depois, substitua o conteúdo das três bases no Órbita. Elas são uma cópia: sem
esse passo o ASTRO continua falando do catálogo antigo.

O script falha se o total passar de 60 mil caracteres, que é o que o Órbita lê
somando todas as bases marcadas num site; cada base é cortada em 20 mil.

## O que o ASTRO do Órbita não faz

Ele lê texto. O que o consultor antigo do site fazia com ferramentas próprias
não vem junto: estimar faixa de preço, consultar CNPJ, saber em que página o
visitante está, mostrar cartões com link e gravar o diagnóstico em
`/site/leads`. Por isso as instruções mandam chamar a equipe quando perguntam
preço.
