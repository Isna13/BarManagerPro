import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function exportData() {
  console.log('📦 Exportando dados do banco local...');

  const data = {
    users: await prisma.user.findMany(),
    branches: await prisma.branch.findMany(),
    categories: await prisma.category.findMany(),
    products: await prisma.product.findMany(),
    customers: await prisma.customer.findMany(),
    inventoryItems: await prisma.inventoryItem.findMany(),
    sales: await prisma.sale.findMany(),
    saleItems: await prisma.saleItem.findMany(),
    payments: await prisma.payment.findMany(),
    cashBoxes: await prisma.cashBox.findMany(),
    debts: await prisma.debt.findMany(),
  };

  // Contar registros
  const totalRecords = Object.values(data).reduce((acc, arr) => acc + arr.length, 0);
  
  console.log('\n📊 Resumo dos dados exportados:');
  console.log(`   👥 Usuários: ${data.users.length}`);
  console.log(`   🏢 Filiais: ${data.branches.length}`);
  console.log(`   📂 Categorias: ${data.categories.length}`);
  console.log(`   📦 Produtos: ${data.products.length}`);
  console.log(`   👤 Clientes: ${data.customers.length}`);
  console.log(`   📊 Estoque: ${data.inventoryItems.length}`);
  console.log(`   🛒 Vendas: ${data.sales.length}`);
  console.log(`   📝 Itens de venda: ${data.saleItems.length}`);
  console.log(`   💰 Pagamentos: ${data.payments.length}`);
  console.log(`   🏦 Caixas: ${data.cashBoxes.length}`);
  console.log(`   📋 Dívidas: ${data.debts.length}`);
  console.log(`\n   ✨ Total: ${totalRecords} registros\n`);

  // Salvar em arquivo JSON
  fs.writeFileSync(
    'prisma/data-export.json',
    JSON.stringify(data, null, 2)
  );

  console.log('✅ Dados exportados para: prisma/data-export.json');
}

exportData()
  .catch((e) => {
    console.error('❌ Erro ao exportar dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
