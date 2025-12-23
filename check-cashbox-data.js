const { PrismaClient } = require('./apps/backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar caixa aberto
  const cashBox = await prisma.cashBox.findFirst({
    where: { status: 'open' },
    include: { branch: true }
  });
  
  if (!cashBox) {
    console.log('Nenhum caixa aberto');
    return;
  }
  
  console.log('=== CAIXA ABERTO ===');
  console.log('ID:', cashBox.id);
  console.log('Branch:', cashBox.branchId);
  console.log('Abertura:', cashBox.openedAt);
  console.log('Opening Cash:', cashBox.openingCash);
  
  // Vendas normais (Sale + Payment)
  const sales = await prisma.sale.findMany({
    where: {
      branchId: cashBox.branchId,
      openedAt: { gte: cashBox.openedAt }
    },
    include: { payments: true }
  });
  
  // TablePayments
  const tablePayments = await prisma.tablePayment.findMany({
    where: {
      processedAt: { gte: cashBox.openedAt },
      session: { branchId: cashBox.branchId }
    }
  });
  
  console.log('\n=== VENDAS NORMAIS (Sale) ===');
  console.log('Total vendas:', sales.length);
  const salesTotalAmount = sales.reduce((s, sale) => s + sale.total, 0);
  console.log('Total valor:', salesTotalAmount);
  
  // Pagamentos por método nas vendas
  let saleCash = 0, saleOrange = 0, saleVale = 0, saleCard = 0;
  for (const sale of sales) {
    for (const p of sale.payments) {
      const m = (p.method || '').toLowerCase();
      if (m === 'cash') saleCash += p.amount;
      else if (m === 'orange' || m === 'orange_money' || m === 'teletaku') saleOrange += p.amount;
      else if (m === 'vale' || m === 'debt') saleVale += p.amount;
      else if (m === 'card' || m === 'mixed') saleCard += p.amount;
    }
  }
  console.log('  - Cash:', saleCash);
  console.log('  - Orange/Teletaku:', saleOrange);
  console.log('  - Vale:', saleVale);
  console.log('  - Card:', saleCard);
  
  console.log('\n=== PAGAMENTOS DE MESAS (TablePayment) ===');
  console.log('Total registros:', tablePayments.length);
  const tableTotalAmount = tablePayments.reduce((s, tp) => s + tp.amount, 0);
  console.log('Total valor:', tableTotalAmount);
  
  let tableCash = 0, tableOrange = 0, tableVale = 0, tableCard = 0;
  for (const tp of tablePayments) {
    const m = (tp.method || '').toLowerCase();
    if (m === 'cash') tableCash += tp.amount;
    else if (m === 'orange' || m === 'orange_money' || m === 'teletaku') tableOrange += tp.amount;
    else if (m === 'vale' || m === 'debt') tableVale += tp.amount;
    else if (m === 'card' || m === 'mixed') tableCard += tp.amount;
    console.log('  -', tp.method, ':', tp.amount, 'em', tp.processedAt);
  }
  console.log('Subtotais TablePayment:');
  console.log('  - Cash:', tableCash);
  console.log('  - Orange/Teletaku:', tableOrange);
  console.log('  - Vale:', tableVale);
  console.log('  - Card:', tableCard);
  
  console.log('\n=== TOTAIS COMBINADOS (VALOR CORRETO) ===');
  const totalVendas = sales.length + tablePayments.length;
  const totalFaturamento = salesTotalAmount + tableTotalAmount;
  const totalCash = saleCash + tableCash;
  const totalOrange = saleOrange + tableOrange;
  const totalVale = saleVale + tableVale;
  const totalCard = saleCard + tableCard;
  
  console.log('Vendas:', totalVendas);
  console.log('Faturamento Total:', totalFaturamento);
  console.log('Cash:', totalCash);
  console.log('Orange:', totalOrange);
  console.log('Vale:', totalVale);
  console.log('Card:', totalCard);
  console.log('Soma métodos:', totalCash + totalOrange + totalVale + totalCard);
  
  console.log('\n=== COMPARAÇÃO COM APPS ===');
  console.log('Electron mostra: Vendas=18, Faturamento=81700, Vale=13500');
  console.log('Vendas-Mobile mostra: Vendas=23, Faturamento=82500, Vale=15500');
  console.log('Proprietário mostra: Vendas=83700');
}

main().catch(console.error).finally(() => prisma.$disconnect());
