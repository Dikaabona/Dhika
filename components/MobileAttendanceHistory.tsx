
import React, { useMemo, useState } from 'react';
import { Employee, AttendanceRecord, ShiftAssignment, Shift } from '../types';
import { Icons, DEFAULT_SHIFTS } from '../constants';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';

interface MobileAttendanceHistoryProps {
  employee: Employee;
  records: AttendanceRecord[];
  shiftAssignments: ShiftAssignment[];
  shifts: Shift[];
  onClose: () => void;
}

const MobileAttendanceHistory: React.FC<MobileAttendanceHistoryProps> = ({
  employee,
  records,
  shiftAssignments,
  shifts,
  onClose
}) => {
  const [filter, setFilter] = useState<'Semua' | 'Hadir' | 'Terlambat' | 'Cuti' | 'Tidak Hadir'>('Semua');

  const attendanceData = useMemo(() => {
    // Filter records for this employee
    const empRecords = records.filter(r => r.employeeId === employee.id);
    
    // Calculate stats
    const stats = {
      total: empRecords.length,
      hadir: empRecords.filter(r => r.status === 'Hadir' || r.status === 'Lembur').length,
      terlambat: empRecords.filter(r => {
        const assignment = shiftAssignments.find(a => a.employeeId === employee.id && a.date === r.date);
        const shift = (shifts || DEFAULT_SHIFTS).find(s => s.id === assignment?.shiftId);
        return r.clockIn && shift?.startTime && r.clockIn > shift.startTime;
      }).length,
      cuti: empRecords.filter(r => r.status === 'Cuti').length
    };

    // Filter by tab
    const filtered = empRecords.filter(r => {
      if (filter === 'Semua') return true;
      if (filter === 'Hadir') return r.status === 'Hadir' || r.status === 'Lembur';
      if (filter === 'Terlambat') {
        const assignment = shiftAssignments.find(a => a.employeeId === employee.id && a.date === r.date);
        const shift = (shifts || DEFAULT_SHIFTS).find(s => s.id === assignment?.shiftId);
        return r.clockIn && shift?.startTime && r.clockIn > shift.startTime;
      }
      if (filter === 'Cuti') return r.status === 'Cuti';
      if (filter === 'Tidak Hadir') return r.status === 'Alpha';
      return true;
    });

    return { stats, list: filtered.sort((a, b) => b.date.localeCompare(a.date)) };
  }, [employee, records, shiftAssignments, shifts, filter]);

  const getStatusBadge = (status: string, isLate: boolean) => {
    if (status === 'Cuti') return <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-[10px] font-bold">Cuti</span>;
    if (isLate) return <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold">Terlambat</span>;
    if (status === 'Hadir' || status === 'Lembur') return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[10px] font-bold">Hadir</span>;
    if (status === 'Alpha') return <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded text-[10px] font-bold">Tidak Hadir</span>;
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{status}</span>;
  };

  const calculateDuration = (clockIn?: string, clockOut?: string) => {
    if (!clockIn || !clockOut || clockOut === '--:--') return null;
    const start = clockIn.split(':').map(Number);
    const end = clockOut.split(':').map(Number);
    let diff = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
    if (diff < 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}j ${m}m`;
  };

  return (
    <div className="fixed inset-0 bg-[#F5F7FA] z-[200] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-white p-6 pb-12 rounded-b-[40px] relative shrink-0 shadow-sm">
        <div className="flex items-center justify-between text-slate-900">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <Icons.ChevronDown className="w-6 h-6 rotate-90" />
            </button>
            <h1 className="text-lg font-bold">Riwayat Kehadiran</h1>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="absolute -bottom-8 left-6 right-6 grid grid-cols-4 gap-2">
          <div className="bg-white p-3 rounded-2xl flex flex-col items-center shadow-sm border border-slate-100">
            <span className="text-xl font-bold text-slate-900">{attendanceData.stats.total}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase">Total</span>
          </div>
          <div className="bg-white p-3 rounded-2xl flex flex-col items-center shadow-sm border border-slate-100">
            <span className="text-xl font-bold text-emerald-500">{attendanceData.stats.hadir}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase">Hadir</span>
          </div>
          <div className="bg-white p-3 rounded-2xl flex flex-col items-center shadow-sm border border-slate-100">
            <span className="text-xl font-bold text-orange-500">{attendanceData.stats.terlambat}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase">Terlambat</span>
          </div>
          <div className="bg-white p-3 rounded-2xl flex flex-col items-center shadow-sm border border-slate-100">
            <span className="text-xl font-bold text-purple-500">{attendanceData.stats.cuti}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase">Cuti</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-12 px-6 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex gap-2 pb-2">
          {['Semua', 'Hadir', 'Terlambat', 'Cuti', 'Tidak Hadir'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t as any)}
              className={`px-6 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                filter === t ? 'bg-[#FFC000] text-black shadow-md' : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto px-6 py-4 pb-24 space-y-3 custom-scrollbar">
        {attendanceData.list.map((rec) => {
          const dateObj = new Date(rec.date);
          const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
          const dayNum = dateObj.getDate();
          const monthName = dateObj.toLocaleDateString('id-ID', { month: 'short' });
          
          const assignment = shiftAssignments.find(a => a.employeeId === employee.id && a.date === rec.date);
          const shift = (shifts || DEFAULT_SHIFTS).find(s => s.id === assignment?.shiftId);
          const isLate = !!(rec.clockIn && shift?.startTime && rec.clockIn > shift.startTime);
          const duration = calculateDuration(rec.clockIn, rec.clockOut);

          return (
            <div key={rec.date} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex flex-col items-center justify-center shrink-0">
                <span className="text-lg font-black text-emerald-600 leading-none">{dayNum}</span>
                <span className="text-[8px] font-bold text-emerald-400 uppercase">{monthName}</span>
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{dayName}</span>
                  {getStatusBadge(rec.status, isLate)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] font-medium text-slate-400">
                  <div className="flex items-center gap-1">
                    <Icons.Clock className="w-3 h-3" />
                    <span>{rec.clockIn || '--:--'}</span>
                  </div>
                  <span>-</span>
                  <div className="flex items-center gap-1">
                    <Icons.Clock className="w-3 h-3" />
                    <span>{rec.clockOut || '--:--'}</span>
                  </div>
                </div>
              </div>
              {duration && (
                <div className="text-right">
                  <p className="text-sm font-black text-[#FFC000]">{duration}</p>
                  <p className="text-[8px] font-bold text-slate-300 uppercase">Jam Kerja</p>
                </div>
              )}
            </div>
          );
        })}
        {attendanceData.list.length === 0 && (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <Icons.Database className="w-12 h-12" />
            <p className="text-xs font-bold uppercase tracking-widest">Tidak ada riwayat</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileAttendanceHistory;
