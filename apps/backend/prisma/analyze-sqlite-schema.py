import sqlite3
import os
import json

# Banco do Electron
db_path = os.path.expandvars(r'%APPDATA%\@barmanager\desktop\barmanager.db')

print("=" * 60)
print("ANÁLISE COMPLETA DO BANCO SQLITE DO ELECTRON")
print("=" * 60)
print(f"\nArquivo: {db_path}")
print(f"Tamanho: {os.path.getsize(db_path) / 1024:.1f} KB")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Listar todas as tabelas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
tables = [t[0] for t in cursor.fetchall()]

print(f"\nTotal de tabelas: {len(tables)}")
print("-" * 60)

total_records = 0
table_info = {}

for table in tables:
    # Contagem de registros
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    count = cursor.fetchone()[0]
    total_records += count
    
    # Estrutura da tabela
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    
    # Foreign keys
    cursor.execute(f"PRAGMA foreign_key_list({table})")
    fks = cursor.fetchall()
    
    table_info[table] = {
        'count': count,
        'columns': columns,
        'foreign_keys': fks
    }
    
    print(f"\n📋 {table} ({count} registros)")
    for col in columns:
        cid, name, type_, notnull, default, pk = col
        pk_mark = " [PK]" if pk else ""
        null_mark = " NOT NULL" if notnull else ""
        print(f"   {name}: {type_}{pk_mark}{null_mark}")
    
    if fks:
        print("   Foreign Keys:")
        for fk in fks:
            print(f"     → {fk[2]}.{fk[4]} (via {fk[3]})")

print("\n" + "=" * 60)
print(f"TOTAL: {total_records} registros em {len(tables)} tabelas")
print("=" * 60)

# Salvar estrutura em JSON para referência
output = {
    'database_path': db_path,
    'total_tables': len(tables),
    'total_records': total_records,
    'tables': {}
}

for table, info in table_info.items():
    output['tables'][table] = {
        'record_count': info['count'],
        'columns': [
            {
                'name': col[1],
                'type': col[2],
                'not_null': bool(col[3]),
                'default': col[4],
                'primary_key': bool(col[5])
            }
            for col in info['columns']
        ],
        'foreign_keys': [
            {
                'table': fk[2],
                'from_column': fk[3],
                'to_column': fk[4]
            }
            for fk in info['foreign_keys']
        ]
    }

with open('prisma/sqlite-schema-analysis.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\n✅ Análise salva em: prisma/sqlite-schema-analysis.json")

conn.close()
