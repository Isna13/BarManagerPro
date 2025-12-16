/**
 * Enum global de métodos de pagamento - DEVE SER IDÊNTICO em todos os apps
 * Mobile, Backend e Electron devem usar os mesmos valores
 */
export declare const PaymentMethod: {
    readonly CASH: "CASH";
    readonly ORANGE_MONEY: "ORANGE_MONEY";
    readonly TELETAKU: "TELETAKU";
    readonly VALE: "VALE";
    readonly MIXED: "MIXED";
};
export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];
export declare const VALID_PAYMENT_METHODS: ("CASH" | "ORANGE_MONEY" | "TELETAKU" | "VALE" | "MIXED")[];
/**
 * Valida se o método de pagamento é válido
 */
export declare function isValidPaymentMethod(method: string | null | undefined): boolean;
/**
 * Normaliza o método de pagamento para o padrão global
 * NUNCA retorna um valor padrão - lança erro se inválido
 */
export declare function normalizePaymentMethod(method: string | null | undefined): PaymentMethodType;
/**
 * Tenta normalizar o método de pagamento, retorna null se inválido
 * Use quando quiser verificar sem lançar erro
 */
export declare function tryNormalizePaymentMethod(method: string | null | undefined): PaymentMethodType | null;
/**
 * Retorna nome amigável para exibição
 */
export declare function getPaymentMethodDisplayName(method: string): string;
//# sourceMappingURL=payment-methods.d.ts.map