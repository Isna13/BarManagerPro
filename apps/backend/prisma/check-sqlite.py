import sqlite3
import os
import json

db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db')

print(f'=== BANCO SQLite DESKTOP ===')
print(f'Localização: {db_path}')
print(f'Tamanho: {os.path.getsize(db_path) / 1024:.1f} KB')
print()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Listar tabelas e contagem
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print('Tabelas e registros:')
for (table,) in tables:
    try:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        if count > 0:
            print(f'  ✅ {table}: {count} registros')
    except Exception as e:
        print(f'  ⚠️ {table}: erro - {e}')

conn.close()
