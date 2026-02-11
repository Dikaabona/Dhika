import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, Shift, ShiftAssignment } from '../types';
import { Icons, DEFAULT_SHIFTS } from '../constants';
import { supabase } from '../App';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';

interface ShiftModuleProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<ShiftAssignment[]>>;
  userRole: string;
  company: string;
  onClose: () => void;
}

const ShiftModule: React.FC<ShiftModuleProps> = ({ employees, assignments, setAssignments, userRole, company, onClose }) => {
  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const [activeTab, setActiveTab] = useState<'VIEW' | 'MANAGE'>('VIEW');
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

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

  const datesInRange = useMemo(() => {
    const dates = [];
    let cur = new Date(startDate);
    let end = new Date(endDate);
    if (isNaN(cur.getTime()) || isNaN(end.getTime())) return [];
    
    cur.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    while (cur <= end) {
      dates.push(formatDateToYYYYMMDD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates.reverse();
  }, [startDate, endDate]);

  const tableRows = useMemo(() => {
    const rows: { employee: Employee; date: string }[] = [];
    datesInRange.forEach(date => filteredEmployees.forEach(employee => rows.push({ employee, date })));
    return rows;
  }, [filteredEmployees, datesInRange]);

  const totalPages = Math.ceil(tableRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    return tableRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [tableRows, currentPage]);

  const handleAssignShift = async (employeeId: string, date: string, shiftId: string) => {
    if (!isAdmin) return;
    
    const existing = assignments.find(a => a.employeeId === employeeId && a.date === date);
    
    try {
      if (shiftId === '') {
        if (existing) {
          const { error } = await supabase.from('shift_assignments').delete().eq('id', existing.id);
          if (error) throw error;
          setAssignments(prev => prev.filter(a => a.id !== existing.id));
        }
        return;
      }

      const newAssignment: Partial<ShiftAssignment> = {
        employeeId,
        date,
        shiftId,
        company
      };

      const { data, error } = await supabase.from('shift_assignments').upsert(
        existing ? { ...newAssignment, id: existing.id } : newAssignment,
        { onConflict: 'employeeId,date' }
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

  const parseExcelDate = (val: any) => {
    if (!val) return '';
    if (val instanceof Date) return formatDateToYYYYMMDD(val);
    
    // Handle excel numeric date
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return formatDateToYYYYMMDD(date);
    }

    const str = String(val).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      // DD/MM/YYYY
      if (parts[0].length <= 2) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      // YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return str;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const newAssignmentsRaw = jsonData.map((row: any) => {
          // Normalize headers (case-insensitive)
          const keys = Object.keys(row);
          const idKey = keys.find(k => k.toUpperCase() === 'ID KARYAWAN');
          const shiftKey = keys.find(k => k.toUpperCase() === 'SHIFT');
          const dateKey = keys.find(k => k.toUpperCase() === 'TANGGAL');

          if (!idKey || !shiftKey || !dateKey) return null;

          const empIdKaryawan = String(row[idKey]).trim();
          const shiftNameInput = String(row[shiftKey]).trim();
          const rawDate = row[dateKey];

          const emp = employees.find(e => String(e.idKaryawan).trim() === empIdKaryawan);
          const shift = shifts.find(s => s.name.toLowerCase().trim() === shiftNameInput.toLowerCase());
          const formattedDate = parseExcelDate(rawDate);

          if (!emp || !shift || !formattedDate) return null;
          
          return { 
            employeeId: emp.id, 
            date: formattedDate, 
            shiftId: shift.id, 
            company: company 
          };
        }).filter((a): a is ShiftAssignment => a !== null);

        if (newAssignmentsRaw.length > 0) {
          // Deduplicate by employeeId and date to prevent internal conflict in the batch
          const dedupedMap = new Map<string, ShiftAssignment>();
          newAssignmentsRaw.forEach(item => {
            const key = `${item.employeeId}_${item.date}`;
            dedupedMap.set(key, item);
          });
          const finalBatch = Array.from(dedupedMap.values());

          const { data: upsertedData, error } = await supabase
            .from('shift_assignments')
            .upsert(finalBatch, { onConflict: 'employeeId,date' })
            .select();

          if (error) throw error;
          
          // Update local state without full reload
          setAssignments(prev => {
            const updated = [...prev];
            upsertedData?.forEach(newItem => {
              const idx = updated.findIndex(a => a.employeeId === newItem.employeeId && a.date === newItem.date);
              if (idx !== -1) updated[idx] = newItem;
              else updated.push(newItem);
            });
            return updated;
          });

          alert(`Berhasil mengimpor ${finalBatch.length} jadwal shift!`);
        } else {
          alert("Tidak ada data valid untuk diimpor. Pastikan header sesuai: TANGGAL, ID KARYAWAN, SHIFT");
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

  const handleExport = () => {
    const dataToExport = tableRows.map(row => {
      const dayAssignment = assignments.find(a => a.employeeId === row.employee.id && a.date === row.date);
      const shiftName = shifts.find(s => s.id === dayAssignment?.shiftId)?.name || 'OFF / LIBUR';
      return {
        'TANGGAL': row.date,
        'ID KARYAWAN': row.employee.idKaryawan,
        'NAMA': row.employee.nama,
        'SHIFT': shiftName
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Shift");
    XLSX.writeFile(wb, `Shift_${company}_${startDate}_to_${endDate}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [{ 'TANGGAL': '2026-02-06', 'ID KARYAWAN': employees[0]?.idKaryawan || 'VID-7251', 'SHIFT': shifts[0]?.name || 'Shift Pagi' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Shift");
    XLSX.writeFile(wb, `Template_Shift_${company}.xlsx`);
  };

  const handleSaveConfig = () => {
    localStorage.setItem(`shifts_config_${company}`, JSON.stringify(shifts));
    alert("Tipe Shift berhasil disimpan secara lokal!");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8 animate-in fade-in duration-500 pb-20 px-4 sm:px-0">
      <div className="bg-white rounded-[32px] sm:rounded-[48px] p-6 sm:p-12 shadow-sm border border-slate-50 overflow-hidden">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 sm:gap-8 mb-8 sm:mb-12">
           <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">Jadwal Shift</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manajemen Waktu Kerja Karyawan</p>
           </div>
           <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
              <button 
                onClick={() => setActiveTab('VIEW')} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'VIEW' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                LIHAT JADWAL
              </button>
              <button 
                onClick={() => setActiveTab('MANAGE')} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'MANAGE' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                KELOLA SHIFT
              </button>
           </div>
        </div>

        {activeTab === 'VIEW' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
             <div className="flex flex-col lg:flex-row items-center gap-4 bg-slate-50 p-2 rounded-[32px] border border-slate-100 shadow-inner">
                <div className="flex items-center gap-4 px-8 py-4 bg-white rounded-[24px] shadow-sm border border-slate-100 shrink-0">
                   <div className="flex flex-col items-start min-w-[120px]">
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Mulai</span>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
                        className="bg-transparent text-sm font-black outline-none text-slate-900 cursor-pointer" 
                      />
                   </div>
                   <div className="h-8 w-px bg-slate-100"></div>
                   <div className="flex flex-col items-start min-w-[120px]">
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Selesai</span>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
                        className="bg-transparent text-sm font-black outline-none text-slate-900 cursor-pointer" 
                      />
                   </div>
                </div>
                <div className="relative flex-grow w-full px-6 py-4 bg-white rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4">
                   <Icons.Search className="w-5 h-5 text-slate-300" />
                   <input 
                    type="text" 
                    placeholder="CARI KARYAWAN..." 
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-transparent text-[11px] font-black outline-none text-slate-800 placeholder:text-slate-300 uppercase tracking-widest"
                   />
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={handleDownloadTemplate} className="bg-slate-100 text-slate-500 px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-sm">Template</button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-emerald-50 text-emerald-600 px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-lg flex items-center gap-2">
                      <Icons.Upload className="w-4 h-4" /> {isImporting ? '...' : 'Import'}
                    </button>
                    <button onClick={handleExport} className="bg-slate-900 text-white px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-lg">Export</button>
                  </div>
                )}
             </div>

             <div className="bg-white rounded-[40px] border border-slate-100 overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                   <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                      <tr>
                         <th className="px-10 py-6">Tanggal</th>
                         <th className="px-10 py-6">Karyawan</th>
                         <th className="px-10 py-6">Jabatan</th>
                         <th className="px-10 py-6 text-center">Status Shift</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {paginatedRows.map(row => {
                        const dayAssignment = assignments.find(a => a.employeeId === row.employee.id && a.date === row.date);
                        const activeShift = shifts.find(s => s.id === dayAssignment?.shiftId);
                        
                        return (
                          <tr key={`${row.employee.id}-${row.date}`} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-10 py-5 whitespace-nowrap">
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{row.date}</p>
                             </td>
                             <td className="px-10 py-5 whitespace-nowrap">
                                <div className="flex flex-col">
                                   <p className="text-[11px] font-black text-slate-900 uppercase">{row.employee.nama}</p>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{row.employee.idKaryawan}</p>
                                </div>
                             </td>
                             <td className="px-10 py-5 whitespace-nowrap">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{row.employee.jabatan}</span>
                             </td>
                             <td className="px-10 py-5 text-center whitespace-nowrap">
                                {isAdmin ? (
                                  <select 
                                    value={dayAssignment?.shiftId || ''} 
                                    onChange={(e) => handleAssignShift(row.employee.id, row.date, e.target.value)}
                                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm outline-none cursor-pointer border ${activeShift ? `${activeShift.color} text-white border-transparent` : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                                  >
                                     <option value="">OFF / LIBUR</option>
                                     {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                                  </select>
                                ) : (
                                  <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${activeShift ? `${activeShift.color} text-white border-transparent shadow-md` : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                                     {activeShift ? `${activeShift.name} (${activeShift.startTime} - ${activeShift.endTime})` : 'OFF / LIBUR'}
                                  </span>
                                )}
                             </td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>

             {totalPages > 1 && (
               <div className="bg-slate-50/50 px-10 py-5 flex items-center justify-between border-t border-slate-100 rounded-b-[40px]">
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
                   <span className="text-xs font-black text-slate-900 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">{currentPage} / {totalPages}</span>
                 </div>
                 <div className="flex gap-2">
                   <button 
                     disabled={currentPage === 1}
                     onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                     className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                   >
                     <Icons.ChevronDown className="w-5 h-5 rotate-90" />
                   </button>
                   <button 
                     disabled={currentPage === totalPages}
                     onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                     className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                   >
                     <Icons.ChevronDown className="w-5 h-5 -rotate-90" />
                   </button>
                 </div>
               </div>
             )}
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-12">
             <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-100 space-y-10">
                <div className="flex flex-col gap-2">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Konfigurasi Tipe Shift</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Definisikan jam kerja untuk perusahaan Anda.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {shifts.map((s, idx) => (
                     <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                           <div className={`w-4 h-4 rounded-full ${s.color}`}></div>
                           <input 
                            value={s.name} 
                            onChange={(e) => {
                              const upd = [...shifts];
                              upd[idx].name = e.target.value;
                              setShifts(upd);
                            }}
                            className="bg-transparent text-sm font-black uppercase outline-none text-black flex-grow"
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Masuk</span>
                              <input type="time" value={s.startTime} onChange={e => { const upd=[...shifts]; upd[idx].startTime=e.target.value; setShifts(upd); }} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-black text-black" />
                           </div>
                           <div className="space-y-1">
                              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Pulang</span>
                              <input type="time" value={s.endTime} onChange={e => { const upd=[...shifts]; upd[idx].endTime=e.target.value; setShifts(upd); }} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-black text-black" />
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
                <button onClick={handleSaveConfig} className="w-full bg-slate-900 text-[#FFC000] py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Simpan Konfigurasi</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftModule;