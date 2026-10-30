/**
 * Validação de CPF, CNPJ e GTIN pelo dígito verificador.
 *
 * GTIN inválido é uma das rejeições mais comuns de NFC-e: o EAN cadastrado no
 * produto vai para o XML e a SEFAZ confere o dígito. Produto sem código de
 * barras válido sai como "SEM GTIN" — nunca com um código inventado.
 */

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cpfValido(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++)
      soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(cpf.slice(0, 9), 10);
  const d2 = dv(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(cnpj.slice(0, 12));
  const d2 = dv(cnpj.slice(0, 13));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

/** CPF (11) ou CNPJ (14) válido. */
export function documentoValido(valor: string): boolean {
  const digitos = somenteDigitos(valor);
  return digitos.length === 11 ? cpfValido(digitos) : cnpjValido(digitos);
}

/** GTIN-8/12/13/14 com dígito verificador módulo 10 (pesos 3 e 1). */
export function gtinValido(valor: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(valor)) return false;
  let soma = 0;
  const corpo = valor.slice(0, -1);
  for (let i = 0; i < corpo.length; i++) {
    const peso = (corpo.length - i) % 2 === 1 ? 3 : 1;
    soma += Number(corpo[i]) * peso;
  }
  const dv = (10 - (soma % 10)) % 10;
  return dv === Number(valor[valor.length - 1]);
}
