import sqlite3

conn = sqlite3.connect('C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db')
c = conn.cursor()

print('=== SYNC QUEUE - ERROS ===')
c.execute("""SELECT entity, operation, status, last_error, retry_count 
             FROM sync_queue 
             WHERE status = 'failed' 
             ORDER BY created_at DESC LIMIT 20""")
for row in c.fetchall():
    erro = row[3][:100] if row[3] else 'None'
    print(f'{row[0]} | {row[1]} | {row[2]} | Retries: {row[4]} | Erro: {erro}')

print()
print('=== CONTAGEM POR STATUS ===')
c.execute('SELECT status, COUNT(*) FROM sync_queue GROUP BY status')
for row in c.fetchall():
    print(f'{row[0]}: {row[1]}')

print()
print('=== SYNC QUEUE - PENDENTES ===')
c.execute("""SELECT entity, operation, status, data
             FROM sync_queue 
             WHERE status = 'pending' 
             ORDER BY priority, created_at LIMIT 10""")
for row in c.fetchall():
    data_preview = row[3][:80] if row[3] else 'None'
    print(f'{row[0]} | {row[1]} | {row[2]} | {data_preview}...')

conn.close()
