/**
 * Utilitário para formatação de moeda - FCFA (Franco CFA)
 * Moeda oficial da Guiné-Bissau
 */

/**
 * Formata um valor numérico para o formato de moeda FCFA
 * @param value Valor em centavos (dividido por 100 automaticamente)
 * @param options Opções de formatação
 * @returns String formatada com o símbolo FCFA
 * 
 * @example
 * formatCurrency(150000) // "1.500 FCFA"
 * formatCurrency(50000, { showDecimals: true }) // "500,00 FCFA"
 */
export function formatCurrency(
  value: number, 
  options: {
    showDecimals?: boolean;
    includeCurrency?: boolean;
  } = {}
): string {
  const {
    showDecimals = false,
    includeCurrency = true
  } = options;

  // Converter de centavos para valor real
  const amount = value / 100;

  // Formatar número
  const formatted = amount.toLocaleString('pt-BR', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  // Adicionar símbolo de moeda se solicitado
  return includeCurrency ? `${formatted} FCFA` : formatted;
}

/**
 * Converte um valor em FCFA para centavos (para armazenamento)
 * @param value Valor em FCFA
 * @returns Valor em centavos (inteiro)
 * 
 * @example
 * toCents(1500) // 150000
 * toCents(10.50) // 1050
 */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Converte centavos para valor em FCFA
 * @param cents Valor em centavos
 * @returns Valor em FCFA
 * 
 * @example
 * fromCents(150000) // 1500
 * fromCents(1050) // 10.50
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Valida se um valor é válido para moeda
 * @param value Valor a validar
 * @returns true se o valor é válido
 */
export function isValidCurrencyValue(value: any): boolean {
  if (typeof value !== 'number') return false;
  if (isNaN(value)) return false;
  if (!isFinite(value)) return false;
  if (value < 0) return false;
  return true;
}

/**
 * Parse string para valor numérico
 * @param value String com valor (aceita vírgula e ponto)
 * @returns Valor numérico ou null se inválido
 * 
 * @example
 * parseCurrency("1.500") // 1500
 * parseCurrency("1.500,50") // 1500.50
 * parseCurrency("1500") // 1500
 */
export function parseCurrency(value: string): number | null {
  if (!value) return null;
  
  // Remove espaços e o símbolo FCFA
  let cleaned = value.replace(/\s/g, '').replace(/FCFA/gi, '');
  
  // Substitui vírgula por ponto
  cleaned = cleaned.replace(',', '.');
  
  // Remove pontos de milhar (assumindo formato pt-BR: 1.500.000,00)
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Tem ponto de milhar
    cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}
