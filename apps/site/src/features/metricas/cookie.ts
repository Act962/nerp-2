/**
 * O cookie que leva o ID da visita até o proxy do chat.
 *
 * O medidor guarda a visita no `localStorage`, que o servidor não lê. Este
 * cookie é a cópia que atravessa a requisição do Astro — é assim que o lead
 * herda a campanha que trouxe a pessoa.
 */
export const COOKIE_DA_VISITA = "orbita_visita";
