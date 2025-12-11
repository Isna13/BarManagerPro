/**
 * Script para definir o estoque correto do Super Bock
 * Execute com: npx ts-node prisma/set-super-bock-stock.ts
 */

const RAILWAY_API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

interface Product {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  productId: string;
  qtyUnits: number;
}

async function login(): Promise<string> {
  console.log('🔐 Fazendo login...');
  
  const response = await fetch(`${RAILWAY_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Login falhou: ${response.status}`);
  }
  
  const data = await response.json() as { accessToken: string };
  console.log('✅ Login bem sucedido!');
  return data.accessToken;
}

async function getProducts(token: string): Promise<Product[]> {
  const response = await fetch(`${RAILWAY_API_URL}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar produtos: ${response.status}`);
  }
  
  return response.json() as Promise<Product[]>;
}

async function getInventory(token: string, branchId?: string): Promise<InventoryItem[]> {
  const url = branchId 
    ? `${RAILWAY_API_URL}/inventory?branchId=${branchId}`
    : `${RAILWAY_API_URL}/inventory`;
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar inventário: ${response.status}`);
  }
  
  return response.json() as Promise<InventoryItem[]>;
}

async function getInventoryByProduct(token: string, productId: string, branchId: string): Promise<InventoryItem | null> {
  const url = `${RAILWAY_API_URL}/inventory/product/${productId}?branchId=${branchId}`;
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Erro ao buscar inventário: ${response.status}`);
  }
  
  // findByProduct retorna um array
  const items = await response.json() as InventoryItem[];
  return items.length > 0 ? items[0] : null;
}

async function setStock(token: string, productId: string, branchId: string, newQty: number): Promise<void> {
  // Primeiro, buscar estoque atual para calcular ajuste necessário
  const item = await getInventoryByProduct(token, productId, branchId);
  const currentQty = item?.qtyUnits || 0;
  
  const adjustment = newQty - currentQty;
  
  console.log(`📝 Definindo estoque: atual=${currentQty}, novo=${newQty}, ajuste=${adjustment}`);
  
  if (adjustment === 0) {
    console.log('✅ Estoque já está no valor correto!');
    return;
  }
  
  const response = await fetch(`${RAILWAY_API_URL}/inventory/adjust-by-product`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId,
      branchId,
      adjustment,
      reason: 'Correção de estoque - sincronização'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao definir estoque: ${response.status} - ${error}`);
  }
  
  console.log('✅ Estoque definido com sucesso!');
}

async function main() {
  try {
    // Login
    const token = await login();
    
    // Buscar produtos
    console.log('🔍 Buscando produtos...');
    const products = await getProducts(token);
    
    // Encontrar Super Bock
    const superBock = products.find(p => 
      p.name.toLowerCase().includes('super bock') ||
      p.name.toLowerCase().includes('superbock')
    );
    
    if (!superBock) {
      console.log('❌ Produto Super Bock não encontrado!');
      return;
    }
    
    console.log(`✅ Produto encontrado: ${superBock.name} (ID: ${superBock.id})`);
    
    // Definir estoque correto (240 unidades - era 246, vendeu 6)
    const TARGET_STOCK = 240;
    
    await setStock(token, superBock.id, 'main-branch', TARGET_STOCK);
    
    // Verificar novo estoque
    const updatedSuperBock = await getInventoryByProduct(token, superBock.id, 'main-branch');
    
    if (updatedSuperBock) {
      console.log(`📦 Estoque final: ${updatedSuperBock.qtyUnits} unidades`);
    } else {
      console.log('⚠️ Não foi possível verificar estoque final');
    }
    
    console.log('\n✅ Correção concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

main();
