/**
 * Quantas imagens acompanham um pedido de melhoria.
 *
 * Mora num módulo neutro porque o formulário (cliente) e a procedure
 * (servidor) precisam do mesmo número — dois limites diferentes dariam um
 * envio recusado depois de a pessoa já ter subido as imagens.
 */
export const MAX_IMAGENS_POR_MELHORIA = 4;
