import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar roles padrão
  console.log('📝 Criando roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador completo do sistema',
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      description: 'Gerente de filial',
      isSystem: true,
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: 'cashier' },
    update: {},
    create: {
      name: 'cashier',
      description: 'Operador de caixa/PDV',
      isSystem: true,
    },
  });

  const waiterRole = await prisma.role.upsert({
    where: { name: 'waiter' },
    update: {},
    create: {
      name: 'waiter',
      description: 'Garçom/Atendente',
      isSystem: true,
    },
  });

  const ownerRole = await prisma.role.upsert({
    where: { name: 'owner' },
    update: {},
    create: {
      name: 'owner',
      description: 'Proprietário (apenas visualização)',
      isSystem: true,
    },
  });

  // Criar permissões
  console.log('🔐 Criando permissões...');
  const permissions = [
    // Sales
    { resource: 'sales', action: 'create', description: 'Criar vendas' },
    { resource: 'sales', action: 'read', description: 'Visualizar vendas' },
    { resource: 'sales', action: 'update', description: 'Atualizar vendas' },
    { resource: 'sales', action: 'delete', description: 'Deletar vendas' },
    { resource: 'sales', action: 'cancel', description: 'Cancelar vendas' },
    
    // Products
    { resource: 'products', action: 'create', description: 'Criar produtos' },
    { resource: 'products', action: 'read', description: 'Visualizar produtos' },
    { resource: 'products', action: 'update', description: 'Atualizar produtos' },
    { resource: 'products', action: 'delete', description: 'Deletar produtos' },
    
    // Inventory
    { resource: 'inventory', action: 'create', description: 'Criar movimentações de estoque' },
    { resource: 'inventory', action: 'read', description: 'Visualizar estoque' },
    { resource: 'inventory', action: 'update', description: 'Atualizar estoque' },
    { resource: 'inventory', action: 'adjust', description: 'Ajustar estoque' },
    
    // Cash Box
    { resource: 'cashbox', action: 'open', description: 'Abrir caixa' },
    { resource: 'cashbox', action: 'close', description: 'Fechar caixa' },
    { resource: 'cashbox', action: 'read', description: 'Visualizar caixa' },
    
    // Customers
    { resource: 'customers', action: 'create', description: 'Criar clientes' },
    { resource: 'customers', action: 'read', description: 'Visualizar clientes' },
    { resource: 'customers', action: 'update', description: 'Atualizar clientes' },
    { resource: 'customers', action: 'delete', description: 'Deletar clientes' },
    
    // Debts
    { resource: 'debts', action: 'create', description: 'Criar dívidas' },
    { resource: 'debts', action: 'read', description: 'Visualizar dívidas' },
    { resource: 'debts', action: 'update', description: 'Atualizar dívidas' },
    { resource: 'debts', action: 'payment', description: 'Receber pagamento de dívida' },
    
    // Reports
    { resource: 'reports', action: 'read', description: 'Visualizar relatórios' },
    { resource: 'reports', action: 'export', description: 'Exportar relatórios' },
    
    // Settings
    { resource: 'settings', action: 'read', description: 'Visualizar configurações' },
    { resource: 'settings', action: 'update', description: 'Atualizar configurações' },
    
    // Users
    { resource: 'users', action: 'create', description: 'Criar usuários' },
    { resource: 'users', action: 'read', description: 'Visualizar usuários' },
    { resource: 'users', action: 'update', description: 'Atualizar usuários' },
    { resource: 'users', action: 'delete', description: 'Deletar usuários' },
    
    // Branches
    { resource: 'branches', action: 'create', description: 'Criar filiais' },
    { resource: 'branches', action: 'read', description: 'Visualizar filiais' },
    { resource: 'branches', action: 'update', description: 'Atualizar filiais' },
    { resource: 'branches', action: 'delete', description: 'Deletar filiais' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { 
        resource_action: { 
          resource: perm.resource, 
          action: perm.action 
        } 
      },
      update: {},
      create: perm,
    });
  }

  // Associar permissões aos roles
  console.log('🔗 Associando permissões aos roles...');
  
  // Admin: todas permissões
  const allPermissions = await prisma.permission.findMany();
  await prisma.role.update({
    where: { id: adminRole.id },
    data: {
      permissions: {
        connect: allPermissions.map(p => ({ id: p.id })),
      },
    },
  });

  // Manager: quase todas, exceto deletar usuários e filiais
  const managerPermissions = allPermissions.filter(p => 
    !(p.resource === 'users' && p.action === 'delete') &&
    !(p.resource === 'branches' && p.action === 'delete')
  );
  await prisma.role.update({
    where: { id: managerRole.id },
    data: {
      permissions: {
        connect: managerPermissions.map(p => ({ id: p.id })),
      },
    },
  });

  // Cashier: vendas, caixa, clientes, dívidas
  const cashierPermissions = allPermissions.filter(p => 
    ['sales', 'cashbox', 'customers', 'debts', 'products', 'inventory'].includes(p.resource) &&
    p.action !== 'delete'
  );
  await prisma.role.update({
    where: { id: cashierRole.id },
    data: {
      permissions: {
        connect: cashierPermissions.map(p => ({ id: p.id })),
      },
    },
  });

  // Waiter: vendas (criar/ler), produtos (ler)
  const waiterPermissions = allPermissions.filter(p => 
    (p.resource === 'sales' && ['create', 'read'].includes(p.action)) ||
    (p.resource === 'products' && p.action === 'read')
  );
  await prisma.role.update({
    where: { id: waiterRole.id },
    data: {
      permissions: {
        connect: waiterPermissions.map(p => ({ id: p.id })),
      },
    },
  });

  // Owner: apenas leitura de relatórios
  const ownerPermissions = allPermissions.filter(p => 
    p.resource === 'reports' || 
    (p.resource === 'sales' && p.action === 'read') ||
    (p.resource === 'inventory' && p.action === 'read')
  );
  await prisma.role.update({
    where: { id: ownerRole.id },
    data: {
      permissions: {
        connect: ownerPermissions.map(p => ({ id: p.id })),
      },
    },
  });

  // Criar filial principal
  console.log('🏢 Criando filial principal...');
  const mainBranch = await prisma.branch.upsert({
    where: { code: 'HQ001' },
    update: {},
    create: {
      code: 'HQ001',
      name: 'Filial Principal',
      address: 'Bissau, Guiné-Bissau',
      phone: '+245966000000',
      isHeadquarter: true,
      isActive: true,
      timezone: 'GMT+0',
    },
  });

  // Criar usuário admin
  console.log('👤 Criando usuário admin...');
  // NOTA: Em produção, use bcrypt para hash de senhas!
  // Senha temporária sem hash apenas para desenvolvimento inicial
  await prisma.user.upsert({
    where: { email: 'admin@barmanager.gw' },
    update: {},
    create: {
      email: 'admin@barmanager.gw',
      password: 'admin123', // TODO: Implementar hash com bcrypt no auth.service
      fullName: 'Administrador',
      phone: '+245966000001',
      roleId: adminRole.id,
      branchId: mainBranch.id,
      language: 'pt',
      isActive: true,
    },
  });

  // Criar categorias exemplo
  console.log('📂 Criando categorias de exemplo...');
  const categories = [
    { id: '1', name: 'Bebidas Alcoólicas', description: 'Cervejas, vinhos, licores' },
    { id: '2', name: 'Bebidas Não Alcoólicas', description: 'Refrigerantes, sucos, água' },
    { id: '3', name: 'Comidas', description: 'Pratos, lanches, petiscos' },
    { id: '4', name: 'Sobremesas', description: 'Doces e sobremesas' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // Criar produtos exemplo
  console.log('🍺 Criando produtos de exemplo...');
  const bebidasCat = await prisma.category.findFirst({ where: { name: 'Bebidas Alcoólicas' } });
  const refrigerantesCat = await prisma.category.findFirst({ where: { name: 'Bebidas Não Alcoólicas' } });
  
  if (bebidasCat && refrigerantesCat) {
    const products = [
      {
        sku: 'BEB001',
        name: 'Cerveja Sagres',
        categoryId: bebidasCat.id,
        branchId: mainBranch.id,
        priceUnit: 500, // 500 FCFA
        priceBox: 11000, // 11.000 FCFA (caixa com 24)
        costUnit: 350,
        costBox: 8000,
        unitsPerBox: 24,
        boxEnabled: true,
        lowStockAlert: 48, // 2 caixas
        reorderPoint: 72,
        reorderQty: 120,
      },
      {
        sku: 'BEB002',
        name: 'Vinho Tinto Português',
        categoryId: bebidasCat.id,
        branchId: mainBranch.id,
        priceUnit: 3500,
        costUnit: 2500,
        boxEnabled: false,
        lowStockAlert: 6,
        reorderPoint: 10,
        reorderQty: 20,
      },
      {
        sku: 'REF001',
        name: 'Coca-Cola 350ml',
        categoryId: refrigerantesCat.id,
        branchId: mainBranch.id,
        priceUnit: 300,
        priceBox: 6500,
        costUnit: 200,
        costBox: 4500,
        unitsPerBox: 24,
        boxEnabled: true,
        lowStockAlert: 48,
        reorderPoint: 72,
        reorderQty: 120,
      },
    ];

    for (const prod of products) {
      const product = await prisma.product.upsert({
        where: { sku: prod.sku },
        update: {},
        create: prod,
      });

      // Criar estoque inicial
      await prisma.inventoryItem.create({
        data: {
          productId: product.id,
          branchId: mainBranch.id,
          qtyUnits: 100,
          qtyBoxes: 4,
        },
      });
    }
  }

  console.log('✅ Seed completo!');
  console.log('\n📋 Informações de acesso:');
  console.log('Email: admin@barmanager.gw');
  console.log('Senha: admin123');
  console.log('\n⚠️  Altere a senha padrão em produção!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
