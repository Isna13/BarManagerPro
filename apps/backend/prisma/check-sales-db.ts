// Script para verificar vendas diretamente no banco Railway
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSales() {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log('Total vendas:', sales.length);
    console.log('');
    
    for (const sale of sales) {
      console.log('---');
      console.log('ID:', sale.id);
      console.log('SaleNumber:', sale.saleNumber);
      console.log('Status:', sale.status);
      console.log('Subtotal:', sale.subtotal);
      console.log('Total:', sale.total);
      console.log('CreatedAt:', sale.createdAt);
      console.log('Items:', sale.items?.length || 0);
      if (sale.items?.length > 0) {
        for (const item of sale.items) {
          console.log('  - Product:', item.product?.name, 'Qty:', item.qtyUnits, 'Total:', item.total);
        }
      }
      console.log('Payments:', sale.payments?.length || 0);
      if (sale.payments?.length > 0) {
        for (const payment of sale.payments) {
          console.log('  - Method:', payment.method, 'Amount:', payment.amount);
        }
      }
    }
  } catch (error: any) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSales();
