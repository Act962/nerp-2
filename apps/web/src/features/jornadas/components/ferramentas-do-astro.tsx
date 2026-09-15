"use client";

/**
 * Os botões do nerp no cabeçalho do painel do Astro.
 *
 * Cada um FECHA o painel antes de abrir o diálogo. Não é cosmético: o painel é
 * `z-index: 200` e, no celular, ocupa a tela inteira — um diálogo aberto atrás
 * dele seria um clique no vazio.
 */
export function FerramentasDoAstro({
  fechar,
  aoAbrirJornadas,
  aoAbrirMelhorias,
}: {
  fechar: () => void;
  aoAbrirJornadas: () => void;
  aoAbrirMelhorias: () => void;
}) {
  const abrir = (acao: () => void) => () => {
    fechar();
    acao();
  };

  return (
    <>
      <button
        type="button"
        className="o-astro-head__ferramenta"
        onClick={abrir(aoAbrirJornadas)}
        title="Aprender o sistema passo a passo"
      >
        Jornadas
      </button>
      <button
        type="button"
        className="o-astro-head__ferramenta"
        onClick={abrir(aoAbrirMelhorias)}
        title="Mandar uma sugestão para a equipe da ÓRBITA"
      >
        Melhorias
      </button>
    </>
  );
}
