import { useState, useEffect } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  lastOnline: Date | null;
  lastSync: Date | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  pendingItems: number;
  syncProgress: number; // 0-100
}

/**
 * Hook para monitorar status de conexão online/offline
 * e estado de sincronização com o backend
 */
export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: navigator.onLine,
    lastOnline: navigator.onLine ? new Date() : null,
    lastSync: null,
    syncStatus: 'idle',
    pendingItems: 0,
    syncProgress: 0,
  });

  // Notificação de fila de sincronização
  const [showQueueNotification, setShowQueueNotification] = useState(false);

  // Função para forçar sincronização
  const triggerSync = async () => {
    try {
      console.log('🔄 Forçando sincronização...');
      setStatus(prev => ({
        ...prev,
        syncStatus: 'syncing',
        syncProgress: 0,
      }));
      
      await (window as any).electronAPI?.sync?.forcePush?.();
      await updateSyncStatus();
    } catch (error) {
      console.error('Erro ao forçar sincronização:', error);
      setStatus(prev => ({
        ...prev,
        syncStatus: 'error',
        syncProgress: 0,
      }));
    }
  };

  // Função auxiliar para atualizar status de sincronização
  const updateSyncStatus = async () => {
    try {
      const syncStatus = await (window as any).electronAPI?.sync?.status?.();
      if (syncStatus) {
        setStatus(prev => ({
          ...prev,
          pendingItems: syncStatus.pendingItems || 0,
          lastSync: syncStatus.lastSync ? new Date(syncStatus.lastSync) : prev.lastSync,
        }));
      }
    } catch (error) {
      console.error('Erro ao verificar status de sincronização:', error);
    }
  };

  useEffect(() => {
    // Atualizar status inicial
    updateSyncStatus();

    // Listeners para eventos de rede do navegador
    const handleOnline = async () => {
      console.log('🟢 Conexão de rede restaurada - Aguardando 2s antes de verificar backend...');
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        lastOnline: new Date(),
      }));
      
      // Aguardar 2 segundos para garantir que a conexão estabilizou
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar se backend está realmente acessível antes de tentar reautenticar
      try {
        console.log('🔍 Verificando se backend está acessível...');
        const isBackendOnline = await (window as any).electronAPI?.sync?.checkConnection?.();
        
        if (!isBackendOnline) {
          console.log('⚠️ Backend ainda não está acessível');
          console.log('💡 A sincronização automática tentará reconectar a cada 30 segundos');
          return;
        }
        
        console.log('✅ Backend acessível! Iniciando processo de reautenticação...');
        const reauthSuccess = await (window as any).electronAPI?.sync?.tryReauthenticate?.();
        
        if (reauthSuccess) {
          console.log('✅ Reautenticação bem-sucedida, sincronização iniciará automaticamente');
          // SyncManager já inicia syncNow() após reautenticação
          // Atualizar status após reautenticação
          await updateSyncStatus();
        } else {
          console.log('⚠️ Reautenticação falhou após todas as tentativas');
          console.log('💡 Você pode tentar sincronizar manualmente clicando no botão');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar backend/reautenticar:', error);
        console.log('💡 A sincronização automática continuará tentando a cada 30 segundos');
      }
    };

    const handleOffline = () => {
      console.log('🔴 ========================================');
      console.log('🔴 CONEXÃO PERDIDA - MODO OFFLINE ATIVADO');
      console.log('🔴 ========================================');
      console.log('📴 Aplicativo continuará funcionando localmente');
      console.log('💾 Todas as alterações serão salvas localmente');
      console.log('🔄 Sincronização automática tentará reconectar a cada 30 segundos');
      console.log('📊 Items pendentes de sincronização serão enviados quando reconectar');
      
      setStatus(prev => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar status de sincronização periodicamente
    const syncCheckInterval = setInterval(() => {
      updateSyncStatus();
    }, 5000); // A cada 5 segundos

    // Listeners para eventos de sincronização do Electron
    const unsubscribeStart = (window as any).electronAPI?.sync?.onSyncStart?.(() => {
      console.log('🔄 Sincronização iniciada');
      setStatus(prev => ({
        ...prev,
        syncStatus: 'syncing',
        syncProgress: 0,
      }));
    });

    const unsubscribeProgress = (window as any).electronAPI?.sync?.onSyncProgress?.((data: any) => {
      console.log('⏳ Progresso recebido:', data.progress + '%');
      setStatus(prev => ({
        ...prev,
        syncProgress: Math.min(data.progress || 0, 95), // Máximo 95% até completar
      }));
    });

    const unsubscribeComplete = (window as any).electronAPI?.sync?.onSyncComplete?.((data: any) => {
      console.log('✅ Sincronização concluída', data);
      setStatus(prev => ({
        ...prev,
        lastSync: new Date(),
        syncStatus: 'success',
        pendingItems: data?.pendingItems || 0,
        syncProgress: 100,
      }));

      // Resetar status após 3 segundos
      setTimeout(() => {
        setStatus(prev => ({
          ...prev,
          syncStatus: 'idle',
          syncProgress: 0,
        }));
      }, 3000);
    });

    const unsubscribeError = (window as any).electronAPI?.sync?.onSyncError?.((error: string) => {
      console.error('❌ Erro na sincronização:', error);
      setStatus(prev => ({
        ...prev,
        syncStatus: 'error',
        syncProgress: 0,
      }));

      // Resetar status após 5 segundos
      setTimeout(() => {
        setStatus(prev => ({
          ...prev,
          syncStatus: 'idle',
        }));
      }, 5000);
    });

    // Listener para reautenticação
    const unsubscribeReauth = (window as any).electronAPI?.sync?.onReauthenticated?.((data: any) => {
      if (data.success) {
        console.log('✅ Reautenticado com sucesso, token atualizado');
        // Atualizar status após reautenticação bem-sucedida
        updateSyncStatus();
      } else {
        console.error('❌ Falha na reautenticação:', data.error);
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncCheckInterval);
      unsubscribeStart?.();
      unsubscribeProgress?.();
      unsubscribeComplete?.();
      unsubscribeError?.();
      unsubscribeReauth?.();
    };
  }, []); // Remover dependência de status.pendingItems para evitar re-criação de listeners

  // Separar lógica de notificação de fila em useEffect independente
  useEffect(() => {
    if (status.pendingItems > 0) {
      const queueNotificationTimer = setTimeout(() => {
        setShowQueueNotification(true);
        setTimeout(() => setShowQueueNotification(false), 5000);
      }, 30000); // Mostrar após 30 segundos
      
      return () => clearTimeout(queueNotificationTimer);
    }
  }, [status.pendingItems]);

  return {
    ...status,
    triggerSync,
    showQueueNotification,
  };
}

export default useOnlineStatus;
