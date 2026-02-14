import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../constants';
import { flipService } from '../services/flipService';
import { supabase } from '../App';

interface FinancialModuleProps {
  company: string;
  onClose: () => void;
}

const FinancialModule: React.FC<FinancialModuleProps> = ({ company, onClose }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PAYROLL' | 'INVOICE'>('OVERVIEW');

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    setIsLoading(true);
    try {
      const bal = await flipService.getBalance();
      setBalance(bal);
      
      const { data } = await supabase
        .from('flip_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      setTransactions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Container dashed untuk layout visual sesuai screenshot */}
      <div className="border-2 border-dashed border-rose-100 rounded-[48px] p-2 sm:p-4">
        <div className="bg-white rounded-[40px] sm:rounded-[48px] p-8 sm:p-12 shadow-sm border border-slate-50 relative overflow-hidden">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-16">
            <div className="flex items-center gap-6">
              <div className="bg-[#0f172a] p-5 rounded-3xl text-[#FFC000] shadow-xl">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              </div>
              <div>
                <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">FINANCIAL HUB</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3">Flip for Business Integrated</p>
              </div>
            </div>
            
            {/* Saldo Flip Card - Sesuai Screenshot di pojok kanan */}
            <div className="bg-[#0f172a] p-6 pr-20 rounded-[32px] text-white shadow-2xl relative group overflow-hidden min-w-[280px]">
               <div className="relative z-10">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">SALDO FLIP (READY)</p>
                  <p className="text-3xl font-black text-[#FFC000] tracking-tighter tabular-nums">Rp {balance.toLocaleString('id-ID')}</p>
               </div>
               <button 
                  onClick={loadFinanceData} 
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-90"
                  title="Refresh Saldo"
               >
                  <svg className={`w-5 h-5 text-white ${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
               </button>
               <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12 pointer-events-none">
                  <Icons.Sparkles className="w-24 h-24" />
               </div>
            </div>
          </div>

          {/* Navigation Tabs - Sesuai Screenshot */}
          <div className="flex bg-[#f1f5f9] p-1.5 rounded-2xl border border-slate-100 shadow-inner w-fit mb-12">
            {['OVERVIEW', 'PAYROLL', 'INVOICE'].map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === 'OVERVIEW' && (
            <div className="space-y-12">
               {/* Transaksi Terakhir Section */}
               <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest ml-2">TRANSAKSI TERAKHIR</h3>
                  <div className="bg-[#f8fafc] rounded-[40px] border border-slate-100 overflow-hidden shadow-inner">
                     <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                           <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                              <tr>
                                 <th className="px-10 py-6">PENERIMA</th>
                                 <th className="px-6 py-6">NOMINAL</th>
                                 <th className="px-6 py-6">STATUS</th>
                                 <th className="px-10 py-6 text-right">TANGGAL</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100/50">
                              {transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-white transition-colors group">
                                   <td className="px-10 py-5">
                                      <p className="text-[11px] font-black text-slate-900 uppercase">{tx.recipient_name}</p>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{tx.recipient_bank} • {tx.recipient_account}</p>
                                   </td>
                                   <td className="px-6 py-5">
                                      <p className="text-[12px] font-black text-slate-800">{formatCurrency(tx.amount)}</p>
                                   </td>
                                   <td className="px-6 py-5">
                                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${
                                        tx.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        tx.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                        'bg-rose-50 text-rose-600 border-rose-100'
                                      }`}>
                                         {tx.status}
                                      </span>
                                   </td>
                                   <td className="px-10 py-5 text-right">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                                   </td>
                                </tr>
                              ))}
                              {transactions.length === 0 && (
                                <tr>
                                   <td colSpan={4} className="py-24 text-center">
                                      <div className="flex flex-col items-center gap-4 opacity-10">
                                         <Icons.Database className="w-14 h-14" />
                                         <p className="text-[11px] font-black uppercase tracking-[0.4em]">BELUM ADA TRANSAKSI</p>
                                      </div>
                                   </td>
                                </tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>

               {/* Menu Cepat Section - Sesuai Screenshot */}
               <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest ml-2">MENU CEPAT</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <button className="bg-white p-8 rounded-[36px] border border-slate-100 shadow-sm flex items-center gap-6 hover:border-[#FFC000] hover:shadow-xl transition-all group text-left">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                           <Icons.Plus className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">TOP UP SALDO</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">TAMBAH DANA KE FLIP</p>
                        </div>
                     </button>
                     <button className="bg-white p-8 rounded-[36px] border border-slate-100 shadow-sm flex items-center gap-6 hover:border-emerald-400 hover:shadow-xl transition-all group text-left">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                           <Icons.Download className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">TERIMA PEMBAYARAN</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">BUAT VA / QRIS BARU</p>
                        </div>
                     </button>
                  </div>
               </div>

               {/* Info Section */}
               <div className="bg-[#FFFBEB] p-10 rounded-[48px] border border-amber-100/50 flex flex-col sm:flex-row items-center gap-8">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                     <Icons.Info className="w-7 h-7" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-2">Informasi Operasional & Biaya</p>
                     <p className="text-xs text-amber-900/60 font-medium leading-relaxed uppercase tracking-tighter">
                        Biaya admin Flip for Business lebih murah Rp 2.500 - 3.500 per transaksi dibandingkan RTGS bank konvensional. 
                        Pastikan saldo deposit mencukupi sebelum menjalankan payroll massal ke rekening karyawan.
                     </p>
                  </div>
               </div>
            </div>
          )}
          
          {activeTab === 'PAYROLL' && (
            <div className="py-32 text-center animate-in zoom-in-95 duration-500">
               <div className="max-w-md mx-auto space-y-8">
                  <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500 shadow-inner">
                     <Icons.Users className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Otomasi Gaji (Bulk Disbursement)</h3>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                      Fitur ini memungkinkan Anda mengirim gaji ke seluruh karyawan sekaligus. Data bank diambil otomatis dari Database Karyawan.
                    </p>
                  </div>
                  <button className="bg-slate-900 text-[#FFC000] px-12 py-5 rounded-[22px] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all border border-white/10">
                    MULAI PROSES PAYROLL
                  </button>
               </div>
            </div>
          )}

          {activeTab === 'INVOICE' && (
            <div className="py-32 text-center opacity-10">
               <Icons.FileText className="w-20 h-20 mx-auto" />
               <p className="text-[11px] font-black uppercase tracking-[0.5em] mt-6">MODUL INVOICE SEGERA HADIR</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialModule;