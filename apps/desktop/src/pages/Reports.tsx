import { useState } from 'react';
import { FileText, Download, Calendar, FolderOpen, TrendingUp, Package, Users, AlertCircle, ShoppingCart, FileJson, FileType } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuthStore } from '../stores/authStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare global {
  interface Window {
    electronAPI: {
      dialog: {
        selectDirectory: () => Promise<{ success: boolean; path: string | null }>;
      };
      reports: {
        sales: (startDate: string, endDate: string, branchId?: string) => Promise<any>;
        purchases: (startDate: string, endDate: string, branchId?: string) => Promise<any>;
        inventory: (branchId?: string) => Promise<any>;
        customers: (branchId?: string) => Promise<any>;
        debts: (branchId?: string) => Promise<any>;
        saveFile: (filePath: string, content: any, type: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      };
    };
  }
}

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  requiresDate: boolean;
}

export default function ReportsPage() {
  const toast = useToast();
  const { token, isAuthenticated } = useAuthStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(
    localStorage.getItem('reports-directory')
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [showFormatModal, setShowFormatModal] = useState(false);

  const reportTypes: ReportType[] = [
    { 
      id: 'sales', 
      name: 'Relatório de Vendas', 
      description: 'Vendas por período, métodos de pagamento e produtos mais vendidos',
      icon: TrendingUp, 
      color: 'bg-blue-500',
      requiresDate: true,
    },
    { 
      id: 'purchases', 
      name: 'Relatório de Compras', 
      description: 'Compras por período, fornecedores e produtos mais comprados',
      icon: ShoppingCart, 
      color: 'bg-orange-500',
      requiresDate: true,
    },
    { 
      id: 'inventory', 
      name: 'Relatório de Estoque', 
      description: 'Status do estoque, valor total e itens com estoque baixo',
      icon: Package, 
      color: 'bg-green-500',
      requiresDate: false,
    },
    { 
      id: 'customers', 
      name: 'Relatório de Clientes', 
      description: 'Total de clientes, clientes com dívidas e maiores devedores',
      icon: Users, 
      color: 'bg-purple-500',
      requiresDate: false,
    },
    { 
      id: 'debts', 
      name: 'Relatório de Dívidas', 
      description: 'Dívidas pendentes, pagas e vencidas',
      icon: AlertCircle, 
      color: 'bg-red-500',
      requiresDate: false,
    },
  ];

  const selectDirectory = async () => {
    try {
      const result = await window.electronAPI.dialog.selectDirectory();
      
      if (result.success && result.path) {
        setSelectedDirectory(result.path);
        localStorage.setItem('reports-directory', result.path);
        toast.success('Diretório selecionado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao selecionar diretório:', error);
      toast.error('Erro ao selecionar diretório');
    }
  };

  const openFormatModal = (report: ReportType) => {
    if (report.requiresDate && (!startDate || !endDate)) {
      toast.error('Selecione o período para gerar o relatório');
      return;
    }
    
    setSelectedReport(report);
    setShowFormatModal(true);
  };

  const generatePDF = (data: any, reportType: string, reportName: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Título
    doc.setFontSize(18);
    doc.text(reportName, pageWidth / 2, 20, { align: 'center' });
    
    // Data de geração
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' });
    
    let yPosition = 40;

    switch (reportType) {
      case 'sales':
        doc.setFontSize(12);
        doc.text('Resumo de Vendas', 14, yPosition);
        yPosition += 10;
        
        if (data.summary) {
          autoTable(doc, {
            startY: yPosition,
            head: [['Métrica', 'Valor']],
            body: [
              ['Total de Vendas', `${(data.summary.totalSales / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
              ['Quantidade de Vendas', data.summary.salesCount],
              ['Ticket Médio', `${(data.summary.averageTicket / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
              ['Economias Muntu', `${(data.summary.totalMuntuSavings / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
            ],
          });
        }
        break;

      case 'purchases':
        doc.setFontSize(12);
        doc.text('Resumo de Compras', 14, yPosition);
        yPosition += 10;
        
        if (data.summary) {
          autoTable(doc, {
            startY: yPosition,
            head: [['Métrica', 'Valor']],
            body: [
              ['Total de Compras', `${(data.summary.totalPurchases / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
              ['Quantidade de Compras', data.summary.purchasesCount],
              ['Ticket Médio', `${(data.summary.averageTicket / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
            ],
          });
          
          yPosition = (doc as any).lastAutoTable.finalY + 15;
        }

        if (data.suppliers && data.suppliers.length > 0) {
          doc.setFontSize(12);
          doc.text('Top Fornecedores', 14, yPosition);
          yPosition += 5;
          
          autoTable(doc, {
            startY: yPosition,
            head: [['Fornecedor', 'Compras', 'Total']],
            body: data.suppliers.slice(0, 10).map((s: any) => [
              s.name,
              s.count,
              `${(s.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`,
            ]),
          });
        }
        break;

      case 'inventory':
        doc.setFontSize(12);
        doc.text('Resumo de Estoque', 14, yPosition);
        yPosition += 10;
        
        if (data.summary) {
          autoTable(doc, {
            startY: yPosition,
            head: [['Métrica', 'Valor']],
            body: [
              ['Total de Itens', data.summary.totalItems],
              ['Valor Total', `${(data.summary.totalValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
              ['Itens com Estoque Baixo', data.summary.lowStockItems],
            ],
          });
        }
        break;

      case 'customers':
        doc.setFontSize(12);
        doc.text('Resumo de Clientes', 14, yPosition);
        yPosition += 10;
        
        if (data.summary) {
          autoTable(doc, {
            startY: yPosition,
            head: [['Métrica', 'Valor']],
            body: [
              ['Total de Clientes', data.summary.totalCustomers],
              ['Clientes com Dívida', data.summary.customersWithDebt],
              ['Total em Dívidas', `${(data.summary.totalDebt / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
            ],
          });
        }
        break;

      case 'debts':
        doc.setFontSize(12);
        doc.text('Resumo de Dívidas', 14, yPosition);
        yPosition += 10;
        
        if (data.summary) {
          autoTable(doc, {
            startY: yPosition,
            head: [['Status', 'Quantidade', 'Total']],
            body: [
              ['Pendentes', data.summary.pending.count, `${(data.summary.pending.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
              ['Parciais', data.summary.partial.count, `${(data.summary.partial.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
              ['Pagas', data.summary.paid.count, '-'],
              ['Vencidas', data.summary.overdue.count, `${(data.summary.overdue.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'XOF' })}`],
            ],
          });
        }
        break;
    }

    return doc;
  };

  const generateReport = async (format: 'json' | 'pdf') => {
    if (!selectedReport) return;

    // Se não houver diretório selecionado, abrir seletor automaticamente
    let targetDirectory = selectedDirectory;
    if (!targetDirectory) {
      try {
        const result = await window.electronAPI.dialog.selectDirectory();
        
        if (!result.success || !result.path) {
          toast.error('É necessário selecionar um diretório para salvar os relatórios');
          return;
        }
        
        targetDirectory = result.path;
        setSelectedDirectory(targetDirectory);
        localStorage.setItem('reports-directory', targetDirectory);
      } catch (error) {
        console.error('Erro ao selecionar diretório:', error);
        toast.error('Erro ao selecionar diretório');
        return;
      }
    }

    setShowFormatModal(false);
    setIsGenerating(true);

    try {
      if (!isAuthenticated || !token) {
        toast.error('Usuário não autenticado');
        setIsGenerating(false);
        return;
      }

      toast.info('Gerando relatório...', 2000);

      let data: any;

      // Usar API do Electron em vez de axios direto
      switch (selectedReport.id) {
        case 'sales':
          data = await window.electronAPI.reports.sales(startDate, endDate);
          break;
        case 'purchases':
          data = await window.electronAPI.reports.purchases(startDate, endDate);
          break;
        case 'inventory':
          data = await window.electronAPI.reports.inventory();
          break;
        case 'customers':
          data = await window.electronAPI.reports.customers();
          break;
        case 'debts':
          data = await window.electronAPI.reports.debts();
          break;
        default:
          toast.error('Tipo de relatório não reconhecido');
          setIsGenerating(false);
          return;
      }
      
      // Criar nome do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      
      if (format === 'pdf') {
        const pdf = generatePDF(data, selectedReport.id, selectedReport.name);
        const fileName = `${selectedReport.id}-${timestamp}.pdf`;
        
        // Converter PDF para base64 usando método nativo do navegador
        const pdfArrayBuffer = pdf.output('arraybuffer');
        const uint8Array = new Uint8Array(pdfArrayBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64String = btoa(binaryString);
        
        const filePath = `${targetDirectory}\\${fileName}`;
        
        const saveResult = await window.electronAPI.reports.saveFile(filePath, base64String, 'pdf');
        
        if (saveResult.success) {
          toast.success(`Relatório PDF salvo em: ${fileName}`);
        } else {
          toast.error(`Erro ao salvar PDF: ${saveResult.error}`);
        }
      } else {
        const fileName = `${selectedReport.id}-${timestamp}.json`;
        const filePath = `${targetDirectory}\\${fileName}`;
        
        const saveResult = await window.electronAPI.reports.saveFile(filePath, data, 'json');
        
        if (saveResult.success) {
          toast.success(`Relatório JSON salvo em: ${fileName}`);
        } else {
          toast.error(`Erro ao salvar JSON: ${saveResult.error}`);
        }
      }

    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      if (error.response?.status === 401) {
        toast.error('Sessão expirada. Faça login novamente.');
      } else {
        toast.error('Erro ao gerar relatório');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Relatórios</h1>
        
        <button
          onClick={selectDirectory}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <FolderOpen size={20} />
          {selectedDirectory ? 'Mudar Diretório' : 'Selecionar Diretório'}
        </button>
      </div>

      {selectedDirectory && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Salvando em:</strong> {selectedDirectory}
          </p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar size={24} />
          Período (para relatórios que requerem datas)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div 
            key={report.id} 
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
          >
            <div className={`${report.color} p-4 rounded-lg mb-4 flex justify-center`}>
              <report.icon size={48} className="text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-center">{report.name}</h3>
            <p className="text-sm text-gray-600 mb-4 text-center min-h-[40px]">
              {report.description}
            </p>
            {report.requiresDate && (
              <p className="text-xs text-orange-600 mb-3 text-center">
                ⚠️ Requer período
              </p>
            )}
            <button
              onClick={() => openFormatModal(report)}
              disabled={isGenerating}
              className={`w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isGenerating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Download size={18} />
              {isGenerating ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">ℹ️ Informações</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Os relatórios podem ser exportados em JSON ou PDF</li>
          <li>• Relatórios com ⚠️ requerem período (Data Início e Data Fim)</li>
          <li>• Selecione o diretório antes de gerar relatórios</li>
          <li>• Os arquivos incluem data e hora de geração no nome</li>
        </ul>
      </div>

      {/* Modal de Seleção de Formato */}
      {showFormatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Selecione o formato do relatório</h3>
            <p className="text-gray-600 mb-6">
              {selectedReport?.name}
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => generateReport('json')}
                className="flex flex-col items-center justify-center p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <FileJson size={48} className="text-blue-600 mb-2" />
                <span className="font-semibold">JSON</span>
                <span className="text-xs text-gray-500 mt-1">Formato de dados</span>
              </button>
              
              <button
                onClick={() => generateReport('pdf')}
                className="flex flex-col items-center justify-center p-6 border-2 border-gray-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all"
              >
                <FileType size={48} className="text-red-600 mb-2" />
                <span className="font-semibold">PDF</span>
                <span className="text-xs text-gray-500 mt-1">Formato visual</span>
              </button>
            </div>

            <button
              onClick={() => setShowFormatModal(false)}
              className="mt-6 w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
