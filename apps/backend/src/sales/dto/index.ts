import { IsUUID, IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  @IsOptional()
  id?: string; // ID opcional para sincronização com desktop

  @IsString()
  branchId: string;

  @IsString()
  @IsOptional()
  type?: string; // counter, table

  @IsUUID()
  @IsOptional()
  tableId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  // Campos para sincronização de vendas já completas do desktop
  @IsString()
  @IsOptional()
  customerName?: string; // Nome do cliente (para vendas de mesa sem cadastro)

  @IsString()
  @IsOptional()
  saleNumber?: string; // Número da venda

  @IsInt()
  @IsOptional()
  subtotal?: number; // Subtotal em centavos

  @IsInt()
  @IsOptional()
  total?: number; // Total em centavos

  @IsInt()
  @IsOptional()
  discountTotal?: number; // Desconto total em centavos

  @IsString()
  @IsOptional()
  status?: string; // open, paid, closed, cancelled

  @IsString()
  @IsOptional()
  paymentMethod?: string; // Método de pagamento principal

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddSaleItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  qtyUnits: number;

  @IsBoolean()
  @IsOptional()
  isMuntu?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProcessPaymentDto {
  @IsString()
  method: string; // cash, card, mobile_money, debt

  @IsInt()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  transactionId?: string;
}
