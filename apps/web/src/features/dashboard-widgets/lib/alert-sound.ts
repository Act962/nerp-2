// Sinal sonoro do alerta. Sintetizado com Web Audio API em vez de tocar um
// .mp3: um `beep-beep` curto (~600ms) não vale um round-trip de rede nem 20KB
// de bundle, e serve como "chime" educado — não é para gritar, é pra chamar
// atenção quem já está olhando para outra aba.
//
// LIMITAÇÃO: browsers modernos exigem gesto do usuário antes de tocar áudio
// (autoplay policy). A primeira vez que este helper roda em uma aba sem
// interação prévia, o `AudioContext` fica em `suspended` e o beep sai mudo.
// A UI trata isso com um botão explícito "🔊 Ativar sons" que chama
// `resume()` dentro do handler de clique — a partir daí toda a sessão libera.

let cachedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedContext) return cachedContext;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  cachedContext = new Ctor();
  return cachedContext;
}

/**
 * "Destrava" o áudio dentro de um handler de gesto (click/touch). Deve ser
 * chamado a partir de um evento — chamar solto não vai passar da política de
 * autoplay do navegador.
 */
export async function primeAlertSound(): Promise<boolean> {
  const context = getContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    // Um "ping" quase inaudível confirma que o áudio realmente destravou.
    // 20 ms + ganho 0.001 = imperceptível, mas conta como reprodução para
    // o navegador zerar a barreira de autoplay.
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.001;
    oscillator.frequency.value = 880;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.02);
    return context.state === "running";
  } catch {
    return false;
  }
}

/**
 * Toca o beep do alerta. Silencioso se o áudio não estiver destravado —
 * NÃO joga exception (o alerta visual é o principal, o som é enfeite).
 */
export function playAlertSound(): void {
  const context = getContext();
  if (!context || context.state !== "running") return;
  try {
    // Duas notas rápidas — "di-di" — em vez de uma nota longa. Chama atenção
    // sem ser irritante.
    const beep = (frequency: number, start: number, duration: number): void => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      // Envelope: sobe rápido, cai rápido — evita "click" digital nas bordas.
      gain.gain.setValueAtTime(0, context.currentTime + start);
      gain.gain.linearRampToValueAtTime(
        0.18,
        context.currentTime + start + 0.01,
      );
      gain.gain.linearRampToValueAtTime(
        0,
        context.currentTime + start + duration,
      );
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + start);
      oscillator.stop(context.currentTime + start + duration + 0.01);
    };
    beep(880, 0, 0.14);
    beep(1175, 0.18, 0.18);
  } catch {
    // ignora: som é enfeite
  }
}
