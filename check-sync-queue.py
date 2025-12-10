import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=== FILA DE SYNC (inventory) ===\n")
cur.execute("""
    SELECT * FROM sync_queue 
    WHERE entity LIKE '%inventory%'
    ORDER BY created_at DESC
    LIMIT 10
""")

rows = cur.fetchall()
if rows:
    for r in rows:
        row = dict(r)
        print(f"Entity: {row['entity']} | Op: {row['operation']} | Status: {row['status']}")
        print(f"  Retry: {row['retry_count']} | Error: {row.get('last_error', 'N/A')}")
        data = json.loads(row['data']) if row['data'] else {}
        print(f"  Data: {json.dumps(data, indent=4)}")
        print()
else:
    print("Nenhum item de inventory na fila de sync.")

print("\n=== TODA FILA DE SYNC PENDENTE ===\n")
cur.execute("""
    SELECT entity, COUNT(*) as count 
    FROM sync_queue 
    WHERE status = 'pending'
    GROUP BY entity
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} pendentes")

conn.close()
