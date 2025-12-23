/**
 * Script para forçar sincronização dos itens pendentes
 * Simula o que o SyncManager faz
 */

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const DB_PATH = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
const API_BASE = 'https://barmanagerbackend-production.up.railway.app/api/v1';

// Credenciais - o usuário pode alterar
const CREDENTIALS = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

async function main() {
  console.log('🔄 Forçando sincronização...\n');
  
  const db = new Database(DB_PATH);
  
  // 1. Fazer login
  console.log('🔐 Fazendo login...');
  const loginResponse = await axios.post(`${API_BASE}/auth/login`, CREDENTIALS);
  const token = loginResponse.data.accessToken;
  console.log('✅ Login OK\n');
  
  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // 2. Buscar itens pendentes
  const items = db.prepare(`
    SELECT * FROM sync_queue 
    WHERE status = 'pending' 
    ORDER BY priority ASC
  `).all();
  
  console.log(`📋 ${items.length} itens pendentes:\n`);
  
  for (const item of items) {
    const data = JSON.parse(item.data);
    console.log(`⏳ ${item.entity}/${item.operation}: ${data.name || data.id}`);
    
    try {
      let endpoint;
      let payload;
      
      switch (item.entity) {
        case 'category':
          endpoint = '/categories';
          payload = {
            id: data.id,
            name: data.name,
            description: data.description || '',
            parentId: data.parent_id || null,
            sortOrder: data.sort_order || 0,
            isActive: data.is_active === 1
          };
          break;
          
        case 'supplier':
          endpoint = '/suppliers';
          payload = {
            id: data.id,
            name: data.name,
            code: data.code,
            contactPerson: data.contact_person || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            taxId: data.tax_id || '',
            paymentTerms: data.payment_terms || '',
            notes: data.notes || '',
            isActive: data.is_active === 1
          };
          break;
          
        case 'product':
          endpoint = '/products';
          payload = {
            id: data.id,
            name: data.name,
            sku: data.sku,
            barcode: data.barcode || '',
            categoryId: data.category_id,
            supplierId: data.supplier_id,
            priceUnit: data.price_unit,
            priceBox: data.price_box,
            costUnit: data.cost_unit,
            costBox: data.cost_box,
            unitsPerBox: data.units_per_box || 1,
            minStock: data.low_stock_alert || 0,
            trackInventory: data.track_inventory === 1,
            isMuntuEligible: data.is_muntu_eligible === 1,
            isActive: data.is_active === 1
          };
          break;
          
        default:
          console.log(`  ⏭️ Tipo ${item.entity} não suportado`);
          continue;
      }
      
      console.log(`  📤 POST ${endpoint}...`);
      const response = await api.post(endpoint, payload);
      console.log(`  ✅ Sucesso! ID: ${response.data.id}`);
      
      // Marcar como completado
      db.prepare('UPDATE sync_queue SET status = ?, processed_at = datetime(?) WHERE id = ?')
        .run('completed', new Date().toISOString(), item.id);
      
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      console.log(`  ❌ Erro: ${msg}`);
      
      // Marcar como falhou
      db.prepare('UPDATE sync_queue SET status = ?, retry_count = retry_count + 1, last_error = ? WHERE id = ?')
        .run('failed', String(msg), item.id);
    }
    
    console.log('');
  }
  
  // 3. Resumo
  console.log('📊 Resumo final:');
  const stats = db.prepare(`
    SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status
  `).all();
  stats.forEach(s => console.log(`  ${s.status}: ${s.count}`));
  
  db.close();
  console.log('\n✨ Concluído!');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
