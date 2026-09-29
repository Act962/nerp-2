/**
 * "Já mostrei isto?" — por visita (`sessionStorage`) ou por visitante
 * (`localStorage`). Armazenamento bloqueado responde "não": o pior caso é
 * mostrar de novo, nunca quebrar a página.
 */
type Alcance = "visita" | "visitante";

function armazenamento(alcance: Alcance): Storage | null {
  try {
    return alcance === "visita" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function jaVisto(chave: string, alcance: Alcance): boolean {
  try {
    return armazenamento(alcance)?.getItem(chave) === "1";
  } catch {
    return false;
  }
}

export function marcarVisto(chave: string, alcance: Alcance) {
  try {
    armazenamento(alcance)?.setItem(chave, "1");
  } catch {
    // sem armazenamento, sem memória
  }
}
