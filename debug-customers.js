const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

const raw = execSync(`sqlite3.exe "${DB_PATH}" "SELECT id FROM customers"`, { encoding: 'utf8' });
console.log('RAW:', JSON.stringify(raw));
const ids = raw.trim().split('\n').filter(Boolean);
console.log('IDs:', ids);
console.log('Has 539bfaed:', ids.includes('539bfaed-3dea-46fa-8253-6f97ef530c6b'));
console.log('Contains 539bfaed:', ids.some(id => id.includes('539bfaed')));
