import sqlite3

DB_PATH = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'

conn = sqlite3.connect(DB_PATH)

# Resetar itens com falha para pendente
cursor = conn.execute("UPDATE sync_queue SET status = 'pending', retry_count = 0, last_error = NULL WHERE status = 'failed'")
conn.commit()

print(f'✅ Itens resetados: {cursor.rowcount}')

# Mostrar status atual
cursor = conn.execute("SELECT status, COUNT(*) FROM sync_queue GROUP BY status")
for row in cursor.fetchall():
    print(f'   {row[0]}: {row[1]}')

conn.close()
