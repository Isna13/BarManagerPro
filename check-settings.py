import sqlite3

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT key, value FROM settings")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1][:80] if row[1] and len(row[1]) > 80 else row[1]}...")

conn.close()
