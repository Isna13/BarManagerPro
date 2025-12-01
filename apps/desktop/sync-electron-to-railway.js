/**
 * Script para sincronizar dados do Electron (SQLite) para Railway (PostgreSQL)
 * 
 * Este script:
 * 1. Lê os dados reais do SQLite do app Electron
 * 2. Faz login na API do Railway
 * 3. Limpa todos os dados de teste do Railway
 * 4. Importa os dados reais do Electron
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Configurações
const SQLITE_PATH = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const CREDENTIALS = {
    email: 'isnatchuda1@gmail.com',
    password: 'isna123'
};

let authToken = null;

// Função para fazer requisições HTTP
async function apiRequest(method, endpoint, data = null) {
    const url = `${RAILWAY_API}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const options = {
        method,
        headers
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Login na API
async function login() {
    console.log('🔐 Fazendo login na API do Railway...');
    const result = await apiRequest('POST', '/auth/login', CREDENTIALS);
    authToken = result.accessToken;  // Campo correto é accessToken
    console.log('✅ Login realizado com sucesso!');
    console.log(`   Token: ${authToken.substring(0, 50)}...`);
    return authToken;
}

// Ler dados do SQLite
async function readSQLiteData() {
    console.log('\n📂 Lendo dados do SQLite...');
    console.log(`   Caminho: ${SQLITE_PATH}`);
    
    if (!fs.existsSync(SQLITE_PATH)) {
        throw new Error(`Banco SQLite não encontrado em: ${SQLITE_PATH}`);
    }
    
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(SQLITE_PATH);
    const db = new SQL.Database(buffer);
    
    const data = {};
    
    // Ler categorias - filtrar apenas a real "Cerveja"
    const allCategories = db.exec('SELECT * FROM categories');
    if (allCategories.length > 0) {
        const cols = allCategories[0].columns;
        const rows = allCategories[0].values;
        data.allCategories = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        // Filtrar: manter apenas "Cerveja" (a única categoria real)
        data.categories = data.allCategories.filter(c => 
            c.name && c.name.toLowerCase() === 'cerveja'
        );
        // Guardar ID da categoria Cerveja para filtrar produtos
        data.cervejaId = data.categories[0]?.id;
        console.log(`   📁 Categorias: ${data.categories.length} real (de ${data.allCategories.length} total)`);
    }
    
    // Ler fornecedores
    const suppliers = db.exec('SELECT * FROM suppliers');
    if (suppliers.length > 0) {
        const cols = suppliers[0].columns;
        const rows = suppliers[0].values;
        data.suppliers = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   🏭 Fornecedores: ${data.suppliers.length}`);
        data.suppliers.forEach(s => console.log(`      - ${s.name}`));
    }
    
    // Ler clientes
    const customers = db.exec('SELECT * FROM customers');
    if (customers.length > 0) {
        const cols = customers[0].columns;
        const rows = customers[0].values;
        data.customers = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   👥 Clientes: ${data.customers.length}`);
        data.customers.forEach(c => console.log(`      - ${c.full_name}`));
    }
    
    // Ler produtos - filtrar apenas os da categoria Cerveja
    const products = db.exec('SELECT * FROM products');
    if (products.length > 0) {
        const cols = products[0].columns;
        const rows = products[0].values;
        const allProducts = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        // Filtrar: manter apenas produtos da categoria Cerveja (excluir produto de teste)
        data.products = allProducts.filter(p => p.category_id === data.cervejaId);
        console.log(`   📦 Produtos: ${data.products.length} reais (de ${allProducts.length} total)`);
        data.products.forEach(p => console.log(`      - ${p.name} (SKU: ${p.sku})`));
    }
    
    // Ler estoque
    const inventory = db.exec('SELECT * FROM inventory_items');
    if (inventory.length > 0) {
        const cols = inventory[0].columns;
        const rows = inventory[0].values;
        data.inventory = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   📊 Itens de estoque: ${data.inventory.length}`);
    }
    
    // Ler vendas
    const sales = db.exec('SELECT * FROM sales');
    if (sales.length > 0) {
        const cols = sales[0].columns;
        const rows = sales[0].values;
        data.sales = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   💰 Vendas: ${data.sales.length}`);
    }
    
    // Ler itens de venda
    const saleItems = db.exec('SELECT * FROM sale_items');
    if (saleItems.length > 0) {
        const cols = saleItems[0].columns;
        const rows = saleItems[0].values;
        data.saleItems = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   📋 Itens de venda: ${data.saleItems.length}`);
    }
    
    // Ler dívidas
    const debts = db.exec('SELECT * FROM debts');
    if (debts.length > 0) {
        const cols = debts[0].columns;
        const rows = debts[0].values;
        data.debts = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   💳 Dívidas: ${data.debts.length}`);
    }
    
    // Ler caixas
    const cashBoxes = db.exec('SELECT * FROM cash_boxes');
    if (cashBoxes.length > 0) {
        const cols = cashBoxes[0].columns;
        const rows = cashBoxes[0].values;
        data.cashBoxes = rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        console.log(`   🏦 Caixas: ${data.cashBoxes.length}`);
    }
    
    db.close();
    return data;
}

// Limpar dados do Railway usando endpoint dedicado
async function clearRailwayData() {
    console.log('\n🗑️  Limpando dados do Railway...');
    
    try {
        // Usar o endpoint reset-database que deleta tudo de uma vez
        const result = await apiRequest('DELETE', '/import/reset-database');
        console.log('✅ Banco limpo com sucesso!');
        return result;
    } catch (err) {
        console.log(`   ⚠️ Erro ao limpar banco: ${err.message}`);
        console.log('   Tentando método alternativo (deletar item por item)...');
        
        // Fallback: deletar manualmente
        const endpoints = [
            { name: 'Vendas', path: '/sales' },
            { name: 'Estoque', path: '/inventory' },
            { name: 'Produtos', path: '/products' },
            { name: 'Categorias', path: '/categories' },
            { name: 'Clientes', path: '/customers' },
            { name: 'Fornecedores', path: '/suppliers' }
        ];
        
        for (const ep of endpoints) {
            try {
                console.log(`   Buscando ${ep.name}...`);
                const items = await apiRequest('GET', ep.path);
                
                if (Array.isArray(items) && items.length > 0) {
                    console.log(`   Deletando ${items.length} ${ep.name.toLowerCase()}...`);
                    for (const item of items) {
                        try {
                            await apiRequest('DELETE', `${ep.path}/${item.id}`);
                            await sleep(100);
                        } catch (delErr) {
                            // Ignorar erros de deleção individual
                        }
                    }
                }
            } catch (listErr) {
                // Ignorar erros de listagem
            }
            await sleep(200);
        }
        
        console.log('✅ Limpeza concluída (método alternativo)!');
    }
}

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Importar dados para o Railway via endpoint bulk
async function importToRailway(data) {
    console.log('\n📤 Importando dados para o Railway...');
    
    // Primeiro, buscar uma branch válida
    let defaultBranchId = null;
    try {
        const branches = await apiRequest('GET', '/branches');
        if (Array.isArray(branches) && branches.length > 0) {
            defaultBranchId = branches[0].id;
            console.log(`   📍 Usando branch padrão: ${branches[0].name} (${defaultBranchId})`);
        }
    } catch (err) {
        console.log('   ⚠️ Não foi possível obter branches');
    }
    
    // Preparar dados no formato esperado pelo endpoint bulk
    const bulkData = {
        // Categorias - filtrar apenas Cerveja
        categories: (data.categories || []).map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            is_active: 1
        })),
        
        // Fornecedores - gerar code pois não existe no SQLite
        suppliers: (data.suppliers || []).map((s, i) => ({
            id: s.id,
            code: `SUP-${(i + 1).toString().padStart(3, '0')}`,
            name: s.name,
            phone: s.phone || '',
            email: s.email || '',
            address: s.address || '',
            is_active: 1
        })),
        
        // Clientes - mapear full_name para o formato esperado
        customers: (data.customers || []).map(c => ({
            id: c.id,
            code: c.code || `CUST-${c.id.substring(0, 8)}`,
            full_name: c.full_name || c.name,
            phone: c.phone || '',
            email: c.email || '',
            credit_limit: c.credit_limit || 0,
            is_active: 1
        })),
        
        // Produtos
        products: (data.products || []).map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category_id: p.category_id,
            price_unit: p.price_unit || 0,
            unit_price: p.price_unit || 0,
            price_box: p.price_box || 0,
            box_price: p.price_box || 0,
            cost_unit: p.cost_unit || 0,
            cost_box: p.cost_box || 0,
            units_per_box: p.units_per_box || 1,
            is_active: 1
        })),
        
        // Estoque - adicionar branch_id
        inventory_items: (data.inventory || []).map(i => ({
            id: i.id,
            product_id: i.product_id,
            branch_id: defaultBranchId,
            qty_units: i.qty_units || 0,
            qty_boxes: i.closed_boxes || 0,
            min_stock: i.min_stock || 0
        })),
        
        // Vendas - adicionar branch_id
        sales: (data.sales || []).map(s => ({
            id: s.id,
            sale_number: s.sale_number || `SALE-${Date.now()}`,
            customer_id: s.customer_id,
            branch_id: defaultBranchId,
            total: s.total_amount || s.total || 0,
            total_amount: s.total_amount || s.total || 0,
            status: s.status || 'closed',
            created_at: s.created_at
        })),
        
        // Itens de venda
        sale_items: (data.saleItems || []).map(si => ({
            id: si.id,
            sale_id: si.sale_id,
            product_id: si.product_id,
            quantity: si.quantity || si.qty_units || 1,
            qty_units: si.quantity || si.qty_units || 1,
            unit_price: si.unit_price || 0,
            subtotal: si.subtotal || si.total_price || 0,
            total: si.total_price || si.subtotal || 0
        })),
        
        // Dívidas
        debts: (data.debts || []).filter(d => (d.amount || d.original_amount) > 0).map(d => ({
            id: d.id,
            debt_number: d.debt_number || `DEBT-${Date.now()}`,
            customer_id: d.customer_id,
            sale_id: d.sale_id,
            original_amount: d.amount || d.original_amount || 1,
            paid_amount: d.paid_amount || 0,
            balance: d.balance || (d.amount || d.original_amount || 0) - (d.paid_amount || 0),
            status: d.status || 'pending'
        })),
        
        // Caixas
        cash_boxes: (data.cashBoxes || []).map(cb => ({
            id: cb.id,
            box_number: cb.box_number || `BOX-${Date.now()}`,
            branch_id: defaultBranchId,
            status: cb.status || 'closed',
            opening_balance: cb.opening_balance || cb.openingBalance || 0,
            closing_balance: cb.closing_balance || cb.closingBalance || 0
        }))
    };
    
    console.log('\n   📊 Dados preparados para importação:');
    console.log(`      Categorias: ${bulkData.categories.length}`);
    console.log(`      Fornecedores: ${bulkData.suppliers.length}`);
    console.log(`      Clientes: ${bulkData.customers.length}`);
    console.log(`      Produtos: ${bulkData.products.length}`);
    console.log(`      Estoque: ${bulkData.inventory_items.length}`);
    console.log(`      Vendas: ${bulkData.sales.length}`);
    console.log(`      Itens de venda: ${bulkData.sale_items.length}`);
    console.log(`      Dívidas: ${bulkData.debts.length}`);
    console.log(`      Caixas: ${bulkData.cash_boxes.length}`);
    
    // Usar endpoint de importação em bulk
    console.log('\n   🚀 Enviando dados para o endpoint de importação bulk...');
    try {
        const result = await apiRequest('POST', '/import/sqlite-data', bulkData);
        console.log('   ✅ Importação concluída!');
        if (result) {
            console.log('   📋 Resultado:', JSON.stringify(result, null, 2));
        }
    } catch (err) {
        console.log(`   ⚠️ Erro na importação bulk: ${err.message}`);
    }
}

// Função principal
async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     SINCRONIZAÇÃO ELECTRON (SQLite) → RAILWAY (PostgreSQL) ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    try {
        // 1. Login
        await login();
        
        // 2. Ler dados do SQLite
        const data = await readSQLiteData();
        
        // 3. Mostrar resumo dos dados a serem sincronizados
        console.log('\n📋 RESUMO DOS DADOS A SINCRONIZAR:');
        console.log(`   Categorias reais: ${data.categories?.length || 0} (de ${data.allCategories?.length || 0} total)`);
        console.log(`   Fornecedores: ${data.suppliers?.length || 0}`);
        console.log(`   Clientes: ${data.customers?.length || 0}`);
        console.log(`   Produtos: ${data.products?.length || 0}`);
        console.log(`   Itens de estoque: ${data.inventory?.length || 0}`);
        console.log(`   Vendas: ${data.sales?.length || 0}`);
        console.log(`   Itens de venda: ${data.saleItems?.length || 0}`);
        console.log(`   Dívidas: ${data.debts?.length || 0}`);
        console.log(`   Caixas: ${data.cashBoxes?.length || 0}`);
        
        // 4. Limpar Railway
        await clearRailwayData();
        
        // 5. Importar dados
        await importToRailway(data);
        
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║          ✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!           ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Executar
main();
