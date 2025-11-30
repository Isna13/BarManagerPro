import sqlite3

DB_PATH = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

print('=' * 60)
print('DETALHES DAS FALHAS DE SINCRONIZAÇÃO')
print('=' * 60)

cursor = conn.execute("SELECT entity, operation, last_error, created_at FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC")
rows = cursor.fetchall()

for r in rows:
    print(f"\n📛 {r['entity']} / {r['operation']}")
    print(f"   Data: {r['created_at']}")
    print(f"   Erro: {r['last_error'][:200] if r['last_error'] else 'Nenhum'}")

conn.close()
