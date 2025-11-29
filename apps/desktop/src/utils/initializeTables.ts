/**
 * Script para inicializar mesas de exemplo
 * Execute este script uma vez para criar as mesas no sistema
 */

const { electronAPI } = window as any;

interface TableData {
  number: string;
  seats: number;
  area: string;
}

const sampleTables: TableData[] = [
  // Salão Principal
  { number: '1', seats: 4, area: 'Salão Principal' },
  { number: '2', seats: 4, area: 'Salão Principal' },
  { number: '3', seats: 6, area: 'Salão Principal' },
  { number: '4', seats: 4, area: 'Salão Principal' },
  { number: '5', seats: 2, area: 'Salão Principal' },
  { number: '6', seats: 4, area: 'Salão Principal' },
  { number: '7', seats: 6, area: 'Salão Principal' },
  { number: '8', seats: 4, area: 'Salão Principal' },
  
  // Terraço
  { number: '9', seats: 4, area: 'Terraço' },
  { number: '10', seats: 4, area: 'Terraço' },
  { number: '11', seats: 6, area: 'Terraço' },
  { number: '12', seats: 8, area: 'Terraço' },
  
  // VIP
  { number: '13', seats: 6, area: 'VIP' },
  { number: '14', seats: 8, area: 'VIP' },
  { number: '15', seats: 4, area: 'VIP' },
  
  // Balcão
  { number: 'B1', seats: 1, area: 'Balcão' },
  { number: 'B2', seats: 1, area: 'Balcão' },
  { number: 'B3', seats: 1, area: 'Balcão' },
  { number: 'B4', seats: 1, area: 'Balcão' },
  { number: 'B5', seats: 1, area: 'Balcão' },
];

export async function initializeTables() {
  console.log('🍽️  Inicializando mesas...');
  
  const branchId = localStorage.getItem('branchId') || 'main-branch';
  let created = 0;
  let errors = 0;
  
  for (const table of sampleTables) {
    try {
      await electronAPI.tables.create({
        branchId,
        number: table.number,
        seats: table.seats,
        area: table.area,
      });
      
      created++;
      console.log(`✅ Mesa ${table.number} criada (${table.area}, ${table.seats} lugares)`);
    } catch (error: any) {
      // Mesa pode já existir
      if (error.message.includes('UNIQUE constraint')) {
        console.log(`⚠️  Mesa ${table.number} já existe`);
      } else {
        errors++;
        console.error(`❌ Erro ao criar mesa ${table.number}:`, error.message);
      }
    }
  }
  
  console.log(`\n✅ Inicialização concluída!`);
  console.log(`   - ${created} mesas criadas`);
  console.log(`   - ${errors} erros`);
  console.log(`   - Total: ${sampleTables.length} mesas\n`);
  
  return { created, errors, total: sampleTables.length };
}

// Exportar também para uso em console
if (typeof window !== 'undefined') {
  (window as any).initializeTables = initializeTables;
}
