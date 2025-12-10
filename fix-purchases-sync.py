import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Buscar todas as purchases na sync_queue e adicionar purchaseNumber
c.execute('''
    SELECT sq.id, sq.entity_id, sq.data, p.purchase_number 
    FROM sync_queue sq
    JOIN purchases p ON p.id = sq.entity_id
    WHERE sq.entity = 'purchase'
''')
rows = c.fetchall()

print(f'Encontradas {len(rows)} compras na sync_queue')
updated = 0

for row in rows:
    data = json.loads(row['data'] or '{}')
    if 'purchaseNumber' not in data:
        data['purchaseNumber'] = row['purchase_number']
        c.execute('UPDATE sync_queue SET data = ? WHERE id = ?', (json.dumps(data), row['id']))
        updated += 1
        print(f"  Atualizado: {row['entity_id']} -> purchaseNumber: {row['purchase_number']}")

conn.commit()
print(f'Total atualizado: {updated} compras')
conn.close()
