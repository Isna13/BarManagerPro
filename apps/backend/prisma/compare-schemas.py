import sqlite3
import os

# Conectar ao SQLite do desktop
db_path = os.path.expandvars(r'%APPDATA%\@barmanager\desktop\barmanager.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=" * 60)
print("ESTRUTURA DO BANCO SQLITE (DESKTOP ELECTRON)")
print("=" * 60)

# Listar todas as tabelas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [t[0] for t in cursor.fetchall()]

print(f"\nTotal: {len(tables)} tabelas\n")

for table in tables:
    if table.startswith('_') or table.startswith('sqlite'):
        continue
    
    # Obter estrutura da tabela
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    
    # Contar registros
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    count = cursor.fetchone()[0]
    
    print(f"📋 {table} ({count} registros)")
    for col in columns:
        cid, name, type_, notnull, default, pk = col
        pk_marker = " [PK]" if pk else ""
        print(f"   - {name}: {type_}{pk_marker}")
    print()

conn.close()
