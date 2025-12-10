import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Buscar todos os purchase_items na sync_queue que não têm purchaseId nos dados
c.execute('''
    SELECT sq.id, sq.entity_id, sq.data, pi.purchase_id 
    FROM sync_queue sq
    JOIN purchase_items pi ON pi.id = sq.entity_id
    WHERE sq.entity = 'purchase_item'
''')
rows = c.fetchall()

print(f'Encontrados {len(rows)} itens de compra na sync_queue')
updated = 0

for row in rows:
    data = json.loads(row['data'] or '{}')
    if 'purchaseId' not in data:
        data['purchaseId'] = row['purchase_id']
        c.execute('UPDATE sync_queue SET data = ? WHERE id = ?', (json.dumps(data), row['id']))
        updated += 1
        print(f"  Atualizado item {row['entity_id']} com purchaseId {row['purchase_id']}")

conn.commit()
print(f'\nTotal atualizado: {updated} itens')
conn.close()
