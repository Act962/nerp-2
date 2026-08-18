export function formatCNPJ(value: string): string {
  // Remove tudo que não for número
  if (value === null) return "";

  const digits = value.replace(/\D/g, "");

  // Limita a 14 dígitos
  const cnpj = digits.slice(0, 14);

  return cnpj
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function unformatCNPJ(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCPForCNPJ(value: string): string {
  // Remove tudo que não for número
  if (value === null || value === undefined) return "";

  const digits = value.replace(/\D/g, "");

  // Se tiver 11 dígitos ou menos, formata como CPF
  if (digits.length <= 11) {
    const cpf = digits.slice(0, 11);
    return cpf
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  // Se tiver mais de 11 dígitos, formata como CNPJ
  const cnpj = digits.slice(0, 14);
  return cnpj
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
