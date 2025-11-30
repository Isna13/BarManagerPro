"""
Script para sincronizar vendas do SQLite local para o Railway
"""
import sqlite3
import json
import urllib.request
import ssl
import time

DB_PATH = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1'

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
        print('✅ Login OK')
        return result

def api_post(endpoint, data):
    req = urllib.request.Request(
        f'{API_URL}{endpoint}',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, context=ssl_context) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'  ❌ Erro HTTP {e.code}: {error_body[:200]}')
        return None

def api_get(endpoint):
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
        print(f'  ❌ Erro: {e}')
        return []

def sync_sales():
    print('=' * 60)
    print('SINCRONIZAÇÃO DE VENDAS LOCAL → RAILWAY')
    print('=' * 60)
    
    login()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Buscar vendas do Railway para evitar duplicatas
    railway_sales = api_get('/sales')
    railway_sale_numbers = set(s.get('saleNumber', '') for s in railway_sales)
    print(f'\n📊 Vendas já no Railway: {len(railway_sales)}')
    
    # Buscar vendas locais
    cursor = conn.execute('''
        SELECT * FROM sales 
        WHERE status IN ('paid', 'completed') 
        ORDER BY created_at ASC
    ''')
    local_sales = cursor.fetchall()
    print(f'📊 Vendas locais: {len(local_sales)}')
    
    synced = 0
    skipped = 0
    errors = 0
    
    for sale in local_sales:
        sale_number = sale['sale_number']
        
        # Pular se já existe
        if sale_number in railway_sale_numbers:
            print(f'  ⏭️ {sale_number} já existe no Railway')
            skipped += 1
            continue
        
        print(f'\n📤 Sincronizando {sale_number}...')
        
        # 1. Criar a venda
        sale_data = {
            'branchId': sale['branch_id'] or 'main-branch',
            'type': sale['type'] or 'counter',
        }
        
        # Só incluir customerId se existir
        if sale['customer_id']:
            sale_data['customerId'] = sale['customer_id']
        
        print(f'  Enviando: {json.dumps(sale_data)}')
        
        result = api_post('/sales', sale_data)
        if not result:
            print(f'  ❌ Falha ao criar venda {sale_number}')
            errors += 1
            continue
        
        new_sale_id = result.get('id')
        print(f'  ✅ Venda criada: {new_sale_id}')
        
        # 2. Adicionar itens
        items_cursor = conn.execute('''
            SELECT * FROM sale_items WHERE sale_id = ?
        ''', (sale['id'],))
        items = items_cursor.fetchall()
        
        for item in items:
            item_data = {
                'productId': item['product_id'],
                'qtyUnits': item['qty_units'] or 1,
                'isMuntu': bool(item['is_muntu']),
            }
            
            item_result = api_post(f'/sales/{new_sale_id}/items', item_data)
            if item_result:
                print(f'    ✅ Item adicionado: {item["product_id"][:8]}...')
            else:
                print(f'    ❌ Falha ao adicionar item')
        
        # 3. Processar pagamento
        payment_cursor = conn.execute('''
            SELECT * FROM payments WHERE sale_id = ?
        ''', (sale['id'],))
        payments = payment_cursor.fetchall()
        
        for payment in payments:
            payment_data = {
                'method': payment['method'] or 'cash',
                'amount': int(payment['amount'] or sale['total'] or 0),
            }
            
            pay_result = api_post(f'/sales/{new_sale_id}/payments', payment_data)
            if pay_result:
                print(f'    ✅ Pagamento processado: {payment_data["amount"]} FCFA')
            else:
                print(f'    ❌ Falha no pagamento')
        
        synced += 1
        time.sleep(0.5)  # Evitar rate limiting
    
    conn.close()
    
    print('\n' + '=' * 60)
    print('RESUMO')
    print('=' * 60)
    print(f'  ✅ Sincronizadas: {synced}')
    print(f'  ⏭️ Já existiam: {skipped}')
    print(f'  ❌ Erros: {errors}')
    print()

if __name__ == '__main__':
    sync_sales()
