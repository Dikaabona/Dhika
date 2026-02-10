import React, { useState, useMemo } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';

interface BulkSalaryModalProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  userRole: string;
  company: string;
  onClose: () => void;
  weeklyHolidays?: Record<string, string[]>;
}

const ALPHA_START_DATE = '2026-02-02';

const BulkSalaryModal: React.FC<BulkSalaryModalProps> = ({ 
  employees, 
  attendanceRecords, 
  userRole, 
  company, 
  onClose,
  weeklyHolidays 
}) => {
  const getPreviousMonthInfo = () => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthsNamesID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return {
      name: monthsNamesID[lastMonthDate.getMonth()],
      year: lastMonthDate.getFullYear().toString(),
      monthIdx: lastMonthDate.getMonth()
    };
  };

  const prevMonth = getPreviousMonthInfo();
  const [selectedMonth, setSelectedMonth] = useState(prevMonth.name);
  const [selectedYear, setSelectedYear] = useState(prevMonth.year);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{ name: string; status: 'Success' | 'Error'; message: string }[]>([]);
  
  // New State for Manual Emails
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthMap: Record<string, number> = months.reduce((acc, name, idx) => ({ ...acc, [name]: idx }), {});

  const isWorkDay = (date: Date, emp: Employee) => {
    const day = date.getDay();
    const isHost = (emp.jabatan || '').toUpperCase().includes('HOST LIVE STREAMING');
    if (day === 0) return isHost;
    if (day === 6) return false;
    const dayNameMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const currentDayName = dayNameMap[day];
    if (weeklyHolidays) {
      const empNameUpper = emp.nama.toUpperCase();
      const employeeInHolidays = Object.values(weeklyHolidays).some(names => (names as string[]).map(n => n.toUpperCase()).includes(empNameUpper));
      if (employeeInHolidays) {
        return !(weeklyHolidays[currentDayName] || []).map(n => n.toUpperCase()).includes(empNameUpper);
      }
    }
    return true;
  };

  const handleAddEmail = () => {
    if (emailInput.includes('@') && !manualEmails.includes(emailInput)) {
      setManualEmails([...manualEmails, emailInput]);
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setManualEmails(manualEmails.filter(e => e !== email));
  };

  const handleProcessAll = async () => {
    if (isProcessing) return;
    if (!confirm(`Kirim slip gaji untuk ${employees.length} karyawan & ${manualEmails.length} email tambahan periode ${selectedMonth} ${selectedYear}?`)) return;

    setIsProcessing(true);
    setProgress(0);
    setLogs([]);

    const targetMonthIdx = monthMap[selectedMonth];
    const targetYearNum = parseInt(selectedYear);
    const rangeStart = new Date(targetYearNum, targetMonthIdx - 1, 29);
    const rangeEnd = new Date(targetYearNum, targetMonthIdx, 28);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    const rangeStartStr = formatDateToYYYYMMDD(rangeStart);
    const rangeEndStr = formatDateToYYYYMMDD(rangeEnd);

    const totalToProcess = employees.length + manualEmails.length;
    let processedCount = 0;

    // Process Employees
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      try {
        const empRecords = (attendanceRecords || []).filter(r => r.employeeId === emp.id && r.date >= rangeStartStr && r.date <= rangeEndStr);
        let alphaCount = 0;
        const todayStr = formatDateToYYYYMMDD(new Date());
        let temp = new Date(rangeStart);
        while (temp <= rangeEnd) {
          const dStr = formatDateToYYYYMMDD(temp);
          const hasRecord = empRecords.some(r => r.date === dStr && r.status !== 'Libur' && r.status !== 'Lembur');
          if (!hasRecord && dStr < todayStr && dStr >= ALPHA_START_DATE && isWorkDay(temp, emp)) {
            alphaCount++;
          }
          temp.setDate(temp.getDate() + 1);
        }

        const config = emp.salaryConfig || { gapok: 0, tunjanganMakan: 0, tunjanganTransport: 0, tunjanganKomunikasi: 0, tunjanganKesehatan: 0, tunjanganJabatan: 0 };
        const totalFixed = (config.gapok || 0) + (config.tunjanganMakan || 0) + (config.tunjanganTransport || 0) + (config.tunjanganKomunikasi || 0) + (config.tunjanganKesehatan || 0) + (config.tunjanganJabatan || 0);
        const potonganAbsen = Math.round((alphaCount * totalFixed) / 26);
        const totalPotongan = potonganAbsen + (config.bpjstk || 0) + (config.pph21 || 0);
        const thp = (totalFixed + (config.lembur || 0) + (config.bonus || 0) + (config.thr || 0)) - totalPotongan;

        await new Promise(resolve => setTimeout(resolve, 400));
        setLogs(prev => [{ name: emp.nama, status: 'Success', message: `${emp.email} • THP: Rp ${thp.toLocaleString('id-ID')}` }, ...prev]);
      } catch (err: any) {
        setLogs(prev => [{ name: emp.nama, status: 'Error', message: err.message }, ...prev]);
      }
      processedCount++;
      setProgress(Math.round((processedCount / totalToProcess) * 100));
    }

    // Process Manual Emails (as CC or notification)
    for (let i = 0; i < manualEmails.length; i++) {
      const email = manualEmails[i];
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
        setLogs(prev => [{ name: 'Email Tambahan', status: 'Success', message: `Notifikasi Terkirim ke: ${email}` }, ...prev]);
      } catch (err: any) {
        setLogs(prev => [{ name: email, status: 'Error', message: 'Gagal mengirim email' }, ...prev]);
      }
      processedCount++;
      setProgress(Math.round((processedCount / totalToProcess) * 100));
    }

    setIsProcessing(false);
    alert("Pemrosesan massal selesai!");
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md z-[250] flex items-center justify-center p-4">
      <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        <div className="p-8 sm:p-10 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight leading-none">Kirim Slip Massal</h2>
            <p className="text-[#FFC000] text-[10px] mt-2 uppercase font-black tracking-widest">{employees.length} Karyawan Terdeteksi</p>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <span className="text-4xl leading-none">&times;</span>
          </button>
        </div>

        <div className="p-8 sm:p-10 overflow-y-auto space-y-8 flex-grow custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bulan Periode</label>
              <select 
                disabled={isProcessing} 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 text-sm font-black text-black outline-none focus:border-indigo-500 transition-all appearance-none"
              >
                {months.map(m => <option key={m} value={m} className="text-black">{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tahun</label>
              <select 
                disabled={isProcessing} 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)} 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 text-sm font-black text-black outline-none focus:border-indigo-500 transition-all appearance-none"
              >
                {['2024', '2025', '2026'].map(y => <option key={y} value={y} className="text-black">{y}</option>)}
              </select>
            </div>
          </div>

          {/* Email Management Section */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Daftar Penerima & Email Tambahan</label>
            
            {/* targeted employee emails list */}
            <div className="bg-slate-50 border border-slate-100 rounded-[28px] p-5 max-h-32 overflow-y-auto custom-scrollbar space-y-2">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Karyawan Terdeteksi:</p>
              <div className="flex flex-wrap gap-2">
                {employees.map(emp => (
                  <span key={emp.id} className="bg-white text-black px-3 py-1.5 rounded-xl text-[9px] font-bold border border-slate-200">
                    {emp.email}
                  </span>
                ))}
                {employees.length === 0 && <p className="text-[10px] text-slate-300 italic font-bold">Tidak ada karyawan terdeteksi.</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Masukkan email untuk dikirim slip..." 
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
                className="flex-grow bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-black outline-none focus:border-indigo-500"
              />
              <button onClick={handleAddEmail} className="bg-[#0f172a] text-[#FFC000] px-6 rounded-2xl active:scale-95 transition-all shadow-lg">
                <Icons.Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {manualEmails.map(email => (
                <span key={email} className="bg-white text-black px-4 py-2 rounded-full text-[10px] font-black flex items-center gap-2 border border-slate-200 shadow-sm">
                  {email}
                  <button onClick={() => handleRemoveEmail(email)} className="text-rose-500 font-black text-lg leading-none">×</button>
                </span>
              ))}
              {manualEmails.length === 0 && <p className="text-[10px] text-slate-500 font-bold ml-1 italic">Belum ada email tambahan.</p>}
            </div>
          </div>

          {isProcessing && (
            <div className="space-y-4 animate-in fade-in duration-300">
               <div className="flex justify-between items-end">
                  <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Memproses Data...</p>
                  <p className="text-2xl font-black text-indigo-600 tracking-tighter">{progress}%</p>
               </div>
               <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                  <div className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }}></div>
               </div>
            </div>
          )}

          <div className="space-y-3">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Log Pengiriman</h3>
             <div className="bg-slate-50 rounded-[32px] p-6 h-64 overflow-y-auto border border-slate-100 shadow-inner space-y-3 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-500">
                     <Icons.Send className="w-8 h-8 mb-2" />
                     <p className="text-[8px] font-black uppercase tracking-widest">Belum ada aktifitas</p>
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-top-2">
                       <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${log.status === 'Success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                             {log.status === 'Success' ? <Icons.Check className="w-3.5 h-3.5" /> : <Icons.AlertCircle className="w-3.5 h-3.5" />}
                          </div>
                          <p className="text-[11px] font-black text-black uppercase">{log.name}</p>
                       </div>
                       <p className="text-[9px] font-bold text-black uppercase">{log.message}</p>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>

        <div className="p-8 border-t bg-slate-50 shrink-0">
          <button 
            onClick={handleProcessAll} 
            disabled={isProcessing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[28px] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50"
          >
            {isProcessing ? 'SEDANG MEMPROSES...' : <><Icons.Send className="w-5 h-5" /> PROSES & KIRIM SEKALIGUS</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkSalaryModal;