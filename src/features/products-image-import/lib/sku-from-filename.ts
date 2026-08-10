// Extrai o SKU do nome de um arquivo. Regra simples e previsível:
//   NB-4060.jpg          → "NB-4060"
//   7891234567890.png    → "7891234567890"
//   NB-4060 (2).jpg      → "NB-4060"          (remove sufixo " (n)")
//   NB-4060-2.jpg        → "NB-4060-2"        (mantém — pode ser SKU válido)
//   NB-4060.thumb.jpg    → "NB-4060"          (remove extensões extras)
//   /pasta/NB-4060.jpg   → "NB-4060"
//
// A validação "esse SKU existe no banco" fica pra procedure — aqui é só
// normalizar o texto pra passar pro server.
export function skuFromFilename(filename: string): string {
  // Só a última parte do caminho (compat com webkitRelativePath).
  const base = filename.split(/[\\/]/).pop() ?? filename;
  // Remove qualquer extensão (uma ou mais, ex.: "foo.thumb.jpg" → "foo").
  const withoutExt = base.replace(/\.[^.]+$/g, "");
  // Remove " (2)", " (3)" — costumam vir de download duplicado do navegador.
  return withoutExt.replace(/\s*\(\d+\)\s*$/, "").trim();
}
