const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db'));
    const db = new SQL.Database(buffer);
    
    console.log('Categorias (Cerveja):');
    const cats = db.exec("SELECT id, name FROM categories WHERE LOWER(name) = 'cerveja'");
    if (cats.length > 0) {
        console.log(JSON.stringify(cats[0], null, 2));
    }
    
    console.log('\nProdutos (com category_id):');
    const prods = db.exec('SELECT id, name, category_id FROM products');
    if (prods.length > 0) {
        console.log(JSON.stringify(prods[0], null, 2));
    }
}

main();
