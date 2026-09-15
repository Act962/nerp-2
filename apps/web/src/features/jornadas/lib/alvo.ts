/**
 * Achar na tela o elemento que o passo destaca.
 *
 * A âncora é um `data-jornada` escrito no componente — atributo, não classe
 * nem seletor de estrutura: classe muda quando alguém mexe no estilo, e
 * seletor por estrutura quebra na primeira `div` a mais.
 */

export const ATRIBUTO = "data-jornada";

export function seletorDe(chave: string): string {
  return `[${ATRIBUTO}="${CSS.escape(chave)}"]`;
}

export function acharAlvo(chave: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(seletorDe(chave));
}

/** Tempo até desistir de esperar um alvo e avisar a pessoa. */
export const ESPERA_MAXIMA_MS = 8000;

/**
 * Espera o alvo aparecer.
 *
 * O elemento raramente está lá no instante em que o passo começa: a tela pode
 * estar carregando, o diálogo abrindo, a lista chegando do servidor. O
 * `MutationObserver` cobre o caso normal; o relógio de 250 ms existe para o que
 * ele não vê — um elemento que já existia e só perdeu o `hidden`, por exemplo.
 */
export function esperarAlvo(
  chave: string,
  opcoes: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<HTMLElement | null> {
  const timeoutMs = opcoes.timeoutMs ?? ESPERA_MAXIMA_MS;

  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const jaEstaLa = acharAlvo(chave);
    if (jaEstaLa) {
      resolve(jaEstaLa);
      return;
    }

    let encerrado = false;
    const encerrar = (elemento: HTMLElement | null) => {
      if (encerrado) return;
      encerrado = true;
      observador.disconnect();
      clearInterval(relogio);
      clearTimeout(limite);
      opcoes.signal?.removeEventListener("abort", aoAbortar);
      resolve(elemento);
    };

    const tentar = () => {
      const alvo = acharAlvo(chave);
      if (alvo) encerrar(alvo);
    };

    const aoAbortar = () => encerrar(null);

    const observador = new MutationObserver(tentar);
    observador.observe(document.body, { childList: true, subtree: true });
    const relogio = setInterval(tentar, 250);
    const limite = setTimeout(() => encerrar(null), timeoutMs);
    opcoes.signal?.addEventListener("abort", aoAbortar);
  });
}

/**
 * Abre o que esconde o alvo — uma aba, um grupo do menu.
 *
 * Não basta `.click()`. O `Collapsible` do menu reage ao clique, mas as abas
 * do Radix trocam no **pointerdown**: um clique programático nelas não faz
 * nada, e o passo seguinte fica esperando um alvo que nunca vai montar.
 * Então mandamos os dois — a sequência de ponteiro primeiro, o clique depois,
 * que é o que um dedo de verdade produz.
 */
export function abrirGatilho(elemento: HTMLElement): void {
  // `PointerEvent` não existe em todo ambiente (o jsdom dos testes é um), e
  // aqui o que importa é o TIPO do evento, não a classe que o carrega.
  const ponteiro =
    typeof PointerEvent === "function"
      ? new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          isPrimary: true,
        })
      : new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
        });

  elemento.dispatchEvent(ponteiro);
  elemento.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }),
  );
  elemento.click();
}

/** Traz o alvo para o meio da tela, se ele estiver fora dela. */
export function revelarAlvo(elemento: HTMLElement): void {
  const caixa = elemento.getBoundingClientRect();
  const visivel =
    caixa.top >= 0 &&
    caixa.left >= 0 &&
    caixa.bottom <= window.innerHeight &&
    caixa.right <= window.innerWidth;
  if (visivel) return;
  elemento.scrollIntoView({ block: "center", inline: "center" });
}

/**
 * Onde o balão precisa ser desenhado para funcionar.
 *
 * Alvo dentro de um diálogo do Radix exige o balão DENTRO do mesmo diálogo:
 * desenhado no `body`, o clique nele é tratado como clique fora e fecha o
 * diálogo — e, enquanto ele está aberto, o `body` fica com `pointer-events`
 * desligado, o que deixaria o botão "Próximo" inerte.
 */
export function containerDoAlvo(elemento: HTMLElement): HTMLElement {
  return elemento.closest<HTMLElement>('[role="dialog"]') ?? document.body;
}
