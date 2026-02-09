
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
          await supabase.from('shift_assignment').delete().eq('id', existing.id);
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

      const { data, error } = await supabase.from('shift_assignment').upsert(
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

    if (dataToExport.length === 0) {
      alert("Tidak ada data untuk diekspor dalam rentang tersebut.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Log Shift");
    XLSX.writeFile(workbook, `Shift_${company}_${startDate}_to_${endDate}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'TANGGAL': '2026-02-06',
        'ID KARYAWAN': 'VID-7251',
        'NAMA': 'NAMA CONTOH',
        'SHIFT': 'Shift Pagi'
      }
    ];
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
          if (!emp) return null;
          
          const shift = shifts.find(s => s.name.toLowerCase() === String(row['SHIFT']).toLowerCase());
          if (!shift) return null;

          return {
            employeeId: emp.id,
            date: String(row['TANGGAL']),
            shiftId: shift.id,
            company: company
          };
        }).filter(a => a !== null);

        if (newAssignments.length > 0) {
          const { data: inserted, error } = await supabase.from('shift_assignment').upsert(newAssignments, { onConflict: 'employeeId,date' }).select();
          if (error) throw error;
          
          setAssignments(prev => {
            const updated = [...prev];
            inserted?.forEach(item => {
              const idx = updated.findIndex(a => a.employeeId === item.employeeId && a.date === item.date);
              if (idx !== -1) updated[idx] = item;
              else updated.push(item);
            });
            return updated;
          });
          alert(`Berhasil mengimpor ${inserted?.length} jadwal shift!`);
        } else {
          alert("Tidak ada data jadwal valid ditemukan.");
        }
      } catch (err: any) {
        alert("Gagal impor: " + err.message);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveConfig = () => {
    localStorage.setItem(`shifts_config_${company}`, JSON.stringify(shifts));
    alert("Tipe Shift berhasil disimpan secara lokal!");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-[48px] p-8 sm:p-12 shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div className="bg-[#0f172a] p-5 rounded-3xl text-[#FFC000] shadow-xl">
               <Icons.Calendar className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">Jadwal Shift</h2>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner mt-4 w-fit">
                <button 
                  onClick={() => setActiveTab('VIEW')} 
                  className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'VIEW' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  LIHAT JADWAL
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => setActiveTab('MANAGE')} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'MANAGE' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ATUR SHIFT
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="flex flex-wrap gap-3 items-end">
               <div className="bg-slate-50 border border-slate-100 px-6 py-3.5 rounded-[22px] flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">MULAI</span>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-transparent text-sm font-black text-slate-900 outline-none cursor-pointer"
                  />
               </div>
               <div className="bg-slate-50 border border-slate-100 px-6 py-3.5 rounded-[22px] flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">SAMPAI</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-transparent text-sm font-black text-slate-900 outline-none cursor-pointer"
                  />
               </div>
               <button onClick={handleExport} className="bg-slate-900 text-white h-[60px] px-8 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">EKSPOR</button>
            </div>
            {isAdmin && activeTab === 'VIEW' && (
              <div className="flex gap-2">
                <button onClick={handleDownloadTemplate} className="flex-1 bg-slate-50 border border-slate-200 text-slate-400 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                  <Icons.Download className="w-3.5 h-3.5" /> TEMPLATE
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex-1 bg-emerald-50 border border-emerald-100 text-emerald-600 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                  <Icons.Upload className="w-3.5 h-3.5" /> {isImporting ? '...' : 'IMPORT'}
                </button>
              </div>
            )}
          </div>
        </div>

        {activeTab === 'VIEW' ? (
          <div className="space-y-8">
            <div className="relative w-full">
              <Icons.Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="text" 
                placeholder="CARI NAMA ATAU ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 pl-14 pr-8 py-5 rounded-[28px] text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/10 transition-all text-black"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredEmployees.map(emp => {
                const dayAssignment = assignments.find(a => a.employeeId === emp.id && a.date === startDate);
                const currentShift = shifts.find(s => s.id === dayAssignment?.shiftId);
                
                return (
                  <div key={emp.id} className="bg-white border border-slate-100 rounded-[36px] p-6 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-md">
                        {emp.photoBase64 ? <img src={emp.photoBase64} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="flex-grow">
                        <p className="text-sm font-black text-slate-900 uppercase truncate leading-none">{emp.nama}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{emp.jabatan}</p>
                      </div>
                    </div>

                    <div className="mt-8 space-y-3 relative z-10">
                       <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">Status Shift ({startDate})</label>
                       {isAdmin ? (
                         <select 
                          value={dayAssignment?.shiftId || ''} 
                          onChange={(e) => handleAssignShift(emp.id, e.target.value)}
                          className={`w-full p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none border-2 transition-all appearance-none cursor-pointer ${
                            currentShift ? `${currentShift.color} text-white border-transparent` : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}
                         >
                            <option value="">- LIBUR / OFF -</option>
                            {shifts.map(s => <option key={s.id} value={s.id} className="bg-white text-slate-900">{s.name.toUpperCase()} ({s.startTime}-{s.endTime})</option>)}
                         </select>
                       ) : (
                         <div className={`w-full p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex justify-between items-center ${
                           currentShift ? `${currentShift.color} text-white` : 'bg-slate-50 text-slate-400'
                         }`}>
                           <span>{currentShift ? currentShift.name : 'OFF'}</span>
                           {currentShift && <span className="opacity-70">{currentShift.startTime} - {currentShift.endTime}</span>}
                         </div>
                       )}
                    </div>
                    
                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-opacity"></div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-300">
             <div className="space-y-4">
                <h3 className="text-xl font-black text-slate-900 uppercase">Tipe Shift Aktif</h3>
                <p className="text-xs text-slate-400 font-medium">Atur nama dan jam kerja untuk pilihan shift di perusahaan.</p>
             </div>

             <div className="space-y-4">
                {shifts.map((shift, idx) => (
                  <div key={shift.id} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">NAMA SHIFT</label>
                        <input 
                          type="text" 
                          value={shift.name} 
                          onChange={e => {
                            const newShifts = [...shifts];
                            newShifts[idx].name = e.target.value;
                            setShifts(newShifts);
                          }}
                          className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm font-black uppercase outline-none focus:border-yellow-400 text-black"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">JAM MULAI</label>
                        <input 
                          type="time" 
                          value={shift.startTime} 
                          onChange={e => {
                            const newShifts = [...shifts];
                            newShifts[idx].startTime = e.target.value;
                            setShifts(newShifts);
                          }}
                          className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm font-black outline-none focus:border-yellow-400 text-black"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">JAM SELESAI</label>
                        <input 
                          type="time" 
                          value={shift.endTime} 
                          onChange={e => {
                            const newShifts = [...shifts];
                            newShifts[idx].endTime = e.target.value;
                            setShifts(newShifts);
                          }}
                          className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm font-black outline-none focus:border-yellow-400 text-black"
                        />
                     </div>
                     <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (shifts.length <= 1) return;
                            setShifts(shifts.filter(s => s.id !== shift.id));
                          }}
                          className="bg-white border border-slate-200 text-rose-500 p-4 rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                        >
                          <Icons.Trash className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
                ))}
             </div>

             <div className="pt-8 border-t flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShifts([...shifts, { id: Date.now().toString(), name: 'NEW SHIFT', startTime: '09:00', endTime: '17:00', color: 'bg-slate-500' }])}
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-600 py-5 rounded-[22px] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                >
                  TAMBAH TIPE SHIFT
                </button>
                <button 
                  onClick={handleSaveConfig}
                  className="flex-1 bg-slate-900 text-[#FFC000] py-5 rounded-[22px] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  SIMPAN SEMUA PERUBAHAN
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftModule;
