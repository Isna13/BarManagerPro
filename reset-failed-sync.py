"""
Script para forçar re-sincronização de itens falhados.
Reseta o status de 'failed' para 'pending' para que sejam re-tentados.
"""
import sqlite3

DB_PATH = 'C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db'

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

print('=== ANTES DA CORREÇÃO ===')
c.execute('SELECT status, COUNT(*) FROM sync_queue GROUP BY status')
for row in c.fetchall():
    print(f'  {row[0]}: {row[1]}')

print()
print('=== ITENS FALHADOS ===')
c.execute("SELECT entity, operation, last_error FROM sync_queue WHERE status = 'failed'")
for row in c.fetchall():
    erro = row[2][:60] if row[2] else 'None'
    print(f'  {row[0]} | {row[1]} | {erro}')

# Resetar itens falhados para pending
c.execute("""
    UPDATE sync_queue 
    SET status = 'pending', retry_count = 0, last_error = NULL 
    WHERE status = 'failed'
""")
conn.commit()

print()
print(f'✅ {c.rowcount} itens resetados para "pending"')

print()
print('=== DEPOIS DA CORREÇÃO ===')
c.execute('SELECT status, COUNT(*) FROM sync_queue GROUP BY status')
for row in c.fetchall():
    print(f'  {row[0]}: {row[1]}')

conn.close()
print()
print('🔄 Reinicie o Electron para que os itens sejam re-sincronizados.')
