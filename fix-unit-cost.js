// Este script deve ser executado no contexto do Electron
// Para executar: Abrir DevTools no aplicativo e colar este código no console

(async () => {
  try {
    console.log('🔧 Iniciando correção de unit_cost...');
    
    // Chamar o IPC do Electron para executar a migração
    // @ts-ignore
    const result = await window.electronAPI?.database?.executeMigration?.({
      query: `
        UPDATE sale_items 
        SET unit_cost = (
          SELECT cost_unit 
          FROM products 
          WHERE id = sale_items.product_id
        ) 
        WHERE unit_cost IS NULL OR unit_cost = 0
      `
    });
    
    console.log('✅ Migração concluída:', result);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  }
})();

// INSTRUÇÕES:
// 1. Abrir o aplicativo BarManager Desktop
// 2. Pressionar F12 para abrir DevTools
// 3. Ir na aba Console
// 4. Colar este código e pressionar Enter
