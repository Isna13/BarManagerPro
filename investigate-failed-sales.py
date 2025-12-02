import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Ver vendas que falharam
print('=== VENDAS NO SYNC_QUEUE (FAILED) ===')
cursor = conn.execute('''
    SELECT id, data, last_error 
    FROM sync_queue 
    WHERE entity = 'sale' AND status = 'failed'
''')
failed_sales = list(cursor)
for row in failed_sales:
    data = json.loads(row['data']) if row['data'] else {}
    customer_id = data.get('customer_id') or data.get('customerId')
    print(f"Sale ID: {data.get('id', 'N/A')}")
    print(f"Customer ID: {customer_id}")
    error = row['last_error'][:150] if row['last_error'] else 'N/A'
    print(f"Error: {error}")
    print()

# Ver clientes locais
print('=== CLIENTES LOCAIS ===')
cursor = conn.execute('SELECT id, full_name FROM customers')
local_customers = {row['id']: row['full_name'] for row in cursor}
for cid, name in local_customers.items():
    print(f"  {cid} - {name}")

# Verificar se os customers das vendas falhadas existem
print('\n=== VERIFICAÇÃO DE CLIENTES DAS VENDAS FALHADAS ===')
for row in failed_sales:
    data = json.loads(row['data']) if row['data'] else {}
    customer_id = data.get('customer_id') or data.get('customerId')
    if customer_id:
        if customer_id in local_customers:
            print(f"  ✅ Cliente {customer_id} existe localmente: {local_customers[customer_id]}")
        else:
            print(f"  ❌ Cliente {customer_id} NÃO EXISTE localmente!")

# Verificar sync_queue de customers
print('\n=== CUSTOMERS NO SYNC_QUEUE ===')
cursor = conn.execute('''
    SELECT entity, operation, status, entity_id, last_error 
    FROM sync_queue 
    WHERE entity = 'customer'
    ORDER BY created_at DESC
    LIMIT 10
''')
for row in cursor:
    error = row['last_error'][:50] if row['last_error'] else 'N/A'
    print(f"  {row['entity']} | {row['operation']} | {row['status']} | {row['entity_id'][:20]}... | {error}")

conn.close()
