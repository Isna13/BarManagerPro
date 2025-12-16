"use strict";
/**
 * Enum global de métodos de pagamento - DEVE SER IDÊNTICO em todos os apps
 * Mobile, Backend e Electron devem usar os mesmos valores
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_PAYMENT_METHODS = exports.PaymentMethod = void 0;
exports.isValidPaymentMethod = isValidPaymentMethod;
exports.normalizePaymentMethod = normalizePaymentMethod;
exports.tryNormalizePaymentMethod = tryNormalizePaymentMethod;
exports.getPaymentMethodDisplayName = getPaymentMethodDisplayName;
exports.PaymentMethod = {
    CASH: 'CASH',
    ORANGE_MONEY: 'ORANGE_MONEY',
    TELETAKU: 'TELETAKU',
    VALE: 'VALE',
    MIXED: 'MIXED',
};
exports.VALID_PAYMENT_METHODS = Object.values(exports.PaymentMethod);
/**
 * Valida se o método de pagamento é válido
 */
function isValidPaymentMethod(method) {
    if (!method)
        return false;
    return exports.VALID_PAYMENT_METHODS.includes(method.toUpperCase());
}
/**
 * Normaliza o método de pagamento para o padrão global
 * NUNCA retorna um valor padrão - lança erro se inválido
 */
function normalizePaymentMethod(method) {
    if (!method) {
        throw new Error('Método de pagamento não pode ser nulo ou vazio');
    }
    const upperMethod = method.toUpperCase();
    // Mapeamento de valores antigos/alternativos para o padrão
    switch (upperMethod) {
        case 'CASH':
        case 'DINHEIRO':
        case 'MONEY':
            return exports.PaymentMethod.CASH;
        case 'ORANGE_MONEY':
        case 'ORANGE':
        case 'MOBILE_MONEY':
            return exports.PaymentMethod.ORANGE_MONEY;
        case 'TELETAKU':
            return exports.PaymentMethod.TELETAKU;
        case 'VALE':
        case 'DEBT':
        case 'CREDIT':
        case 'FIADO':
            return exports.PaymentMethod.VALE;
        case 'MIXED':
        case 'MISTO':
        case 'MULTIPLE':
            return exports.PaymentMethod.MIXED;
        default:
            throw new Error(`Método de pagamento inválido: ${method}`);
    }
}
/**
 * Tenta normalizar o método de pagamento, retorna null se inválido
 * Use quando quiser verificar sem lançar erro
 */
function tryNormalizePaymentMethod(method) {
    try {
        return normalizePaymentMethod(method);
    }
    catch {
        return null;
    }
}
/**
 * Retorna nome amigável para exibição
 */
function getPaymentMethodDisplayName(method) {
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
//# sourceMappingURL=payment-methods.js.map