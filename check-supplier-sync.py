import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

print('=== SYNC_QUEUE PARA SUPPLIERS ===')
c.execute("SELECT * FROM sync_queue WHERE entity = 'supplier' ORDER BY created_at DESC LIMIT 10")
rows = c.fetchall()
if not rows:
    print('Nenhum supplier na sync_queue')
else:
    for r in rows:
        print({
            'entityId': r['entity_id'],
            'operation': r['operation'],
            'status': r['status'],
            'error': (r['last_error'] or '')[:80]
        })

# Sincronizar o supplier que está faltando no Railway
print('\n=== SUPPLIER FALTANDO ===')
print('ID local: 157b6b29-73dd-45bf-8c76-e135d0ab1947 (Nela Agrossos)')
print('Não existe no Railway com este ID!')
print('Existe no Railway com ID: b1fdcdcb-24b5-4d80-a249-48e46c7e106c')

conn.close()
