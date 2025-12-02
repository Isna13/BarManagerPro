import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Ver vendas que falharam com detalhes completos
print('=== VENDAS FALHADAS - DETALHES ===')
cursor = conn.execute('''
    SELECT id, entity, operation, entity_id, data, last_error 
    FROM sync_queue 
    WHERE entity = 'sale' AND status = 'failed'
''')
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    print(f"Queue ID: {row['id']}")
    print(f"Entity ID (UUID da venda): {row['entity_id']}")
    print(f"Data enviada:")
    print(json.dumps(data, indent=2))
    print(f"Erro: {row['last_error'][:200] if row['last_error'] else 'N/A'}")
    print("-" * 60)

# Verificar se o id está nos dados
print('\n=== ANÁLISE: ID nos dados? ===')
cursor = conn.execute('''
    SELECT entity_id, data 
    FROM sync_queue 
    WHERE entity = 'sale' AND status = 'failed'
''')
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    id_in_data = data.get('id')
    print(f"Entity ID: {row['entity_id']}")
    print(f"ID nos dados: {id_in_data}")
    print(f"Match: {'✅ SIM' if id_in_data == row['entity_id'] else '❌ NÃO'}")

conn.close()
