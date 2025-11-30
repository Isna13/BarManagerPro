const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testando criação de venda...');
    
    const result = await prisma.sale.create({
      data: {
        saleNumber: 'TEST-' + Date.now(),
        branchId: 'main-branch',
        type: 'counter',
        cashierId: 'adf383bf-65ff-49dc-9f63-deb462bdc8c9',
        status: 'open',
      }
    });
    
    console.log('✅ Sucesso:', result.id, result.saleNumber);
    
    // Limpar
    await prisma.sale.delete({ where: { id: result.id } });
    console.log('✅ Limpeza OK');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code) console.error('   Código:', error.code);
    if (error.meta) console.error('   Meta:', JSON.stringify(error.meta));
  } finally {
    await prisma.$disconnect();
  }
}

test();
