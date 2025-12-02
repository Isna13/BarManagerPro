import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print('=== CLIENTES LOCAIS ===')
cursor = conn.execute('''
    SELECT id, code, full_name, phone, email 
    FROM customers
''')
customers = list(cursor)
for c in customers:
    print(f"ID: {c['id']}")
    print(f"  Nome: {c['full_name']}")
    print(f"  Telefone: {c['phone']}")
    print()

print('\n=== CLIENTES NO SYNC_QUEUE (completed) ===')
cursor = conn.execute('''
    SELECT entity_id, data, processed_at 
    FROM sync_queue 
    WHERE entity = 'customer' AND status = 'completed'
''')
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    print(f"Entity ID: {row['entity_id']}")
    print(f"ID nos dados: {data.get('id', 'NÃO ENVIADO')}")
    print(f"Data: {json.dumps(data, indent=2)}")
    print()

print('\n=== AÇÃO NECESSÁRIA ===')
print("Os clientes foram sincronizados SEM o ID.")
print("O backend criou IDs diferentes.")
print("Preciso reenviar os clientes COM o ID correto.")

conn.close()
