import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function adjustSuperBockStock() {
  try {
    console.log('🔍 Buscando produto Super Bock...');
    
    // Buscar produto Super Bock
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: 'Super Bock', mode: 'insensitive' } },
          { name: { contains: 'Superbock', mode: 'insensitive' } },
        ]
      }
    });
    
    if (!product) {
      console.log('❌ Produto Super Bock não encontrado!');
      return;
    }
    
    console.log(`✅ Produto encontrado: ${product.name} (ID: ${product.id})`);
    
    // Buscar item de inventário
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        productId: product.id,
        branchId: 'main-branch'
      }
    });
    
    if (!inventoryItem) {
      console.log('❌ Item de inventário não encontrado para Super Bock!');
      return;
    }
    
    console.log(`📦 Estoque atual: ${inventoryItem.qtyUnits} unidades`);
    
    // Calcular novo estoque (decrementar 6 unidades)
    const adjustment = -6;
    const newQty = Math.max(0, inventoryItem.qtyUnits + adjustment);
    
    console.log(`📝 Ajustando estoque: ${inventoryItem.qtyUnits} -> ${newQty} (ajuste: ${adjustment})`);
    
    // Atualizar estoque
    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { qtyUnits: newQty }
    });
    
    // Registrar movimento
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: inventoryItem.id,
        type: 'adjustment',
        qtyUnits: adjustment,
        reason: 'Ajuste manual - correção de sync da venda mobile'
      }
    });
    
    console.log('✅ Estoque ajustado com sucesso!');
    
    // Verificar novo valor
    const updated = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItem.id }
    });
    
    console.log(`📦 Novo estoque: ${updated?.qtyUnits} unidades`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

adjustSuperBockStock();
