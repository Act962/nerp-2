// `server-only` lança ao ser importado fora do bundler do Next. Como 51
// arquivos de `src/` o importam, sem este stub qualquer teste que toque a
// árvore de server morre no import, antes de chegar na asserção.
export {};
