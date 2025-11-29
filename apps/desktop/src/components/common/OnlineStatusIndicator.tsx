import { Wifi, WifiOff, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useState, useEffect } from 'react';

export default function OnlineStatusIndicator() {
  const { isOnline, syncStatus, pendingItems, lastSync, triggerSync, syncProgress, showQueueNotification } = useOnlineStatus();
  const [showConnectionAlert, setShowConnectionAlert] = useState(false);
  const [connectionAlertType, setConnectionAlertType] = useState<'lost' | 'restored'>('lost');
  
  // Detectar mudanças no status de conexão
  useEffect(() => {
    if (!isOnline) {
      setConnectionAlertType('lost');
      setShowConnectionAlert(true);
      // Esconder após 5 segundos
      setTimeout(() => setShowConnectionAlert(false), 5000);
    } else {
      setConnectionAlertType('restored');
      setShowConnectionAlert(true);
      // Esconder após 3 segundos
      setTimeout(() => setShowConnectionAlert(false), 3000);
    }
  }, [isOnline]);

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (syncStatus === 'syncing') return 'bg-yellow-500 animate-pulse';
    if (syncStatus === 'error') return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus === 'syncing') return 'Sincronizando...';
    if (syncStatus === 'error') return 'Erro na Sincronização';
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (syncStatus === 'syncing') return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (syncStatus === 'error') return <AlertCircle className="w-4 h-4" />;
    return <Wifi className="w-4 h-4" />;
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Agora mesmo';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return lastSync.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Widget principal */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg backdrop-blur-sm">
        {/* Indicador visual (círculo + ícone) */}
        <div className="relative flex items-center gap-2">
          {/* Círculo de status pulsante */}
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}>
              {isOnline && syncStatus === 'idle' && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75"></div>
              )}
            </div>
          </div>

          {/* Ícone */}
          <div className={`${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {getStatusIcon()}
          </div>
        </div>

        {/* Texto descritivo */}
        <div className="flex flex-col flex-1">
          <span className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {getStatusText()}
          </span>
          
          {/* Informações adicionais */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {isOnline && (
              <>
                <span>Última sync: {formatLastSync()}</span>
                {pendingItems > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400">{pendingItems} pendente(s)</span>
                  </>
                )}
              </>
            )}
            {!isOnline && (
              <span>Dados serão sincronizados ao reconectar</span>
            )}
          </div>
        </div>

        {/* Botão de sincronização manual com animação */}
        {isOnline && (
          <button
            onClick={triggerSync}
            disabled={syncStatus === 'syncing'}
            className={`ml-2 p-1.5 hover:bg-white/10 rounded transition-all ${
              syncStatus === 'syncing' ? 'cursor-not-allowed opacity-50' : ''
            }`}
            title={syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar agora'}
          >
            <RefreshCw 
              className={`w-4 h-4 text-gray-400 hover:text-white transition-transform ${
                syncStatus === 'syncing' ? 'animate-spin' : ''
              }`} 
            />
          </button>
        )}
      </div>

      {/* Barra de progresso (aparece na parte inferior durante sincronização) */}
      {syncStatus === 'syncing' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 rounded-b-lg overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 ease-out"
            style={{ 
              width: `${syncProgress}%`,
              animation: syncProgress === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none'
            }}
          />
        </div>
      )}

      {/* Alerta de mudança de conexão */}
      {showConnectionAlert && (
        <div className={`absolute -bottom-16 left-0 right-0 rounded-lg px-3 py-2 shadow-lg animate-slide-up ${
          connectionAlertType === 'lost' 
            ? 'bg-red-900/90 border border-red-700' 
            : 'bg-green-900/90 border border-green-700'
        }`}>
          <div className="flex items-center gap-2 text-xs">
            {connectionAlertType === 'lost' ? (
              <>
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-red-200 font-medium">
                  Conexão perdida - Modo offline ativado
                </span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-green-200 font-medium">
                  Conexão restaurada - Sincronizando...
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Notificação de fila de sincronização */}
      {showQueueNotification && !showConnectionAlert && (
        <div className="absolute -bottom-14 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-yellow-400" />
            <span className="text-gray-300">
              {pendingItems > 0 
                ? `${pendingItems} ${pendingItems === 1 ? 'item aguardando' : 'itens aguardando'} sincronização`
                : 'Fila de sincronização vazia'}
            </span>
          </div>
        </div>
      )}

      {/* Estilos customizados para animação */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
