// Falha do Oracle em português. O texto cru do driver (ORA-xxxxx, NJS-xxx) não
// ajuda quem está mapeando e expõe detalhe do banco do cliente na tela.
//
// Mesmos códigos que o Astro já reconhece (`astro/server/tools/erp.ts`), com
// texto voltado para quem mapeia em vez de quem pergunta ao Astro.
export function explicarFalhaDoOracle(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (/NJS-040|NJS-123|DPI-1067|timeout|ORA-01013/i.test(mensagem)) {
    return "O banco do ERP demorou demais e a leitura foi cancelada. Use um filtro por coluna com índice ou uma janela menor.";
  }
  if (/ORA-00942|ORA-01031/.test(mensagem)) {
    return "A credencial do ERP não tem acesso a essa tabela. Peça ao responsável pelo banco para liberar a leitura.";
  }
  if (/ORA-01722|ORA-01861|ORA-01858|ORA-01840/.test(mensagem)) {
    return "O valor informado não combina com o tipo da coluna (número ou data no formato AAAA-MM-DD).";
  }
  if (
    /ORA-12541|ORA-12170|ORA-12514|ORA-01017|ECONNREFUSED|ETIMEDOUT/i.test(
      mensagem,
    )
  ) {
    return "Não foi possível conectar ao banco do ERP. Confira a conexão em Integrações.";
  }
  if (/ORA-00933|ORA-00904|ORA-00907/.test(mensagem)) {
    return "O banco recusou a consulta montada. Confira as colunas do mapeamento.";
  }
  return "O banco do ERP recusou a leitura. Tente de novo em instantes.";
}
