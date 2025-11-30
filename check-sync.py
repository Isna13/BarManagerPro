import sqlite3
import json
import urllib.request
import ssl

DB_PATH = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1'

# Ignorar verificação SSL para simplificar
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

auth_token = ''

def login():
    global auth_token
    data = json.dumps({
        'email': 'admin@barmanager.com',
        'password': 'Admin@123456'
    }).encode('utf-8')
    
    req = urllib.request.Request(
        f'{API_URL}/auth/login',
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    with urllib.request.urlopen(req, context=ssl_context) as response:
        result = json.loads(response.read().decode('utf-8'))
        auth_token = result['accessToken']
        return result

def fetch_api(endpoint):
    req = urllib.request.Request(
        f'{API_URL}{endpoint}',
        headers={
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
    )
    
    try:
        with urllib.request.urlopen(req, context=ssl_context) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f'Erro ao buscar {endpoint}: {e}')
        return []

def main():
    print('=' * 60)
    print('VERIFICAÇÃO DE SINCRONIZAÇÃO LOCAL vs RAILWAY')
    print('=' * 60)
    print()
    
    # Conectar ao SQLite local
    print('📂 Conectando ao banco SQLite local...')
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Login no Railway
    print('🔑 Fazendo login no Railway...')
    login()
    print('✅ Login OK\n')
    
    # ============ PRODUTOS ============
    print('📦 PRODUTOS')
    print('-' * 40)
    
    cursor.execute('SELECT id, name, sku, price_unit, cost_unit FROM products WHERE is_active = 1 ORDER BY name')
    local_products = cursor.fetchall()
    railway_products = fetch_api('/products')
    
    print(f'   Local (SQLite): {len(local_products)} produtos')
    print(f'   Railway:        {len(railway_products)} produtos')
    
    if local_products:
        print('\n   Produtos locais:')
        for p in local_products:
            print(f"   - {p['name']} (SKU: {p['sku']}) - Preço: {p['price_unit']}")
    
    if railway_products:
        print('\n   Produtos Railway:')
        for p in railway_products:
            print(f"   - {p['name']} (SKU: {p['sku']}) - Preço: {p['priceUnit']}")
    
    # ============ CATEGORIAS ============
    print('\n📁 CATEGORIAS')
    print('-' * 40)
    
    cursor.execute('SELECT id, name FROM categories ORDER BY name')
    local_categories = cursor.fetchall()
    railway_categories = fetch_api('/categories')
    
    print(f'   Local (SQLite): {len(local_categories)} categorias')
    print(f'   Railway:        {len(railway_categories)} categorias')
    
    if local_categories:
        print('\n   Categorias locais:')
        for c in local_categories:
            print(f"   - {c['name']}")
    
    if railway_categories:
        print('\n   Categorias Railway:')
        for c in railway_categories:
            print(f"   - {c['name']}")
    
    # ============ CLIENTES ============
    print('\n👥 CLIENTES')
    print('-' * 40)
    
    cursor.execute('SELECT id, full_name, phone FROM customers ORDER BY full_name')
    local_customers = cursor.fetchall()
    railway_customers = fetch_api('/customers')
    
    print(f'   Local (SQLite): {len(local_customers)} clientes')
    print(f'   Railway:        {len(railway_customers)} clientes')
    
    if local_customers:
        print('\n   Clientes locais:')
        for c in list(local_customers)[:10]:
            print(f"   - {c['full_name']} ({c['phone'] or 'sem tel'})")
    
    if railway_customers:
        print('\n   Clientes Railway:')
        for c in railway_customers[:10]:
            print(f"   - {c['fullName']} ({c.get('phone') or 'sem tel'})")
    
    # ============ VENDAS ============
    print('\n💰 VENDAS')
    print('-' * 40)
    
    cursor.execute('SELECT id, sale_number, total, status, created_at FROM sales ORDER BY created_at DESC')
    local_sales = cursor.fetchall()
    railway_sales = fetch_api('/sales')
    
    print(f'   Local (SQLite): {len(local_sales)} vendas')
    print(f'   Railway:        {len(railway_sales)} vendas')
    
    local_sales_total = sum(s['total'] or 0 for s in local_sales)
    railway_sales_total = sum(s['total'] or 0 for s in railway_sales)
    
    print(f'\n   Total vendas local:   {local_sales_total:,.0f} FCFA')
    print(f'   Total vendas Railway: {railway_sales_total:,.0f} FCFA')
    
    if local_sales:
        print('\n   Últimas vendas locais:')
        for s in list(local_sales)[:5]:
            print(f"   - {s['sale_number']}: {s['total']:,.0f} FCFA ({s['status']})")
    
    if railway_sales:
        print('\n   Últimas vendas Railway:')
        for s in railway_sales[:5]:
            print(f"   - {s['saleNumber']}: {s['total']:,.0f} FCFA ({s['status']})")
    
    # ============ INVENTÁRIO ============
    print('\n📊 INVENTÁRIO')
    print('-' * 40)
    
    cursor.execute('''
        SELECT i.id, p.name as product_name, i.qty_units 
        FROM inventory i 
        LEFT JOIN products p ON i.product_id = p.id 
        ORDER BY p.name
    ''')
    local_inventory = cursor.fetchall()
    railway_inventory = fetch_api('/inventory')
    
    print(f'   Local (SQLite): {len(local_inventory)} itens')
    print(f'   Railway:        {len(railway_inventory)} itens')
    
    if local_inventory:
        print('\n   Inventário local:')
        for i in local_inventory:
            print(f"   - {i['product_name'] or 'Produto'}: {i['qty_units']} unidades")
    
    if railway_inventory:
        print('\n   Inventário Railway:')
        for i in railway_inventory:
            product = i.get('product', {})
            name = product.get('name', 'Produto') if product else 'Produto'
            print(f"   - {name}: {i['qtyUnits']} unidades")
    
    # ============ USUÁRIOS ============
    print('\n👤 USUÁRIOS')
    print('-' * 40)
    
    cursor.execute('SELECT id, email, full_name, role FROM users ORDER BY full_name')
    local_users = cursor.fetchall()
    railway_users = fetch_api('/users')
    
    print(f'   Local (SQLite): {len(local_users)} usuários')
    print(f'   Railway:        {len(railway_users)} usuários')
    
    if local_users:
        print('\n   Usuários locais:')
        for u in local_users:
            print(f"   - {u['full_name']} ({u['email']}) - {u['role']}")
    
    if railway_users:
        print('\n   Usuários Railway:')
        for u in railway_users:
            print(f"   - {u['fullName']} ({u['email']}) - {u['role']}")
    
    # ============ SYNC QUEUE ============
    print('\n🔄 FILA DE SINCRONIZAÇÃO')
    print('-' * 40)
    
    try:
        cursor.execute("SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at")
        pending_sync = cursor.fetchall()
        print(f'   Itens pendentes: {len(pending_sync)}')
        
        if pending_sync:
            print('\n   Pendentes:')
            for s in list(pending_sync)[:10]:
                print(f"   - {s['table_name']}/{s['record_id']} ({s['operation']})")
        
        cursor.execute("SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5")
        failed_sync = cursor.fetchall()
        if failed_sync:
            print(f'\n   ❌ Itens com falha: {len(failed_sync)}')
            for s in failed_sync:
                print(f"   - {s['table_name']}/{s['record_id']}: {s['error_message'] or 'sem erro'}")
    except Exception as e:
        print(f'   Tabela sync_queue não existe ou erro: {e}')
    
    # ============ RESUMO ============
    print('\n' + '=' * 60)
    print('RESUMO DA COMPARAÇÃO')
    print('=' * 60)
    
    comparison = [
        ('Produtos', len(local_products), len(railway_products)),
        ('Categorias', len(local_categories), len(railway_categories)),
        ('Clientes', len(local_customers), len(railway_customers)),
        ('Vendas', len(local_sales), len(railway_sales)),
        ('Inventário', len(local_inventory), len(railway_inventory)),
        ('Usuários', len(local_users), len(railway_users)),
    ]
    
    print('\n   Entidade      | Local | Railway | Status')
    print('   ' + '-' * 50)
    
    for name, local, railway in comparison:
        if local == railway:
            status = '✅ OK'
        elif local > railway:
            status = '⚠️ Local > Railway'
        else:
            status = '⚠️ Railway > Local'
        print(f'   {name:<12} | {local:>5} | {railway:>7} | {status}')
    
    conn.close()
    print('\n✅ Verificação concluída!\n')

if __name__ == '__main__':
    main()
