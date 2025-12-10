import sqlite3
import os

db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("""
    SELECT entity, status, COUNT(*) as count 
    FROM sync_queue 
    WHERE entity IN ('purchase', 'purchase_item') 
    GROUP BY entity, status 
    ORDER BY entity, status
""")
rows = c.fetchall()

print('=== STATUS DA SYNC_QUEUE ===')
for row in rows:
    print(f"{row['entity']:15} | {row['status']:10} | {row['count']} itens")

print('\n=== ITENS PENDENTES ===')
c.execute("""
    SELECT entity, entity_id, operation 
    FROM sync_queue 
    WHERE entity IN ('purchase', 'purchase_item') AND status = 'pending'
    ORDER BY created_at
""")
pending = c.fetchall()
for row in pending:
    print(f"{row['entity']:15} | {row['operation']:8} | {row['entity_id']}")

conn.close()
