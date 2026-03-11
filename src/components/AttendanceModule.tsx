
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Employee, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AttendanceModuleProps {
  employees: Employee[];
  records: AttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  searchQuery: string;
  userRole: string;
  currentEmployee: Employee | null;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  weeklyHolidays: Record<string, string[]>;
  company: string;
  positionRates: any[];
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  employees,
  records,
  setRecords,
  searchQuery,
  userRole,
  currentEmployee,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  weeklyHolidays,
  company,
  positionRates
}) => {
  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const employee = employees.find(e => e.id === record.employeeId);
      const nameMatch = employee?.nama.toLowerCase().includes(searchQuery.toLowerCase());
      const dateMatch = record.date >= startDate && record.date <= endDate;
      return nameMatch && dateMatch;
    });
  }, [records, employees, searchQuery, startDate, endDate]);

  const exportToExcel = () => {
    const data = filteredRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return {
        'Nama': emp?.nama || 'Unknown',
        'Tanggal': r.date,
        'Jam Masuk': r.clockIn || '-',
        'Jam Pulang': r.clockOut || '-',
        'Status': r.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Data Absensi</h2>
          <p className="text-slate-500 text-sm font-medium">Kelola dan pantau kehadiran karyawan</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => onStartDateChange(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none"
            />
            <span className="mx-2 text-slate-300">-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => onEndDateChange(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none"
            />
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Icons.Plus className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-bottom border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Karyawan</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Masuk</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pulang</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => {
                  const employee = employees.find(e => e.id === record.employeeId);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-200">
                            {employee?.nama.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-700 text-sm">{employee?.nama}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">{record.date}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          {record.clockIn || '--:--'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                          {record.clockOut || '--:--'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          record.status === 'Hadir' ? 'bg-emerald-100 text-emerald-700' :
                          record.status === 'Terlambat' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    Tidak ada data absensi ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModule;
