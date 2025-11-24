import { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reportTypes = [
    { id: 'sales', name: 'Relatório de Vendas', icon: FileText, color: 'bg-blue-500' },
    { id: 'inventory', name: 'Relatório de Estoque', icon: FileText, color: 'bg-green-500' },
    { id: 'customers', name: 'Relatório de Clientes', icon: FileText, color: 'bg-purple-500' },
    { id: 'debts', name: 'Relatório de Dívidas', icon: FileText, color: 'bg-red-500' },
  ];

  const generateReport = async (reportType: string) => {
    alert(`Gerando relatório: ${reportType}\nPeríodo: ${startDate || 'todos'} até ${endDate || 'hoje'}`);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Relatórios</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar size={24} />
          Período
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportTypes.map((report) => (
          <div key={report.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className={`${report.color} p-4 rounded-lg mb-4 flex justify-center`}>
              <report.icon size={48} className="text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-4 text-center">{report.name}</h3>
            <button
              onClick={() => generateReport(report.id)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Gerar Relatório
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
