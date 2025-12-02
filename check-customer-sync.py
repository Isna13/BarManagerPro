import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Ver TODOS os itens de customer na sync_queue
print('=== TODOS OS CUSTOMERS NA SYNC_QUEUE ===')
cursor = conn.execute('''
    SELECT entity, operation, status, entity_id, data, last_error, processed_at
    FROM sync_queue 
    WHERE entity = 'customer'
    ORDER BY processed_at DESC
''')
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    name = data.get('firstName', data.get('full_name', 'N/A'))
    print(f"ID: {row['entity_id']}")
    print(f"  Status: {row['status']}, Op: {row['operation']}")
    print(f"  Name: {name}")
    print(f"  Processed: {row['processed_at']}")
    if row['last_error']:
        print(f"  Error: {row['last_error'][:100]}")
    print()

# Verificar se há duplicados
print('\n=== VERIFICAÇÃO: Cliente da venda que falhou ===')
target_id = '7582e92e-d971-44c2-9faf-f3ee29eb97a6'
cursor = conn.execute('''
    SELECT entity, operation, status, data, last_error
    FROM sync_queue 
    WHERE entity_id = ?
''', (target_id,))
for row in cursor:
    print(f"Entity: {row['entity']}, Op: {row['operation']}, Status: {row['status']}")
    data = json.loads(row['data']) if row['data'] else {}
    print(f"Data sent: {json.dumps(data, indent=2)[:500]}")
    if row['last_error']:
        print(f"Error: {row['last_error']}")
    print()

conn.close()
