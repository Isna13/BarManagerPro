/**
 * Enum global de métodos de pagamento - DEVE SER IDÊNTICO em todos os apps
 * Mobile, Backend e Electron devem usar os mesmos valores
 */

export const PaymentMethod = {
  CASH: 'CASH',
  ORANGE_MONEY: 'ORANGE_MONEY',
  TELETAKU: 'TELETAKU',
  VALE: 'VALE',
  MIXED: 'MIXED',
} as const;

export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];

export const VALID_PAYMENT_METHODS = Object.values(PaymentMethod);

/**
 * Valida se o método de pagamento é válido
 */
export function isValidPaymentMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return VALID_PAYMENT_METHODS.includes(method.toUpperCase() as PaymentMethodType);
}

/**
 * Normaliza o método de pagamento para o padrão global
 * NUNCA retorna um valor padrão - lança erro se inválido
 */
export function normalizePaymentMethod(method: string | null | undefined): PaymentMethodType {
  if (!method) {
    throw new Error('Método de pagamento não pode ser nulo ou vazio');
  }
  
  const upperMethod = method.toUpperCase();
  
  // Mapeamento de valores antigos/alternativos para o padrão
  switch (upperMethod) {
    case 'CASH':
    case 'DINHEIRO':
    case 'MONEY':
      return PaymentMethod.CASH;
    case 'ORANGE_MONEY':
    case 'ORANGE':
    case 'MOBILE_MONEY':
      return PaymentMethod.ORANGE_MONEY;
    case 'TELETAKU':
      return PaymentMethod.TELETAKU;
    case 'VALE':
    case 'DEBT':
    case 'CREDIT':
    case 'FIADO':
      return PaymentMethod.VALE;
    case 'MIXED':
    case 'MISTO':
    case 'MULTIPLE':
      return PaymentMethod.MIXED;
    default:
      throw new Error(`Método de pagamento inválido: ${method}`);
  }
}

/**
 * Tenta normalizar o método de pagamento, retorna null se inválido
 * Use quando quiser verificar sem lançar erro
 */
export function tryNormalizePaymentMethod(method: string | null | undefined): PaymentMethodType | null {
  try {
    return normalizePaymentMethod(method);
  } catch {
    return null;
  }
}

/**
 * Retorna nome amigável para exibição
 */
export function getPaymentMethodDisplayName(method: string): string {
  switch (method.toUpperCase()) {
    case 'CASH':
      return 'Dinheiro';
    case 'ORANGE_MONEY':
      return 'Orange Money';
    case 'TELETAKU':
      return 'TeleTaku';
    case 'VALE':
      return 'Vale';
    case 'MIXED':
      return 'Pagamento Misto';
    default:
      return method;
  }
}
