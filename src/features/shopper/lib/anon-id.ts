const KEY = "shopper-anon-id";

// Identidade anônima do visitante (sem login), persistida no localStorage. Só
// atribui o comportamento; vira shopperId de verdade quando ele logar (Fase B).
export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
