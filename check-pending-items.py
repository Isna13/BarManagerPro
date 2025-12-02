import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Ver sale_items pendentes
print('=== SALE_ITEMS PENDENTES ===')
cursor = conn.execute('''
    SELECT entity_id, data, last_error
    FROM sync_queue 
    WHERE entity = 'sale_item' AND status = 'pending'
''')
sale_items = list(cursor)
for row in sale_items:
    data = json.loads(row['data']) if row['data'] else {}
    sale_id = data.get('saleId')
    print(f"Item: {row['entity_id'][:30]}...")
    print(f"  Sale ID: {sale_id}")
    print(f"  Product: {data.get('productId', 'N/A')[:30]}...")
    if row['last_error']:
        print(f"  Last Error: {row['last_error'][:80]}")
    print()

# Ver vendas que esses items referenciam
print('\n=== VENDAS REFERENCIADAS ===')
sale_ids = set()
for row in sale_items:
    data = json.loads(row['data']) if row['data'] else {}
    if data.get('saleId'):
        sale_ids.add(data['saleId'])

for sale_id in sale_ids:
    # Verificar na sync_queue
    cursor = conn.execute('''
        SELECT status, data FROM sync_queue 
        WHERE entity = 'sale' AND entity_id = ?
    ''', (sale_id,))
    row = cursor.fetchone()
    if row:
        data = json.loads(row['data']) if row['data'] else {}
        print(f"Sale {sale_id[:30]}...")
        print(f"  Status: {row['status']}")
        print(f"  ID nos dados: {data.get('id', 'NÃO INCLUÍDO')}")
    else:
        print(f"Sale {sale_id[:30]}... NOT FOUND!")

# Verificar vendas locais
print('\n=== VENDAS LOCAIS (por ID) ===')
for sale_id in sale_ids:
    cursor = conn.execute('SELECT id, sale_number, customer_id, status, total FROM sales WHERE id = ?', (sale_id,))
    row = cursor.fetchone()
    if row:
        print(f"Sale {sale_id[:30]}...")
        print(f"  Number: {row['sale_number']}")
        print(f"  Customer: {row['customer_id']}")
        print(f"  Status: {row['status']}, Total: {row['total']}")

conn.close()
