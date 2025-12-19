/**
 * Script para criar dívidas retroativas para vendas VALE que não têm dívida no Railway
 * 
 * Este script:
 * 1. Busca todas as vendas com paymentMethod='VALE' no Railway
 * 2. Verifica quais não têm registro de dívida associado
 * 3. Cria dívidas para as vendas que estão faltando
 * 
 * Uso: node fix-missing-vale-debts.js
 */

const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:qxMIvLBmQAcHgwOyFUXIeaHJjLWWFTLo@junction.proxy.rlwy.net:49977/railway';

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL }
  }
});

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 FIX: Criar dívidas retroativas para vendas VALE');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Buscar todas as vendas VALE
    console.log('📋 Buscando vendas VALE no Railway...\n');
    
    const valeSales = await prisma.sale.findMany({
      where: {
        paymentMethod: 'VALE'
      },
      include: {
        customer: true,
        payments: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Total de vendas VALE: ${valeSales.length}\n`);

    // 2. Buscar dívidas existentes por saleId
    const existingDebts = await prisma.debt.findMany({
      where: {
        saleId: { not: null }
      },
      select: {
        id: true,
        saleId: true
      }
    });

    const debtsBySaleId = new Map(existingDebts.map(d => [d.saleId, d.id]));
    console.log(`📊 Dívidas existentes com saleId: ${existingDebts.length}\n`);

    // 3. Encontrar vendas VALE sem dívida
    const salesWithoutDebt = valeSales.filter(sale => !debtsBySaleId.has(sale.id));
    
    console.log(`❌ Vendas VALE SEM dívida: ${salesWithoutDebt.length}\n`);

    if (salesWithoutDebt.length === 0) {
      console.log('✅ Todas as vendas VALE já possuem dívida associada!');
      return;
    }

    // 4. Listar vendas sem dívida
    console.log('📋 Vendas VALE que precisam de dívida:');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const sale of salesWithoutDebt) {
      const customerName = sale.customer?.fullName || sale.customerName || 'SEM CLIENTE';
      console.log(`   ${sale.saleNumber} | ${(sale.total/100).toFixed(0)} FCFA | Cliente: ${customerName} | ${sale.customerId ? '✅ ID' : '❌ SEM ID'}`);
    }
    console.log('');

    // 5. Criar dívidas apenas para vendas com customerId
    const salesWithCustomer = salesWithoutDebt.filter(s => s.customerId);
    const salesWithoutCustomer = salesWithoutDebt.filter(s => !s.customerId);

    console.log(`✅ Com cliente cadastrado: ${salesWithCustomer.length}`);
    console.log(`⚠️ Sem cliente (não será criada dívida): ${salesWithoutCustomer.length}\n`);

    if (salesWithCustomer.length === 0) {
      console.log('⚠️ Nenhuma venda VALE com cliente cadastrado para criar dívida.');
      return;
    }

    // Confirmar antes de criar
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  ATENÇÃO: Serão criadas dívidas para as vendas acima');
    console.log('═══════════════════════════════════════════════════════\n');

    // 6. Criar dívidas
    let created = 0;
    let errors = 0;

    for (const sale of salesWithCustomer) {
      try {
        // Verificar se já existe dívida (double-check)
        const existing = await prisma.debt.findFirst({
          where: { saleId: sale.id }
        });

        if (existing) {
          console.log(`   ⏭️ ${sale.saleNumber}: Dívida já existe (${existing.id})`);
          continue;
        }

        // Buscar um userId válido para createdBy
        const firstUser = await prisma.user.findFirst();
        if (!firstUser) {
          console.log(`   ❌ ${sale.saleNumber}: Nenhum usuário encontrado para createdBy`);
          errors++;
          continue;
        }

        // Criar dívida
        const debt = await prisma.debt.create({
          data: {
            debtNumber: `DEBT-FIX-${Date.now()}-${created}`,
            customer: { connect: { id: sale.customerId } },
            sale: { connect: { id: sale.id } },
            branch: { connect: { id: sale.branchId } },
            createdByUser: { connect: { id: firstUser.id } },
            originalAmount: sale.total,
            amount: sale.total,
            paidAmount: 0,
            balance: sale.total,
            status: 'pending',
          }
        });

        // Atualizar currentDebt do cliente
        await prisma.customer.update({
          where: { id: sale.customerId },
          data: {
            currentDebt: { increment: sale.total }
          }
        });

        console.log(`   ✅ ${sale.saleNumber}: Dívida criada (${debt.id}) - ${(sale.total/100).toFixed(0)} FCFA`);
        created++;

      } catch (e) {
        console.log(`   ❌ ${sale.saleNumber}: Erro - ${e.message}`);
        errors++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESULTADO:');
    console.log(`   ✅ Dívidas criadas: ${created}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro fatal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
