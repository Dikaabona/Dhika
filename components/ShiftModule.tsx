
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, Shift, ShiftAssignment } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';

interface ShiftModuleProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<ShiftAssignment[]>>;
  userRole: string;
  company: string;
  onClose: () => void;
}

const DEFAULT_SHIFTS: Shift[] = [
  { id: '1', name: 'Shift Pagi', startTime: '08:00', endTime: '16:00', color: 'bg-emerald-500' },
  { id: '2', name: 'Shift Siang', startTime: '12:00', endTime: '20:00', color: 'bg-amber-500' },
  { id: '3', name: 'Shift Malam', startTime: '16:00', endTime: '00:00', color: 'bg-indigo-500' },
  { id: '4', name: 'Full Day', startTime: '09:00', endTime: '18:00', color: 'bg-rose-500' },
];

const ShiftModule: React.FC<ShiftModuleProps> = ({ employees, assignments, setAssignments, userRole, company, onClose }) => {
  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const [activeTab, setActiveTab] = useState<'VIEW' | 'MANAGE'>('VIEW');
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem(`shifts_config_${company}`);
    return saved ? JSON.parse(saved) : DEFAULT_SHIFTS;
  });

  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.idKaryawan.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const handleAssignShift = async (employeeId: string, shiftId: string) => {
    if (!isAdmin) return;
    
    const existing = assignments.find(a => a.employeeId === employeeId && a.date === startDate);
    
    try {
      if (shiftId === '') {
        if (existing) {
          await supabase.from('shift_assignments').delete().eq('id', existing.id);
          setAssignments(prev => prev.filter(a => a.id !== existing.id));
        }
        return;
      }

      const newAssignment: Partial<ShiftAssignment> = {
        employeeId,
        date: startDate,
        shiftId,
        company
      };

      const { data, error } = await supabase.from('shift_assignments').upsert(
        existing ? { ...newAssignment, id: existing.id } : newAssignment
      ).select();

      if (error) throw error;
      setAssignments(prev => {
        const updated = [...prev];
        if (existing) {
          const idx = updated.findIndex(a => a.id === existing.id);
          updated[idx] = data[0];
        } else {
          updated.push(data[0]);
        }
        return updated;
      });
    } catch (err: any) {
      alert("Gagal update shift: " + err.message);
    }
  };

  const handleExport = () => {
    const dates = [];
    let cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const dataToExport: any[] = [];
    dates.forEach(date => {
      employees.forEach(emp => {
        const dayAssignment = assignments.find(a => a.employeeId === emp.id && a.date === date);
        const shiftName = shifts.find(s => s.id === dayAssignment?.shiftId)?.name || 'OFF / LIBUR';
        dataToExport.push({
          'TANGGAL': date,
          'ID KARYAWAN': emp.idKaryawan,
          'NAMA': emp.nama,
          'SHIFT': shiftName
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Shift");
    XLSX.writeFile(wb, `Shift_${company}_${startDate}_to_${endDate}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [{ 'TANGGAL': '2026-02-06', 'ID KARYAWAN': 'VID-7251', 'NAMA': 'NAMA CONTOH', 'SHIFT': 'Shift Pagi' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Shift");
    XLSX.writeFile(wb, `Template_Shift_${company}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const newAssignments = jsonData.map((row: any) => {
          const emp = employees.find(e => e.idKaryawan === String(row['ID KARYAWAN']));
          const shift = shifts.find(s => s.name.toLowerCase() === String(row['SHIFT']).toLowerCase());
          if (!emp || !shift) return null;
          return { employeeId: emp.id, date: String(row['TANGGAL']), shiftId: shift.id, company: company };
        }).filter(a => a !== null);

        if (newAssignments.length > 0) {
          const { data: inserted, error } = await supabase.from('shift_assignments').upsert(newAssignments, { onConflict: 'employeeId,date' }).select();
          if (error) throw error;
          location.reload();
        }
      } catch (err: any) { alert("Gagal impor: " + err.message); } finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveConfig = () => {
    localStorage.setItem(`shifts_config_${company}`, JSON.stringify(shifts));
    alert("Tipe Shift berhasil disimpan secara lokal!");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8 animate-in fade-in duration-500 pb-20 px-4 sm:px-0">
      <div className="bg-white rounded-[32px] sm:rounded-[48px] p-6 sm:p-12 shadow-sm border border-slate-50 overflow-hidden">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 sm:gap-8 mb-8 sm:mb-10 relative">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="bg-[#0f172a] p-4 sm:p-6 rounded-[18px] sm:rounded-[24px] text-[#FFC000] shadow-xl">
               <Icons.Calendar className="w-6 h-6 sm:w-10 sm:h-10" />
            </div>
            <div className="space-y-2 sm:space-y-4">
              <h2 className="text-2xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-tight leading-none">Jadwal Shift</h2>
              <div className="flex bg-slate-100/60 p-1 rounded-xl sm:rounded-2xl border border-slate-100 shadow-inner w-fit">
                <button onClick={() => setActiveTab('VIEW')} className={`px-4 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'VIEW' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>LIHAT JADWAL</button>
                {isAdmin && <button onClick={() => setActiveTab('MANAGE')} className={`px-4 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'MANAGE' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>ATUR SHIFT</button>}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 sm:gap-4 w-full md:w-auto md:absolute md:top-0 md:right-0">
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 sm:gap-3 items-end justify-end">
               <div className="bg-slate-50 border border-slate-100 px-4 py-2 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-[24px] flex flex-col gap-0.5 shadow-inner">
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-widest">MULAI</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs sm:text-sm font-black text-slate-900 outline-none cursor-pointer" />
               </div>
               <div className="bg-slate-50 border border-slate-100 px-4 py-2 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-[24px] flex flex-col gap-0.5 shadow-inner">
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-widest">SAMPAI</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs sm:text-sm font-black text-slate-900 outline-none cursor-pointer" />
               </div>
               <button onClick={handleExport} className="col-span-2 md:col-auto bg-[#0f172a] text-white h-12 sm:h-[64px] px-6 sm:px-8 rounded-xl sm:rounded-[20px] text-[10px] sm:text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">EKSPOR</button>
            </div>
            {isAdmin && activeTab === 'VIEW' && (
              <div className="flex gap-2">
                <button onClick={handleDownloadTemplate} className="flex-1 bg-white border border-slate-100 text-slate-400 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm">
                  <Icons.Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> TEMPLATE
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex-1 bg-emerald-50 border border-emerald-100 text-emerald-600 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm">
                  <Icons.Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> IMPORT
                </button>
              </div>
            )}
          </div>
        </div>

        {activeTab === 'VIEW' ? (
          <div className="space-y-6 sm:space-y-10">
            <div className="relative w-full bg-slate-50/50 p-1.5 sm:p-2 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-inner">
              <input 
                type="text" 
                placeholder="CARI NAMA ATAU ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-100 px-6 sm:px-10 py-3 sm:py-5 rounded-lg sm:rounded-[24px] text-[10px] sm:text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/10 transition-all text-black shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              {filteredEmployees.map(emp => {
                const dayAssignment = assignments.find(a => a.employeeId === emp.id && a.date === startDate);
                const currentShift = shifts.find(s => s.id === dayAssignment?.shiftId);
                
                return (
                  <div key={emp.id} className="bg-slate-50/40 border border-slate-100 rounded-[28px] sm:rounded-[44px] p-5 sm:p-10 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[28px] overflow-hidden bg-slate-200 border-2 sm:border-4 border-white shadow-lg shrink-0">
                        {emp.photoBase64 ? <img src={emp.photoBase64} className="w-full h-full object-cover" /> : <Icons.Users className="w-6 h-6 sm:w-10 sm:h-10 m-auto mt-4 sm:mt-5 text-slate-300" />}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-base sm:text-xl font-black text-slate-900 uppercase truncate leading-tight tracking-tight">{emp.nama}</p>
                        <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1.5">{emp.jabatan || 'STAFF'}</p>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-10 space-y-3 sm:space-y-4 relative z-10">
                       <label className="text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 sm:ml-2">STATUS SHIFT ({startDate})</label>
                       {isAdmin ? (
                         <div className="relative">
                            <select 
                              value={dayAssignment?.shiftId || ''} 
                              onChange={(e) => handleAssignShift(emp.id, e.target.value)}
                              className={`w-full p-4 sm:p-6 rounded-xl sm:rounded-[28px] text-[10px] sm:text-[12px] font-black uppercase tracking-widest outline-none border-2 transition-all appearance-none cursor-pointer shadow-sm pr-10 sm:pr-12 ${
                                currentShift ? `${currentShift.color} text-white border-transparent` : 'bg-white text-slate-400 border-slate-100'
                              }`}
                            >
                                <option value="">- LIBUR / OFF -</option>
                                {shifts.map(s => <option key={s.id} value={s.id} className="bg-white text-slate-900">{s.name.toUpperCase()} ({s.startTime}-{s.endTime})</option>)}
                            </select>
                            <div className={`absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none ${currentShift ? 'text-white' : 'text-slate-300'}`}>
                               <Icons.ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                         </div>
                       ) : (
                         <div className={`w-full p-4 sm:p-6 rounded-xl sm:rounded-[28px] text-[10px] sm:text-[12px] font-black uppercase tracking-widest flex justify-between items-center shadow-sm ${
                           currentShift ? `${currentShift.color} text-white` : 'bg-white text-slate-400'
                         }`}>
                           <span>{currentShift ? currentShift.name : '- LIBUR / OFF -'}</span>
                           {currentShift && <span className="opacity-80 text-[8px] sm:text-[10px] font-bold">{currentShift.startTime} - {currentShift.endTime}</span>}
                         </div>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10 animate-in fade-in duration-300">
             <div className="space-y-2 sm:space-y-4 text-center">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase">Tipe Shift Aktif</h3>
                <p className="text-xs sm:text-sm text-slate-400 font-medium">Definisikan jam kerja untuk shift yang tersedia di perusahaan.</p>
             </div>

             <div className="space-y-4">
                {shifts.map((shift, idx) => (
                  <div key={shift.id} className="bg-slate-50 p-5 sm:p-8 rounded-[24px] sm:rounded-[40px] border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 items-end shadow-inner">
                     <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase ml-1 sm:ml-2">NAMA SHIFT</label>
                        <input type="text" value={shift.name} onChange={e => { const newShifts = [...shifts]; newShifts[idx].name = e.target.value; setShifts(newShifts); }} className="w-full bg-white border border-slate-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black uppercase outline-none focus:border-yellow-400 text-black shadow-sm" />
                     </div>
                     <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase ml-1 sm:ml-2">MULAI</label>
                        <input type="time" value={shift.startTime} onChange={e => { const newShifts = [...shifts]; newShifts[idx].startTime = e.target.value; setShifts(newShifts); }} className="w-full bg-white border border-slate-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black outline-none focus:border-yellow-400 text-black shadow-sm" />
                     </div>
                     <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase ml-1 sm:ml-2">SELESAI</label>
                        <input type="time" value={shift.endTime} onChange={e => { const newShifts = [...shifts]; newShifts[idx].endTime = e.target.value; setShifts(newShifts); }} className="w-full bg-white border border-slate-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black outline-none focus:border-yellow-400 text-black shadow-sm" />
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => shifts.length > 1 && setShifts(shifts.filter(s => s.id !== shift.id))} className="w-full bg-white border border-slate-200 text-rose-500 p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90 flex items-center justify-center"><Icons.Trash className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                     </div>
                  </div>
                ))}
             </div>

             <div className="pt-6 sm:pt-10 border-t flex flex-col sm:flex-row gap-4 sm:gap-5">
                <button onClick={() => setShifts([...shifts, { id: Date.now().toString(), name: 'NEW SHIFT', startTime: '09:00', endTime: '17:00', color: 'bg-slate-500' }])} className="flex-1 bg-slate-100 border border-slate-200 text-slate-600 py-4 sm:py-6 rounded-2xl sm:rounded-[28px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest active:scale-95 transition-all shadow-sm">TAMBAH TIPE SHIFT</button>
                <button onClick={handleSaveConfig} className="flex-1 bg-[#0f172a] text-[#FFC000] py-4 sm:py-6 rounded-2xl sm:rounded-[28px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">SIMPAN KONFIGURASI</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftModule;
