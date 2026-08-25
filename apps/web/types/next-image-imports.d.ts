// Declara os tipos de import de imagem do Next (`*.svg`, `*.png`, …).
//
// Normalmente isso vem do `next-env.d.ts`, que o Next GERA e o .gitignore
// ignora. Num checkout limpo — CI, ou clone novo antes do primeiro build — o
// arquivo não existe e o `tsc --noEmit` quebra com TS2307 em todo
// `import x from "@/assets/...svg"`, mesmo com o .svg versionado.
//
// Este arquivo é versionado e traz a mesma referência, então o check-types
// passa a funcionar sozinho, sem depender de um `next build` anterior.
// Referência duplicada com o next-env.d.ts é inofensiva.
/// <reference types="next/image-types/global" />
