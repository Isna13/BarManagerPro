import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Limpando banco Railway...\n');

  try {
    // Ordem de deleção respeitando foreign keys
    const tables = [
      { name: 'payments', model: prisma.payment },
      { name: 'sale_items', model: prisma.saleItem },
      { name: 'debts', model: prisma.debt },
      { name: 'sales', model: prisma.sale },
      { name: 'cash_boxes', model: prisma.cashBox },
      { name: 'inventory_movements', model: prisma.inventoryMovement },
      { name: 'inventory_items', model: prisma.inventoryItem },
      { name: 'purchase_items', model: prisma.purchaseItem },
      { name: 'purchases', model: prisma.purchase },
      { name: 'product_price_history', model: prisma.productPriceHistory },
      { name: 'products', model: prisma.product },
      { name: 'categories', model: prisma.category },
      { name: 'customers', model: prisma.customer },
      { name: 'suppliers', model: prisma.supplier },
      { name: 'tables', model: prisma.table },
      { name: 'sessions', model: prisma.session },
      { name: 'audit_logs', model: prisma.auditLog },
      { name: 'notifications', model: prisma.notification },
      { name: 'users', model: prisma.user },
      { name: 'branches', model: prisma.branch },
      { name: 'roles', model: prisma.role },
    ];

    for (const table of tables) {
      try {
        const count = await table.model.deleteMany({});
        if (count.count > 0) {
          console.log(`   ✅ ${table.name}: ${count.count} registros deletados`);
        }
      } catch (e: any) {
        // Ignorar erros de tabelas que não existem
        if (!e.message.includes('does not exist')) {
          console.log(`   ⚠️  ${table.name}: ${e.message}`);
        }
      }
    }

    console.log('\n✅ Banco Railway limpo com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
