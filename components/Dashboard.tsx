
import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { Icons } from '../constants';
import { analyzeEmployees } from '../services/geminiService';

interface DashboardProps {
  employees: Employee[];
}

const Dashboard: React.FC<DashboardProps> = ({ employees }) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const getInsight = async () => {
    if (employees.length === 0) return;
    setIsAnalyzing(true);
    const result = await analyzeEmployees(employees);
    setAiInsight(result);
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (employees.length > 0 && !aiInsight) {
      getInsight();
    }
  }, [employees]);

  const stats = [
    { label: 'Total Karyawan', value: employees.length, color: 'blue' },
    { label: 'Karyawan Baru (30 Hari)', value: employees.filter(e => {
        const joinDate = new Date(e.tanggalMasuk);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return joinDate > thirtyDaysAgo;
      }).length, color: 'green' 
    },
    { label: 'Bank Beragam', value: new Set(employees.map(e => e.bank)).size, color: 'purple' }
  ];

  return (
    <div className="mb-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
              <Icons.Users />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-100 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Icons.Sparkles />
            <h3 className="font-bold text-lg">Analisis AI HR-Smart</h3>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 min-h-[80px] flex items-center">
            {isAnalyzing ? (
              <div className="flex items-center gap-3 italic text-blue-100">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Menganalisis data karyawan Anda...
              </div>
            ) : aiInsight ? (
              <p className="text-blue-50 text-sm leading-relaxed">{aiInsight}</p>
            ) : (
              <p className="text-blue-100 text-sm italic">Tambahkan data karyawan untuk melihat analisis otomatis.</p>
            )}
          </div>
          <button 
            onClick={getInsight} 
            disabled={isAnalyzing || employees.length === 0}
            className="mt-4 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all"
          >
            Perbarui Analisis
          </button>
        </div>
        <div className="absolute -right-12 -top-12 opacity-10">
          <Icons.Users />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
