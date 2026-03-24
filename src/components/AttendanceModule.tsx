
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Employee, AttendanceRecord, Shift, ShiftAssignment } from '../types';
import { Icons } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AttendanceModuleProps {
  employees: Employee[];
  records: AttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userRole: string;
  currentEmployee: Employee | null;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  weeklyHolidays: Record<string, string[]>;
  company: string;
  positionRates: any[];
  shifts: Shift[];
  shiftAssignments: ShiftAssignment[];
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  employees,
  records,
  setRecords,
  searchQuery,
  setSearchQuery,
  userRole,
  currentEmployee,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  weeklyHolidays,
  company,
  positionRates,
  shifts,
  shiftAssignments
}) => {
  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [editingStatus, setEditingStatus] = useState<{ id: string; status: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [localCompanyFilter, setLocalCompanyFilter] = useState(company || 'Semua');
  
  // Sync local filter with App's companyFilter if user is owner
  useEffect(() => {
    if (userRole === 'owner' && company !== 'ALL') {
      setLocalCompanyFilter(company);
    }
  }, [company, userRole]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemsPerPage = 10;

  const companies = useMemo(() => {
    const uniqueCompanies = Array.from(new Set(employees.map(e => e.company).filter(Boolean)));
    return ['Semua', ...uniqueCompanies];
  }, [employees]);

  const getDatesInRange = (start: string, end: string) => {
    const dates = [];
    let curr = new Date(start);
    const last = new Date(end);
    while (curr <= last) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates.reverse(); // Show latest dates first
  };

  const attendanceEntries = useMemo(() => {
    const dates = getDatesInRange(startDate, endDate);
    const filteredEmployees = employees.filter(emp => {
      const empCompany = (emp.company || '').toUpperCase().trim();
      const filterCompany = (localCompanyFilter || '').toUpperCase().trim();
      const companyMatch = filterCompany === 'SEMUA' || empCompany === filterCompany;
      const searchMatch = emp.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         emp.idKaryawan?.toLowerCase().includes(searchQuery.toLowerCase());
      return companyMatch && searchMatch;
    });

    const entries: any[] = [];
    dates.forEach(date => {
      filteredEmployees.forEach(emp => {
        const record = records.find(r => r.employeeId === emp.id && r.date === date);
        const assignment = shiftAssignments.find(a => a.employeeId === emp.id && a.date === date);
        const shift = assignment ? shifts.find(s => s.id === assignment.shiftId) : null;

        if (record) {
          entries.push({ ...record, employee: emp, isVirtual: false, shift });
        } else {
          // Virtual record for employee who didn't absen
          entries.push({
            id: `virtual-${emp.id}-${date}`,
            employeeId: emp.id,
            employee: emp,
            date: date,
            clockIn: null,
            clockOut: null,
            status: 'Alpa',
            isVirtual: true,
            company: emp.company,
            shift
          });
        }
      });
    });

    return entries;
  }, [records, employees, searchQuery, startDate, endDate, localCompanyFilter, shifts, shiftAssignments]);

  const totalPages = Math.ceil(attendanceEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(() => {
    return attendanceEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [attendanceEntries, currentPage]);

  const handleUpdateStatus = async (id: string, newStatus: string, isVirtual: boolean, empId?: string, date?: string) => {
    try {
      const targetEmpId = empId || records.find(r => r.id === id)?.employeeId;
      const oldStatus = records.find(r => r.id === id || (r.employeeId === empId && r.date === date))?.status;

      let finalRecord;
      
      if (isVirtual && empId && date) {
        // Check if a record already exists for this employee and date to avoid unique constraint errors
        // even if we use upsert, sometimes it's safer to have the ID if possible
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('employeeId', empId)
          .eq('date', date)
          .maybeSingle();

        const recordToUpsert: any = {
          employeeId: empId,
          date: date,
          status: newStatus,
          company: (employees.find(e => e.id === empId)?.company || company || 'VISIBEL').toUpperCase().trim()
        };

        if (existing) {
          recordToUpsert.id = existing.id;
        }

        const { data, error } = await supabase
          .from('attendance')
          .upsert(recordToUpsert, { onConflict: 'employeeId,date' })
          .select();

        if (error) throw error;
        finalRecord = data?.[0];
      } else {
        const { data, error } = await supabase
          .from('attendance')
          .update({ 
            status: newStatus,
            company: (records.find(r => r.id === id)?.company || company || 'VISIBEL').toUpperCase().trim()
          })
          .eq('id', id)
          .select();
        
        if (error) throw error;
        finalRecord = data?.[0];
      }

      if (finalRecord) {
        // Sync sisaCuti if status changed to/from 'Cuti'
        if (targetEmpId && oldStatus !== newStatus) {
          const employee = employees.find(e => e.id === targetEmpId);
          if (employee) {
            let newSisaCuti = employee.sisaCuti || 0;
            if (oldStatus !== 'Cuti' && newStatus === 'Cuti') {
              newSisaCuti -= 1;
            } else if (oldStatus === 'Cuti' && newStatus !== 'Cuti') {
              newSisaCuti += 1;
            }

            if (newSisaCuti !== (employee.sisaCuti || 0)) {
              await supabase.from('employees').update({ sisaCuti: newSisaCuti }).eq('id', targetEmpId);
            }
          }
        }

        setRecords(prev => {
          const index = prev.findIndex(r => r.id === finalRecord.id || (r.employeeId === finalRecord.employeeId && r.date === finalRecord.date));
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...finalRecord };
            return updated;
          }
          return [finalRecord, ...prev];
        });
      }
      setEditingStatus(null);
    } catch (err: any) {
      alert("Gagal memperbarui status: " + err.message);
    }
  };

  const exportToExcel = () => {
    const data = attendanceEntries.map(r => {
      const emp = r.employee;
      return {
        'ID Karyawan': emp?.idKaryawan || emp?.id || '-',
        'Nama': emp?.nama || 'Unknown',
        'Tanggal': r.date,
        'Jam Masuk': r.clockIn || '-',
        'Jam Pulang': r.clockOut || '-',
        'Status': r.status,
        'Catatan': r.notes || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${startDate}_to_${endDate}.xlsx`);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'ID Karyawan': 'VSB-01',
        'Tanggal': '2024-03-11',
        'Jam Masuk': '08:00',
        'Jam Pulang': '17:00',
        'Status': 'Hadir',
        'Catatan': 'Import Manual'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Absensi.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { raw: false }) as any[];

        const parseYMDToIso = (val: any) => {
          if (!val) return '';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          const str = String(val).trim();
          if (!str || str === '-') return '';

          // Handle Excel serial date
          if (!isNaN(Number(str)) && Number(str) > 30000) {
            const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
          }

          // Try DD/MM/YYYY or DD-MM-YYYY
          const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
          if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
          }
          
          // Try YYYY/MM/DD or YYYY-MM-DD
          const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
          if (ymdMatch) {
            return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
          }

          // Fallback to native Date
          const d = new Date(str);
          if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
          }
          return str;
        };

        const parseTimeToStr = (val: any) => {
          if (!val) return null;
          const str = String(val).trim();
          if (!str || str === '-') return null;

          // Handle Excel serial time (e.g., 0.3333 for 08:00)
          if (!isNaN(Number(str)) && Number(str) < 1) {
            const totalSeconds = Math.round(Number(str) * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }

          // Try to parse with Date to handle AM/PM and other formats
          const d = new Date(`2000-01-01 ${str.replace(/\./g, ':')}`);
          if (!isNaN(d.getTime())) {
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          }

          // Fallback regex for HH:mm or H:m
          const timeMatch = str.match(/^(\d{1,2})[:.](\d{1,2})/);
          if (timeMatch) {
            return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
          }

          return str;
        };

        const newRecords: AttendanceRecord[] = [];
        for (const row of jsonData) {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              if (row[k] !== undefined) return row[k];
              const lowerK = k.toLowerCase();
              if (row[lowerK] !== undefined) return row[lowerK];
              const upperK = k.toUpperCase();
              if (row[upperK] !== undefined) return row[upperK];
            }
            return undefined;
          };

          const empId = getVal(['ID Karyawan', 'ID', 'Employee ID', 'ID_Karyawan']);
          const dateVal = getVal(['Tanggal', 'Date', 'TANGGAL']);
          const clockInVal = getVal(['Jam Masuk', 'Clock In', 'ClockIn', 'JAM_MASUK']);
          const clockOutVal = getVal(['Jam Pulang', 'Clock Out', 'ClockOut', 'JAM_PULANG']);
          const statusVal = getVal(['Status', 'STATUS']);
          const notesVal = getVal(['Catatan', 'Notes', 'CATATAN']);
          const companyVal = getVal(['Company', 'COMPANY', 'Perusahaan']);

          const employee = employees.find(e => e.idKaryawan === empId || e.id === empId);
          const normalizedDate = parseYMDToIso(dateVal);
          
          if (employee && normalizedDate) {
            newRecords.push({
              employeeId: employee.id,
              date: normalizedDate,
              clockIn: parseTimeToStr(clockInVal) || undefined,
              clockOut: parseTimeToStr(clockOutVal) || undefined,
              status: statusVal || 'Hadir',
              notes: notesVal || 'Imported',
              company: (companyVal || employee.company || company || 'VISIBEL').toUpperCase().trim()
            });
          }
        }

        if (newRecords.length > 0) {
          // Fetch existing records to get IDs for upsert to avoid unique constraint issues
          const employeeIds = [...new Set(newRecords.map(r => r.employeeId))];
          const dates = [...new Set(newRecords.map(r => r.date))];
          
          const { data: existingRecords } = await supabase
            .from('attendance')
            .select('id, employeeId, date')
            .in('employeeId', employeeIds)
            .in('date', dates);

          const finalRecords = newRecords.map(r => {
            const existing = existingRecords?.find(er => er.employeeId === r.employeeId && er.date === r.date);
            if (existing) return { ...r, id: existing.id } as AttendanceRecord;
            return r;
          });

          const { data: upsertedData, error } = await supabase.from('attendance').upsert(finalRecords, { onConflict: 'employeeId,date' }).select();
          if (error) throw error;
          
          alert(`Berhasil mengimpor ${newRecords.length} data absensi!`);
          
          setRecords(prev => {
            const updated = [...prev];
            (upsertedData || []).forEach(nr => {
              const index = updated.findIndex(r => r.employeeId === nr.employeeId && r.date === nr.date);
              if (index !== -1) {
                updated[index] = { ...updated[index], ...nr };
              } else {
                updated.unshift(nr);
              }
            });
            return updated;
          });
        }
      } catch (err: any) {
        alert("Gagal mengimpor data: " + err.message);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">Data Absensi</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">Kelola dan pantau kehadiran karyawan</p>
          </div>
          
          {userRole === 'owner' && (
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
              <Icons.Building className="w-4 h-4 text-slate-400" />
              <select 
                value={localCompanyFilter}
                onChange={(e) => {
                  setLocalCompanyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-[10px] font-black text-slate-700 outline-none bg-transparent uppercase tracking-widest"
              >
                {companies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-grow">
            <div className="relative flex-grow lg:flex-initial lg:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex items-center gap-3">
              <Icons.Search className="w-4 h-4 text-slate-300 shrink-0" />
              <input 
                type="text" 
                placeholder="CARI NAMA / ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[10px] font-black text-slate-700 outline-none placeholder:text-slate-300 uppercase tracking-widest bg-transparent"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => onStartDateChange(e.target.value)}
                className="text-[10px] font-black text-slate-600 outline-none bg-transparent uppercase"
              />
              <span className="mx-3 text-slate-300 font-bold">-</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => onEndDateChange(e.target.value)}
                className="text-[10px] font-black text-slate-600 outline-none bg-transparent uppercase"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 border border-slate-200 px-4 sm:px-6 py-3 rounded-full font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-sm hover:bg-white transition-all active:scale-95"
                >
                  <Icons.Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="truncate">TEMPLATE</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-2 bg-[#059669] text-white px-4 sm:px-6 py-3 rounded-full font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-[#047857] transition-all active:scale-95 disabled:opacity-50"
                >
                  <Icons.Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="truncate">{isImporting ? '...' : 'IMPORT'}</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImport} 
                  className="hidden" 
                  accept=".xlsx,.xls" 
                />
              </>
            )}
            <button 
              onClick={exportToExcel}
              className={`flex items-center justify-center gap-2 bg-[#FFC000] text-black px-4 sm:px-6 py-3 rounded-full font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-[#eab308] transition-all active:scale-95 ${!isAdmin ? 'col-span-2' : ''}`}
            >
              <Icons.Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">EKSPOR</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Karyawan</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Masuk</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pulang</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((record) => {
                  const employee = record.employee;
                  const shift = record.shift;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-sm whitespace-nowrap">{employee?.nama}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{employee?.idKaryawan || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-500 whitespace-nowrap">{record.date}</td>
                      <td className="px-8 py-5">
                        {shift ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-700 uppercase">{shift.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{shift.startTime} - {shift.endTime}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No Shift</span>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                              {record.clockIn || '--:--'}
                            </span>
                            {record.photoIn && (
                              <button 
                                onClick={() => setSelectedPhoto({ url: record.photoIn!, title: `Foto Masuk - ${employee?.nama}` })}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all active:scale-90 shadow-sm border border-emerald-100"
                                title="Lihat Foto Masuk"
                              >
                                <Icons.Camera className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {shift && (
                            <span className="text-[8px] font-bold text-slate-400 uppercase pl-1">Jadwal: {shift.startTime}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                              {record.clockOut || '--:--'}
                            </span>
                            {record.photoOut && (
                              <button 
                                onClick={() => setSelectedPhoto({ url: record.photoOut!, title: `Foto Pulang - ${employee?.nama}` })}
                                className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all active:scale-90 shadow-sm border border-rose-100"
                                title="Lihat Foto Pulang"
                              >
                                <Icons.Camera className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {shift && (
                            <span className="text-[8px] font-bold text-slate-400 uppercase pl-1">Jadwal: {shift.endTime}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        {editingStatus && editingStatus.id === record.id ? (
                          <select 
                            value={editingStatus.status}
                            onChange={(e) => handleUpdateStatus(record.id!, e.target.value, record.isVirtual, record.employeeId, record.date)}
                            onBlur={() => setEditingStatus(null)}
                            autoFocus
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-slate-200 outline-none bg-white shadow-sm"
                          >
                            <option value="Hadir">Hadir</option>
                            <option value="Cuti">Cuti</option>
                            <option value="Izin">Izin</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Alpa">Alpa</option>
                            <option value="Libur">Libur</option>
                          </select>
                        ) : (
                          <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${
                            record.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            record.status === 'Cuti' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                            record.status === 'Terlambat' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            record.status === 'Izin' || record.status === 'Sakit' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            record.status === 'Alpa' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            'bg-slate-50 text-slate-700 border-slate-100'
                          }`}>
                            {record.status}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {isAdmin && (
                          <button 
                            onClick={() => setEditingStatus({ id: record.id!, status: record.status })}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                            title="Edit Status"
                          >
                            <Icons.Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <Icons.Clock className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">
                        Tidak ada data absensi ditemukan
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {paginatedEntries.length > 0 ? (
            paginatedEntries.map((record) => {
              const employee = record.employee;
              const shift = record.shift;
              return (
                <div key={record.id} className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm">{employee?.nama}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{employee?.idKaryawan || '-'}</span>
                        {shift && (
                          <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-1.5 py-0.5 rounded-md">{shift.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.date}</span>
                      {editingStatus && editingStatus.id === record.id ? (
                        <select 
                          value={editingStatus.status}
                          onChange={(e) => handleUpdateStatus(record.id!, e.target.value, record.isVirtual, record.employeeId, record.date)}
                          onBlur={() => setEditingStatus(null)}
                          autoFocus
                          className="text-[9px] font-black uppercase px-2 py-1 rounded-lg border border-slate-200 outline-none bg-white shadow-sm"
                        >
                          <option value="Hadir">Hadir</option>
                          <option value="Cuti">Cuti</option>
                          <option value="Izin">Izin</option>
                          <option value="Sakit">Sakit</option>
                          <option value="Alpa">Alpa</option>
                          <option value="Libur">Libur</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border ${
                            record.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            record.status === 'Cuti' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                            record.status === 'Terlambat' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            record.status === 'Izin' || record.status === 'Sakit' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            record.status === 'Alpa' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            'bg-slate-50 text-slate-700 border-slate-100'
                          }`}>
                            {record.status}
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={() => setEditingStatus({ id: record.id!, status: record.status })}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"
                            >
                              <Icons.Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Jam Masuk</span>
                        {shift && (
                          <span className="text-[7px] font-bold text-slate-400 uppercase">Jadwal: {shift.startTime}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-slate-600">{record.clockIn || '--:--'}</span>
                        {record.photoIn && (
                          <button 
                            onClick={() => setSelectedPhoto({ url: record.photoIn!, title: `Foto Masuk - ${employee?.nama}` })}
                            className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"
                          >
                            <Icons.Camera className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Jam Pulang</span>
                        {shift && (
                          <span className="text-[7px] font-bold text-slate-400 uppercase">Jadwal: {shift.endTime}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-slate-600">{record.clockOut || '--:--'}</span>
                        {record.photoOut && (
                          <button 
                            onClick={() => setSelectedPhoto({ url: record.photoOut!, title: `Foto Pulang - ${employee?.nama}` })}
                            className="p-1.5 bg-rose-100 text-rose-700 rounded-lg"
                          >
                            <Icons.Camera className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                  <Icons.Clock className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                  Tidak ada data absensi ditemukan
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 transition-all active:scale-90"
          >
            <Icons.ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          
          <div className="flex items-center gap-1">
            {(() => {
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              let end = Math.min(totalPages, start + maxVisible - 1);
              
              if (end - start + 1 < maxVisible) {
                start = Math.max(1, end - maxVisible + 1);
              }

              if (start > 1) {
                pages.push(
                  <button key={1} onClick={() => setCurrentPage(1)} className="w-8 h-8 rounded-xl text-[10px] font-black bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 transition-all active:scale-90">1</button>
                );
                if (start > 2) pages.push(<span key="dots-start" className="text-slate-300 px-1">...</span>);
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all active:scale-90 ${
                      currentPage === i 
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {i}
                  </button>
                );
              }

              if (end < totalPages) {
                if (end < totalPages - 1) pages.push(<span key="dots-end" className="text-slate-300 px-1">...</span>);
                pages.push(
                  <button key={totalPages} onClick={() => setCurrentPage(totalPages)} className="w-8 h-8 rounded-xl text-[10px] font-black bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 transition-all active:scale-90">{totalPages}</button>
                );
              }

              return pages;
            })()}
          </div>

          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 transition-all active:scale-90"
          >
            <Icons.ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] overflow-hidden max-w-md w-full shadow-2xl border border-white/10">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">{selectedPhoto.title}</h3>
              <button onClick={() => setSelectedPhoto(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <Icons.X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-8 flex justify-center bg-white">
              <div className="w-full aspect-square rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-inner">
                <img src={selectedPhoto.url} alt="Absensi" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 text-center">
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-black transition-all active:scale-95"
              >
                TUTUP PRATINJAU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceModule;
