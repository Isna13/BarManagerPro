/**
 * Script para resetar o banco Railway usando Prisma diretamente
 * Execute do backend com: npx ts-node prisma/reset-railway.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Iniciando reset do banco Railway...\n');

  try {
    // Ordem de deleção respeitando foreign keys
    console.log('   Deletando SaleItems...');
    await prisma.saleItem.deleteMany({});
    
    console.log('   Deletando Sales...');
    await prisma.sale.deleteMany({});
    
    console.log('   Deletando Debts...');
    await prisma.debt.deleteMany({});
    
    console.log('   Deletando InventoryItems...');
    await prisma.inventoryItem.deleteMany({});
    
    console.log('   Deletando Products...');
    await prisma.product.deleteMany({});
    
    console.log('   Deletando Categories...');
    await prisma.category.deleteMany({});
    
    console.log('   Deletando Customers...');
    await prisma.customer.deleteMany({});
    
    console.log('   Deletando Suppliers...');
    await prisma.supplier.deleteMany({});
    
    console.log('   Deletando CashBoxes...');
    await prisma.cashBox.deleteMany({});
    
    console.log('\n✅ Reset concluído!');
    
    // Verificar contagens
    const counts = {
      categories: await prisma.category.count(),
      suppliers: await prisma.supplier.count(),
      customers: await prisma.customer.count(),
      products: await prisma.product.count(),
      inventory: await prisma.inventoryItem.count(),
      sales: await prisma.sale.count(),
    };
    
    console.log('\n📊 Contagem final:');
    console.log(`   Categorias: ${counts.categories}`);
    console.log(`   Fornecedores: ${counts.suppliers}`);
    console.log(`   Clientes: ${counts.customers}`);
    console.log(`   Produtos: ${counts.products}`);
    console.log(`   Estoque: ${counts.inventory}`);
    console.log(`   Vendas: ${counts.sales}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
