/**
 * Script para RESETAR completamente o banco Railway e importar dados do Electron
 * Execute com: npx ts-node reset-and-import.ts
 * 
 * IMPORTANTE: Os valores no SQLite estão em centavos. O backend espera valores inteiros em FCFA.
 * Exemplo: 40000 centavos = 400 FCFA
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dados REAIS do Electron (exportados do SQLite)
// Valores já convertidos de centavos para FCFA (dividido por 100)
const electronData = {
  categories: [
    { id: 'c8a5000a-cd35-410e-b1dc-6499ac11de36', name: 'Cerveja', description: 'Cervejas e bebidas geladas' }
  ],
  suppliers: [
    { id: '01332f91-3335-4db2-b698-2c1f61b37635', name: 'Fagoral' },
    { id: 'bb2d79c6-f684-41a4-a8a2-26f5fe7e3e8c', name: 'Alvalade' },
    { id: 'c9e57a2f-c91b-4b0d-8c47-2cb1d3d98a1c', name: 'Laus & Laus' },
  ],
  customers: [
    { id: '539bfaed-3dea-46fa-8253-6f97ef530c6b', name: 'William Brandão', phone: '+24595556677', email: 'brandao@gmail.com' },
    { id: '6e9b7c2a-1234-5678-90ab-cdef12345678', name: 'Cliente 2', phone: '+245955437890', email: null },
    { id: '7f0c8d3b-2345-6789-01bc-def234567890', name: 'Cliente 3', phone: '+245955134565', email: null },
    { id: '801d9e4c-3456-7890-12cd-ef3456789012', name: 'Cliente 4', phone: '+245955109087', email: null },
    { id: '912eaf5d-4567-8901-23de-f45678901234', name: 'Cliente 5', phone: '+245955482047', email: null },
  ],
  products: [
    { 
      id: 'c5b3a8cc-d072-4c01-8754-097b53fba8ce',
      name: 'Super Bock mini', 
      sku: 'BEB-001', 
      costPrice: 312, // 31250 centavos = 312.50 FCFA → 312
      sellingPrice: 400, // 40000 centavos = 400 FCFA
      boxPrice: 9600, // 960000 centavos = 9600 FCFA
      unitsPerBox: 24, 
      minStock: 10,
      supplierId: '01332f91-3335-4db2-b698-2c1f61b37635'
    },
    { 
      id: '3d25c55d-0847-4491-b62e-65be47093dbc',
      name: 'Cristal mini', 
      sku: 'BEB-002', 
      costPrice: 291, // 29166 centavos ≈ 292 FCFA
      sellingPrice: 400, // 40000 centavos = 400 FCFA
      boxPrice: 8400, // 840000 centavos = 8400 FCFA
      unitsPerBox: 24, 
      minStock: 10,
      supplierId: '01332f91-3335-4db2-b698-2c1f61b37635'
    },
    { 
      id: '7a8b9c0d-1234-5678-90ab-cdef12345678',
      name: 'Sagres', 
      sku: 'BEB-003', 
      costPrice: 312,
      sellingPrice: 400,
      boxPrice: 9600,
      unitsPerBox: 24, 
      minStock: 10,
      supplierId: 'bb2d79c6-f684-41a4-a8a2-26f5fe7e3e8c'
    },
    { 
      id: '8b9c0d1e-2345-6789-01bc-def234567890',
      name: 'XL', 
      sku: 'BEB-004', 
      costPrice: 625, // 62500 centavos = 625 FCFA
      sellingPrice: 800, // 80000 centavos = 800 FCFA
      boxPrice: 9600,
      unitsPerBox: 12, 
      minStock: 10,
      supplierId: 'bb2d79c6-f684-41a4-a8a2-26f5fe7e3e8c'
    },
    { 
      id: '9c0d1e2f-3456-7890-12cd-ef3456789012',
      name: 'Preta 33cl', 
      sku: 'BEB-005', 
      costPrice: 350,
      sellingPrice: 500,
      boxPrice: 10800,
      unitsPerBox: 24, 
      minStock: 10,
      supplierId: 'c9e57a2f-c91b-4b0d-8c47-2cb1d3d98a1c'
    },
  ],
  inventory: [
    { productId: 'c5b3a8cc-d072-4c01-8754-097b53fba8ce', quantity: 100, minQuantity: 10 }, // Super Bock
    { productId: '3d25c55d-0847-4491-b62e-65be47093dbc', quantity: 18, minQuantity: 10 }, // Cristal - conforme SQLite
    { productId: '7a8b9c0d-1234-5678-90ab-cdef12345678', quantity: 120, minQuantity: 10 }, // Sagres
    { productId: '8b9c0d1e-2345-6789-01bc-def234567890', quantity: 50, minQuantity: 10 }, // XL
    { productId: '9c0d1e2f-3456-7890-12cd-ef3456789012', quantity: 80, minQuantity: 10 }, // Preta
  ]
};

async function resetDatabase() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  RESET E IMPORTAÇÃO - RAILWAY DATABASE');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('🗑️  Deletando todos os dados existentes...\n');

  // Ordem correta para deletar respeitando foreign keys
  await prisma.inventoryMovement.deleteMany({});
  console.log('   ✅ Movimentações de estoque deletadas');
  
  await prisma.saleItem.deleteMany({});
  console.log('   ✅ Itens de venda deletados');
  
  await prisma.sale.deleteMany({});
  console.log('   ✅ Vendas deletadas');
  
  await prisma.debtPayment.deleteMany({});
  console.log('   ✅ Pagamentos de dívidas deletados');
  
  await prisma.debt.deleteMany({});
  console.log('   ✅ Dívidas deletadas');
  
  await prisma.purchaseItem.deleteMany({});
  console.log('   ✅ Itens de compra deletados');
  
  await prisma.purchase.deleteMany({});
  console.log('   ✅ Compras deletadas');
  
  await prisma.payment.deleteMany({});
  console.log('   ✅ Pagamentos deletados');
  
  await prisma.cashBox.deleteMany({});
  console.log('   ✅ Caixas deletados');
  
  await prisma.inventoryItem.deleteMany({});
  console.log('   ✅ Itens de inventário deletados');
  
  await prisma.product.deleteMany({});
  console.log('   ✅ Produtos deletados');
  
  await prisma.category.deleteMany({});
  console.log('   ✅ Categorias deletadas');
  
  await prisma.customer.deleteMany({});
  console.log('   ✅ Clientes deletados');
  
  await prisma.supplier.deleteMany({});
  console.log('   ✅ Fornecedores deletados');

  console.log('\n✅ Banco de dados limpo!\n');
}

async function importData() {
  console.log('📤 Importando dados do Electron...\n');

  // Buscar branch principal
  const mainBranch = await prisma.branch.findFirst({
    where: { isMain: true }
  });
  
  if (!mainBranch) {
    throw new Error('Branch principal não encontrado! Execute o seed primeiro.');
  }
  
  const branchId = mainBranch.id;
  console.log(`   📍 Branch principal: ${mainBranch.name}\n`);

  // 1. Criar categoria Cerveja
  console.log('1️⃣  Criando categorias...');
  const category = await prisma.category.create({
    data: {
      name: 'Cerveja',
      description: 'Cervejas e bebidas geladas'
    }
  });
  console.log(`   ✅ Categoria "${category.name}" criada`);

  // 2. Criar fornecedores
  console.log('\n2️⃣  Criando fornecedores...');
  const supplierMap: Record<string, string> = {};
  let supplierIndex = 1;
  for (const supplier of electronData.suppliers) {
    const created = await prisma.supplier.create({
      data: {
        code: `FORN-${String(supplierIndex++).padStart(3, '0')}`,
        name: supplier.name,
        branchId,
        isActive: true
      }
    });
    supplierMap[supplier.id] = created.id;
    console.log(`   ✅ Fornecedor "${created.name}"`);
  }

  // 3. Criar clientes
  console.log('\n3️⃣  Criando clientes...');
  const customerMap: Record<string, string> = {};
  let customerIndex = 1;
  for (const customer of electronData.customers) {
    const created = await prisma.customer.create({
      data: {
        code: `CUST-${String(customerIndex++).padStart(3, '0')}`,
        fullName: customer.name,
        phone: customer.phone,
        email: customer.email,
        branchId,
        isActive: true
      }
    });
    customerMap[customer.id] = created.id;
    console.log(`   ✅ Cliente "${created.fullName}"`);
  }

  // 4. Criar produtos
  console.log('\n4️⃣  Criando produtos...');
  const productMap: Record<string, string> = {};
  for (const product of electronData.products) {
    const created = await prisma.product.create({
      data: {
        name: product.name,
        sku: product.sku,
        categoryId: category.id,
        branchId,
        costUnit: product.costPrice,
        priceUnit: product.sellingPrice,
        priceBox: product.boxPrice,
        costBox: product.boxPrice ? Math.round(product.boxPrice * 0.8) : null,
        unitsPerBox: product.unitsPerBox,
        boxEnabled: true,
        lowStockAlert: product.minStock,
        trackInventory: true,
        isActive: true
      }
    });
    productMap[product.id] = created.id;
    console.log(`   ✅ Produto "${created.name}" (custo: ${product.costPrice}, venda: ${product.sellingPrice})`);
  }

  // 5. Criar inventário
  console.log('\n5️⃣  Criando estoque...');
  for (const inv of electronData.inventory) {
    const productId = productMap[inv.productId];
    if (productId) {
      await prisma.inventoryItem.create({
        data: {
          productId,
          branchId,
          qtyUnits: inv.quantity,
          qtyBoxes: Math.floor(inv.quantity / 24),
          location: 'Estoque Principal'
        }
      });
      console.log(`   ✅ Estoque: ${inv.quantity} unidades`);
    }
  }

  console.log('\n✅ Importação concluída!\n');
}

async function showSummary() {
  console.log('📊 Resumo final:\n');

  const categories = await prisma.category.count();
  const suppliers = await prisma.supplier.count();
  const products = await prisma.product.count();
  const inventory = await prisma.inventoryItem.count();
  const customers = await prisma.customer.count();
  const sales = await prisma.sale.count();

  console.log(`   - Categorias: ${categories}`);
  console.log(`   - Fornecedores: ${suppliers}`);
  console.log(`   - Produtos: ${products}`);
  console.log(`   - Itens de estoque: ${inventory}`);
  console.log(`   - Clientes: ${customers}`);
  console.log(`   - Vendas: ${sales}`);
}

async function main() {
  try {
    await resetDatabase();
    await importData();
    await showSummary();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ RESET E IMPORTAÇÃO CONCLUÍDOS!');
    console.log('═══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
