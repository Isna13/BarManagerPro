import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Ver todas as vendas no sync_queue
print('=== VENDAS NO SYNC_QUEUE ===')
cursor = conn.execute('''
    SELECT entity_id, operation, status, data, last_error
    FROM sync_queue 
    WHERE entity = 'sale'
    ORDER BY status
''')
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    sale_id = data.get('id', row['entity_id'])
    customer_id = data.get('customerId', 'N/A')
    print(f"Sale: {row['entity_id'][:30]}...")
    print(f"  Status: {row['status']}")
    print(f"  Customer: {customer_id}")
    print(f"  Sale Number: {data.get('saleNumber', 'N/A')}")
    if row['last_error']:
        print(f"  Error: {row['last_error'][:100]}")
    print()

# Ver todas as vendas locais
print('\n=== VENDAS LOCAIS ===')
cursor = conn.execute('''
    SELECT id, sale_number, customer_id, status, total, paid_amount
    FROM sales
    ORDER BY created_at DESC
    LIMIT 10
''')
for row in cursor:
    print(f"Sale: {row['id'][:30]}...")
    print(f"  Number: {row['sale_number']}")
    print(f"  Customer: {row['customer_id']}")
    print(f"  Status: {row['status']}, Total: {row['total']}, Paid: {row['paid_amount']}")
    print()

# Ver sale_items pendentes e qual sale eles referenciam
print('\n=== SALE_ITEMS PENDENTES - REFERÊNCIAS ===')
cursor = conn.execute('''
    SELECT entity_id, data
    FROM sync_queue 
    WHERE entity = 'sale_item' AND status = 'pending'
''')
sale_ids = set()
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    sale_id = data.get('saleId')
    if sale_id:
        sale_ids.add(sale_id)
        
print(f"Sale IDs referenciados: {sale_ids}")

# Verificar se essas vendas existem no Railway (via sync_queue completed)
print('\n=== VERIFICAR SE VENDAS EXISTEM (completed) ===')
for sale_id in sale_ids:
    cursor = conn.execute('''
        SELECT status FROM sync_queue 
        WHERE entity = 'sale' AND entity_id = ?
    ''', (sale_id,))
    row = cursor.fetchone()
    if row:
        print(f"  {sale_id}: {row['status']}")
    else:
        print(f"  {sale_id}: NOT FOUND in sync_queue!")

conn.close()
