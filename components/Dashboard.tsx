
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Employee, Submission, Broadcast, ContentPlan, AttendanceRecord, ShiftAssignment, Shift } from '../types';
import { Icons, DEFAULT_SHIFTS } from '../constants';
import { getDaysUntilBirthday, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { supabase } from '../App';

import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';

interface DashboardProps {
  employees: Employee[];
  submissions: Submission[];
  broadcasts: Broadcast[];
  contentPlans: ContentPlan[];
  attendanceRecords: AttendanceRecord[];
  shiftAssignments: ShiftAssignment[];
  userRole: string;
  currentUserEmployee: Employee | null;
  userCompany: string;
  weeklyHolidays?: Record<string, string[]>;
  contentBrandConfigs?: any[];
  shifts: Shift[];
  onNavigate: (tab: any) => void;
  onOpenBroadcast?: () => void;
  onOpenDrive?: () => void;
  onViewProfile?: (emp: Employee) => void;
  onRefreshData?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  employees, 
  submissions, 
  broadcasts, 
  contentPlans, 
  attendanceRecords,
  shiftAssignments,
  userRole, 
  currentUserEmployee, 
  userCompany,
  shifts,
  onNavigate,
  onOpenBroadcast,
  onOpenDrive,
  onViewProfile,
  onRefreshData
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  
  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super' || isOwner;
  const isAdmin = userRole === 'admin' || isSuper;

  const showDrive = useMemo(() => {
    return isSuper && (userCompany.toLowerCase() === 'visibel' || isOwner);
  }, [isSuper, userCompany, isOwner]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadSubmissions = useMemo(() => submissions.filter(s => s.status === 'Pending').length, [submissions]);
  
  const todayRecord = useMemo(() => {
    if (!currentUserEmployee) return null;
    const todayStr = formatDateToYYYYMMDD(new Date());
    return attendanceRecords.find(r => r.employeeId === currentUserEmployee.id && r.date === todayStr);
  }, [attendanceRecords, currentUserEmployee]);

  const todayShift = useMemo(() => {
    if (!currentUserEmployee) return null;
    const todayStr = formatDateToYYYYMMDD(new Date());
    const assignment = (shiftAssignments || []).find(a => a.employeeId === currentUserEmployee.id && a.date === todayStr);
    if (!assignment) return null;
    return (shifts || DEFAULT_SHIFTS).find(s => s.id === assignment.shiftId);
  }, [shiftAssignments, currentUserEmployee, shifts]);

  const isLate = useMemo(() => {
    if (!todayRecord?.clockIn || !todayShift?.startTime) return false;
    return todayRecord.clockIn > todayShift.startTime;
  }, [todayRecord, todayShift]);

  const lateEmployeesInfo = useMemo(() => {
    const todayStr = formatDateToYYYYMMDD(new Date());
    const todayRecords = attendanceRecords.filter(r => r.date === todayStr && r.clockIn);
    
    const lateList: { employee: Employee; record: AttendanceRecord; shift: Shift }[] = [];
    
    todayRecords.forEach(record => {
      const employee = employees.find(e => e.id === record.employeeId);
      const assignment = (shiftAssignments || []).find(a => a.employeeId === record.employeeId && a.date === todayStr);
      if (employee && assignment) {
        const shift = (shifts || DEFAULT_SHIFTS).find(s => s.id === assignment.shiftId);
        if (shift && record.clockIn! > shift.startTime) {
          lateList.push({ employee, record, shift });
        }
      }
    });
    return lateList;
  }, [employees, attendanceRecords, shiftAssignments, shifts]);

  const lateEmployeesCount = lateEmployeesInfo.length;
  
  const genderData = useMemo(() => {
    const male = employees.filter(e => e.gender === 'Laki-laki').length;
    const female = employees.filter(e => e.gender === 'Perempuan').length;
    const total = male + female || 1;
    return [
      { name: 'Laki-laki', value: male, percentage: Math.round((male / total) * 100) },
      { name: 'Perempuan', value: female, percentage: Math.round((female / total) * 100) }
    ];
  }, [employees]);

  const ageData = useMemo(() => {
    const counts = { '< 20': 0, '20-30': 0, '31-40': 0, '41-50': 0, '50+': 0 };
    employees.forEach(e => {
      if (!e.tanggalLahir) return;
      const parts = e.tanggalLahir.split('/');
      if (parts.length !== 3) return;
      const birth = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      const age = new Date().getFullYear() - birth.getFullYear();
      if (age < 20) counts['< 20']++;
      else if (age <= 30) counts['20-30']++;
      else if (age <= 40) counts['31-40']++;
      else if (age <= 50) counts['41-50']++;
      else counts['50+']++;
    });
    const total = employees.length || 1;
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / total) * 100)
    }));
  }, [employees]);

  const averageAge = useMemo(() => {
    const validAges = employees.map(e => {
      if (!e.tanggalLahir) return null;
      const parts = e.tanggalLahir.split('/');
      if (parts.length !== 3) return null;
      const birth = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return new Date().getFullYear() - birth.getFullYear();
    }).filter((age): age is number => age !== null);
    
    if (validAges.length === 0) return 0;
    const sum = validAges.reduce((a, b) => a + b, 0);
    return Math.round(sum / validAges.length);
  }, [employees]);

  const salaryData = useMemo(() => {
    const companySalaries: Record<string, number> = {};
    employees.forEach(e => {
      const config = e.salaryConfig;
      if (!config) return;
      const total = (config.gapok || 0) + 
                    (config.tunjanganMakan || 0) + 
                    (config.tunjanganTransport || 0) + 
                    (config.tunjanganKomunikasi || 0) + 
                    (config.tunjanganKesehatan || 0) + 
                    (config.tunjanganJabatan || 0);
      const key = e.company || 'Unknown';
      companySalaries[key] = (companySalaries[key] || 0) + total;
    });
    return Object.entries(companySalaries).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const tenureYears = useMemo(() => {
    if (!currentUserEmployee?.tanggalMasuk) return 0;
    const parts = currentUserEmployee.tanggalMasuk.split('/');
    if (parts.length !== 3) return 0;
    const join = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    const now = new Date();
    let years = now.getFullYear() - join.getFullYear();
    if (now.getMonth() < join.getMonth() || (now.getMonth() === join.getMonth() && now.getDate() < join.getDate())) years--;
    return Math.max(0, years);
  }, [currentUserEmployee]);

  const saldoCuti = useMemo(() => {
    if (tenureYears < 1 || !currentUserEmployee) return 0;
    const currentYear = new Date().getFullYear();
    const name = currentUserEmployee.nama.toLowerCase();
    let adjustment = 0;
    if (name.includes('fikry aditya rizky')) adjustment = 2;
    else if (name.includes('iskandar juliana')) adjustment = 3;
    else if (name.includes('muhammad ariyansyah')) adjustment = 2;
    else if (name.includes('adinda salsabilla')) adjustment = 3;
    else if (name.includes('pajar sidik')) adjustment = 1;

    const used = attendanceRecords.filter(r => 
      r.employeeId === currentUserEmployee.id && 
      r.status === 'Cuti' && 
      new Date(r.date).getFullYear() === currentYear
    ).length;
    
    return Math.max(0, 12 - used - adjustment);
  }, [tenureYears, currentUserEmployee, attendanceRecords]);

  const handleToggleTracking = async () => {
    if (!currentUserEmployee || isUpdatingTracking) return;
    setIsUpdatingTracking(true);
    const newVal = !currentUserEmployee.isTrackingActive;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ isTrackingActive: newVal })
        .eq('id', currentUserEmployee.id);
      
      if (error) throw error;
      if (onRefreshData) onRefreshData();
      alert(`Live Tracking ${newVal ? 'DIAKTIFKAN' : 'DIMATIKAN'}. Pastikan aplikasi tetap terbuka.`);
    } catch (e: any) {
      alert("Gagal update tracking: " + e.message);
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  const menuItems = useMemo(() => {
    const base = [
      { id: 'absen', label: 'Absensi', icon: <Icons.Camera className="w-5 h-5" />, tab: 'absen' },
      { id: 'attendance', label: 'Rekap Absen', icon: <Icons.FileText className="w-5 h-5" />, tab: 'attendance' },
      { id: 'submissions', label: 'Pengajuan', icon: <Icons.Calendar className="w-5 h-5" />, tab: 'submissions' },
      { id: 'schedule', label: 'Live Stream', icon: <Icons.Video className="w-5 h-5" />, tab: 'schedule' },
      { id: 'shift', label: 'Jadwal Shift', icon: <Icons.Clock className="w-5 h-5" />, tab: 'shift' },
      { id: 'content', label: 'Short Video', icon: <Icons.Image className="w-5 h-5" />, tab: 'content' },
      { id: 'minvis', label: 'MinVis AI', icon: <Icons.Cpu className="w-5 h-5" />, tab: 'minvis' },
      { id: 'database', label: 'Database', icon: <Icons.Users className="w-5 h-5" />, tab: 'database' },
    ];

    if (isSuper) {
      base.push({ id: 'kpi', label: 'KPI Performance', icon: <Icons.Sparkles className="w-5 h-5" />, tab: 'kpi' });
      base.push({ id: 'live_map', label: 'Live Map', icon: <Icons.MapPin className="w-5 h-5" />, tab: 'live_map' });
    }

    return base;
  }, [isSuper]);

  return (
    <div className="space-y-5 md:space-y-10 pb-4 md:pb-20">
      
      <div className="md:hidden space-y-5 animate-in fade-in duration-500">
        
        <div 
          onClick={() => currentUserEmployee && onViewProfile && onViewProfile(currentUserEmployee)}
          className="flex items-center gap-3 px-2 cursor-pointer group active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-100 shrink-0 group-hover:border-amber-400 transition-colors">
            {currentUserEmployee?.photoBase64 ? (
              <img src={currentUserEmployee.photoBase64} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Icons.Users className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-base font-black text-slate-900 leading-tight uppercase truncate group-hover:text-amber-500 transition-colors">
              {currentUserEmployee?.nama || 'User'}
            </h2>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
              {currentUserEmployee?.jabatan || 'Staff'}
            </p>
          </div>
        </div>

        {/* LIVE TRACKER TOGGLE (Hanya Mobile) */}
        <div className="px-2">
          <div className={`rounded-[24px] p-5 border shadow-sm transition-all flex items-center justify-between ${currentUserEmployee?.isTrackingActive ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
             <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentUserEmployee?.isTrackingActive ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                   <Icons.MapPin className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-900 uppercase">Live Location Tracking</p>
                   <p className={`text-[8px] font-bold uppercase tracking-widest ${currentUserEmployee?.isTrackingActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                     {currentUserEmployee?.isTrackingActive ? 'GPS AKTIF & TERPANTAU' : 'GPS TIDAK AKTIF'}
                   </p>
                </div>
             </div>
             <button 
              onClick={handleToggleTracking}
              disabled={isUpdatingTracking}
              className={`w-14 h-8 rounded-full relative transition-all duration-300 ${currentUserEmployee?.isTrackingActive ? 'bg-emerald-600' : 'bg-slate-300'}`}
             >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${currentUserEmployee?.isTrackingActive ? 'left-7' : 'left-1'}`}></div>
             </button>
          </div>
        </div>

        <div className="px-2">
          <div className="bg-white rounded-[28px] overflow-hidden shadow-lg shadow-slate-200/50 border border-slate-100 relative group">
            <div className="bg-[#0f172a] px-5 py-4 flex justify-center items-center">
              <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
              </span>
            </div>
            
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="text-center">
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">
                  {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}<span className="text-sm opacity-40 ml-1">{currentTime.toLocaleTimeString('en-GB', { second: '2-digit' })}</span>
                </h1>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Current System Time</p>
              </div>

              <div className="w-full flex flex-col items-center gap-2">
                <div className="bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 flex items-center gap-2">
                  <Icons.Clock className="w-3 h-3 text-indigo-500" />
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap">
                    Jadwal Shift: {todayShift ? `${todayShift.name.toUpperCase()} (${todayShift.startTime} - ${todayShift.endTime})` : 'TIDAK ADA SHIFT'}
                  </span>
                </div>
                {isLate && (
                  <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg border border-rose-100 animate-pulse flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">TERLAMBAT</span>
                  </div>
                )}
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-[20px] border border-slate-100 flex flex-col items-center gap-0.5">
                   <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Clock In</span>
                   <p className={`text-base font-black ${isLate ? 'text-rose-600' : 'text-slate-800'}`}>{todayRecord?.clockIn || '--:--'}</p>
                   {todayRecord?.clockIn && <div className={`mt-0.5 w-1 h-1 ${isLate ? 'bg-rose-500' : 'bg-emerald-500'} rounded-full`}></div>}
                </div>
                <div className="bg-slate-50 p-3.5 rounded-[20px] border border-slate-100 flex flex-col items-center gap-0.5">
                   <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Clock Out</span>
                   <p className="text-base font-black text-slate-800">{todayRecord?.clockOut || '--:--'}</p>
                   {todayRecord?.clockOut && <div className="mt-0.5 w-1 h-1 bg-indigo-500 rounded-full"></div>}
                </div>
              </div>

              <button 
                onClick={() => onNavigate('absen')}
                className="w-full bg-[#FFC000] hover:bg-black hover:text-[#FFC000] text-black py-4 rounded-[18px] font-black text-[10px] uppercase tracking-[0.3em] shadow-md shadow-amber-100 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Icons.Camera className="w-3.5 h-3.5" />
                {todayRecord?.clockIn ? (todayRecord.clockOut ? 'LOG TUNTAS' : 'CLOCK OUT') : 'CLOCK IN'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-2">
          <div className="bg-slate-50/50 p-3.5 rounded-[24px] border border-slate-100 flex items-center gap-3">
            <div className="text-[#FFC000] shrink-0">
              <Icons.Calendar className="w-4 h-4" />
            </div>
            <div className="flex-grow">
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-black text-slate-900 leading-none">{saldoCuti}</p>
                <div className="h-1 flex-grow bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-[#FFC000]" style={{ width: `${(saldoCuti/12)*100}%` }}></div>
                </div>
              </div>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Saldo Cuti</p>
            </div>
          </div>
          <div className="bg-slate-50/50 p-3.5 rounded-[24px] border border-slate-100 flex items-center gap-3">
            <div className="text-indigo-400 shrink-0">
              <Icons.FileText className="w-4 h-4" />
            </div>
            <div className="flex-grow">
               <div className="flex items-baseline gap-2">
                <p className="text-lg font-black text-slate-900 leading-none">{unreadSubmissions}</p>
                <div className="h-1 flex-grow bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-400" style={{ width: '30%' }}></div>
                </div>
              </div>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Pengajuan</p>
            </div>
          </div>
        </div>

        <div className="px-2">
          <div className="bg-slate-900 rounded-[28px] p-5 text-white relative overflow-hidden shadow-lg border border-white/5">
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="bg-[#FFC000] p-1.5 rounded-lg text-black">
                  <Icons.Bell className="w-4 h-4" />
                </div>
                <h3 className="text-[10px] font-black tracking-[0.2em] uppercase text-[#FFC000]">ATTENTION</h3>
              </div>
              
              <div className="h-px bg-white/10 w-full"></div>

              {(isAdmin && unreadSubmissions > 0) ? (
                <button 
                  onClick={() => onNavigate('inbox')}
                  className="w-full text-left space-y-1.5 animate-in fade-in slide-in-from-bottom-2"
                >
                  <p className="text-[13px] font-black leading-tight text-white uppercase tracking-tight">
                    ADA {unreadSubmissions} PENGAJUAN BARU MENUNGGU PERSETUJUAN.
                  </p>
                  <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <span>PROSES SEKARANG</span>
                    <Icons.ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                  </div>
                </button>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-[13px] font-black leading-tight text-white uppercase tracking-tight">
                    BELUM ADA NOTIFIKASI MENDESAK SAAT INI.
                  </p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">SISTEM BERJALAN OPTIMAL</p>
                </div>
              )}
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5">
               <Icons.Megaphone className="w-24 h-24 text-white" />
            </div>
          </div>
        </div>

        {/* Mobile Charts Section */}
        {isSuper && (
          <div className="px-2 space-y-4">
            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6">Analisis Karyawan</h3>
              
              <div className="space-y-8">
                {/* Gender Chart */}
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                  <div className="h-40 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#FFC000" />
                          <Cell fill="#0f172a" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6">
                    {genderData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-[#FFC000]' : 'bg-slate-900'}`}></div>
                        <span className="text-[8px] font-bold text-slate-600 uppercase">{entry.name} ({entry.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Age Chart */}
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Average Age: {averageAge} Years</p>
                  <div className="h-40 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                      <BarChart data={ageData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 'bold'}} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="value" fill="#FFC000" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Salary Chart */}
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Salary</p>
                  <div className="h-40 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                      <BarChart data={salaryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 8, fontWeight: 'bold', fill: '#94a3b8'}}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))}
                        />
                        <Bar dataKey="value" fill="#0f172a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 px-2 pb-2">
          <div className="flex justify-between items-center px-2">
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Menu Utama</h4>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-5">
            {menuItems.filter(i => !['absen', 'shift', 'database', 'kpi', 'settings', 'live_map'].includes(i.tab)).map((item) => (
              <button 
                key={item.id} 
                onClick={() => onNavigate(item.tab)}
                className="flex flex-col items-center gap-2 transition-all active:scale-90 group"
              >
                <div className="w-[62px] h-[62px] bg-slate-50 border border-slate-100 rounded-[20px] flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-[#FFC000] transition-all shadow-sm">
                  {item.icon}
                </div>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter text-center leading-tight">
                  {item.label}
                </span>
              </button>
            ))}
            <button 
              onClick={() => onNavigate('calendar')}
              className="flex flex-col items-center gap-2 active:scale-90 group"
            >
              <div className="w-[62px] h-[62px] bg-[#0ea5e9] rounded-[20px] flex items-center justify-center text-white shadow-md shadow-sky-100 group-hover:bg-slate-900 group-hover:text-[#FFC000] transition-all">
                <Icons.Calendar className="w-5 h-5" />
              </div>
              <span className="text-[7px] font-black text-slate-900 uppercase tracking-tighter text-center leading-tight">
                CALENDAR
              </span>
            </button>
            <button 
              onClick={onOpenBroadcast}
              className="flex flex-col items-center gap-2 active:scale-90 group"
            >
              <div className="w-[62px] h-[62px] bg-[#FFC000] rounded-[20px] flex items-center justify-center text-black shadow-md shadow-amber-100 group-hover:bg-black group-hover:text-[#FFC000] transition-all">
                <Icons.Megaphone className="w-5 h-5" />
              </div>
              <span className="text-[7px] font-black text-slate-900 uppercase tracking-tighter text-center leading-tight">
                BROADCAST
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden md:block space-y-10">
        <div className="flex justify-between items-center bg-white px-8 py-8 rounded-[40px] sm:rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
           <div className="flex flex-col gap-1 relative z-10">
              <h1 className="text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
                WORKSPACE: {isOwner ? 'GLOBAL ACCESS' : userCompany.toUpperCase()}
              </h1>
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Sistem Manajemen Terpadu</p>
           </div>
           <div className="flex items-center gap-4 relative z-10">
              <div className="text-right">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">USER ACCESS</p>
                 <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{userRole}</p>
              </div>
              <div 
                onClick={() => currentUserEmployee && onViewProfile && onViewProfile(currentUserEmployee)}
                className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[20px] flex items-center justify-center text-slate-300 shadow-sm cursor-pointer hover:border-amber-400 transition-colors active:scale-90"
              >
                 <Icons.Users className="w-6 h-6" />
              </div>
           </div>
           <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
        </div>

        <div className="space-y-4">
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight ml-2">DATA KARYAWAN</h2>
           {isSuper && (
             <div className="grid grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                   <Icons.Users className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 whitespace-nowrap">Total Karyawan</p>
                   <p className="text-3xl font-black text-slate-900 leading-none">{employees.length}</p>
                 </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-inner">
                   <Icons.Users className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 whitespace-nowrap">Karyawan Baru</p>
                   <p className="text-3xl font-black text-slate-900 leading-none">{employees.filter(e => {
                     if (!e.tanggalMasuk) return false;
                     const parts = e.tanggalMasuk.split('/');
                     const joinDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                     const thirtyDaysAgo = new Date();
                     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                     return joinDate > thirtyDaysAgo;
                   }).length}</p>
                 </div>
               </div>
               <button 
                 onClick={() => setIsLateModalOpen(true)}
                 className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6 text-left hover:border-rose-300 transition-all active:scale-95 group"
               >
                 <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner group-hover:bg-rose-100 transition-colors">
                   <Icons.AlertCircle className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 whitespace-nowrap">Karyawan Telat</p>
                   <p className="text-3xl font-black text-rose-600 leading-none">{lateEmployeesCount}</p>
                 </div>
               </button>
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-sky-100 flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 shadow-inner">
                   <Icons.Cake className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 whitespace-nowrap">Ulang Tahun</p>
                   <p className="text-3xl font-black text-slate-900 leading-none">{employees.filter(emp => getDaysUntilBirthday(emp.tanggalLahir) <= 7).length}</p>
                 </div>
               </div>
             </div>
           )}
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-${showDrive ? '3' : '2'} gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
           {showDrive && (
             <button 
               onClick={onOpenDrive}
               className="bg-[#0f172a] text-white py-6 px-8 rounded-[42px] border border-white/5 shadow-2xl flex items-center gap-6 group hover:bg-black transition-all active:scale-95"
             >
                <div className="w-14 h-14 bg-white/5 rounded-[22px] flex items-center justify-center shrink-0 shadow-inner">
                   <img src="https://lh3.googleusercontent.com/d/1LmoGYgq9y5JQPWAf9eEHXMiK-8jBaoSr" className="w-7 h-7 object-contain" alt="Google Drive" />
                </div>
                <p className="text-xl font-black uppercase tracking-tight">GOOGLE DRIVE</p>
             </button>
           )}

           <button 
             onClick={() => onNavigate('calendar')}
             className="bg-[#111827] text-white py-6 px-8 rounded-[42px] border border-white/5 shadow-2xl flex items-center gap-6 group hover:bg-black transition-all active:scale-95"
           >
              <div className="w-14 h-14 bg-white/5 rounded-[22px] flex items-center justify-center shrink-0 shadow-inner">
                 <Icons.Calendar className="w-7 h-7 text-[#FFC000]" />
              </div>
              <p className="text-xl font-black uppercase tracking-tight">CALENDAR</p>
           </button>

           <button 
             onClick={onOpenBroadcast}
             className="bg-[#FFC000] text-black py-6 px-8 rounded-[42px] shadow-[0_15px_40px_rgba(255,192,0,0.3)] flex items-center gap-6 group hover:bg-amber-400 transition-all active:scale-95 relative overflow-hidden"
           >
              <div className="w-14 h-14 bg-black/5 rounded-[22px] flex items-center justify-center shrink-0 shadow-inner relative z-10">
                 <Icons.Megaphone className="w-7 h-7" />
              </div>
              <p className="text-xl font-black uppercase tracking-tight relative z-10">BROADCAST</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
           </button>
        </div>

        <div className="w-full bg-[#0f172a] rounded-[48px] p-0.5 shadow-2xl overflow-hidden border border-white/5">
          <div className="p-10 text-white relative">
            <div className="flex flex-row items-center justify-between gap-4 mb-10">
              <div className="flex items-center gap-6">
                <div className="bg-[#FFC000] p-4 rounded-[28px] text-black shadow-[0_0_30px_rgba(255,192,0,0.15)] transform rotate-2">
                  <Icons.Bell className="w-10 h-10" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-black text-5xl tracking-tighter uppercase leading-none text-white">
                    ATTENTION
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="h-[2px] w-6 bg-[#FFC000]"></div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.5em] whitespace-nowrap">NOTIFICATIONS HUB - {isOwner ? 'GLOBAL' : userCompany.toUpperCase()}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-6 py-3 bg-white/5 border border-white/10 rounded-[22px] backdrop-blur-md">
                <div className="w-1.5 h-1.5 bg-[#FFC000] rounded-full animate-pulse shadow-[0_0_8px_#FFC000]"></div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">ACTIVE SESSION</span>
              </div>
            </div>

            <div className="space-y-4 max-w-4xl">
              {(isAdmin && unreadSubmissions > 0) ? (
                <button 
                  onClick={() => onNavigate('inbox')}
                  className="w-full text-left bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[36px] p-8 flex items-center gap-8 group hover:bg-white/10 transition-all duration-500 cursor-pointer active:scale-[0.99]"
                >
                  <div className="text-amber-400 p-4 rounded-[24px] bg-white/5 transition-transform group-hover:scale-110 shadow-lg shrink-0">
                    <Icons.FileText className="w-7 h-7" />
                  </div>
                  <div className="flex-grow">
                    <p className="text-xl font-black leading-snug text-slate-50 uppercase tracking-tight">
                      ADA {unreadSubmissions} PENGAJUAN BARU YANG MENUNGGU PERSETUJUAN.
                    </p>
                  </div>
                </button>
              ) : (
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[36px] p-8 flex items-center gap-8">
                  <div className="text-slate-400 p-4 rounded-[24px] bg-white/5 shrink-0">
                    <Icons.Sparkles className="text-slate-400 w-7 h-7" />
                  </div>
                  <p className="text-xl font-black text-slate-400 uppercase tracking-tight">
                    BELUM ADA NOTIFIKASI MENDESAK SAAT INI.
                  </p>
                </div>
              )}
            </div>
            
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#FFC000]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-40"></div>
          </div>
        </div>

        {/* Desktop Charts Section */}
        {isSuper && (
          <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Gender Distribution */}
            <div className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                  <Icons.Users className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Gender</h3>
              </div>
              <div className="flex-grow h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      <Cell fill="#FFC000" />
                      <Cell fill="#0f172a" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-8 mt-4">
                {genderData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-[#FFC000]' : 'bg-slate-900'}`}></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-900 uppercase">{entry.name}</span>
                      <span className="text-[10px] font-bold text-slate-400">{entry.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Age Distribution */}
            <div className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                  <Icons.Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Average Age: {averageAge} Years</h3>
              </div>
              <div className="flex-grow h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                  <BarChart data={ageData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} 
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="value" fill="#FFC000" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribution across age ranges</p>
              </div>
            </div>

            {/* Salary Distribution */}
            <div className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
                  <Icons.DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Total Salary (Company)</h3>
              </div>
              <div className="flex-grow h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                  <BarChart data={salaryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                      width={80}
                    />
                    <Tooltip 
                      formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="value" fill="#0f172a" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total monthly payroll by company</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLateModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[85vh]">
            <div className="p-8 border-b bg-[#f43f5e] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                 <div className="bg-white/20 p-3 rounded-2xl">
                    <Icons.AlertCircle className="w-6 h-6 text-white" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Karyawan Telat Hari Ini</h2>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{currentTime.toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
                 </div>
              </div>
              <button onClick={() => setIsLateModalOpen(false)} className="text-4xl leading-none font-black opacity-40 hover:opacity-100">&times;</button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-6 sm:p-8 space-y-4 custom-scrollbar bg-slate-50/50">
               {lateEmployeesInfo.length > 0 ? (
                 lateEmployeesInfo.map((item, idx) => (
                   <div key={idx} className="bg-white p-5 rounded-[28px] border border-slate-100 flex items-center justify-between shadow-sm group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-100">
                            {item.employee.photoBase64 ? (
                              <img src={item.employee.photoBase64} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Icons.Users className="w-6 h-6 text-slate-300" />
                            )}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[13px] font-black text-slate-900 uppercase truncate leading-tight">{item.employee.nama}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate mt-1">{item.employee.jabatan}</p>
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         <div className="bg-rose-50 px-4 py-1.5 rounded-xl border border-rose-100 flex flex-col items-center">
                            <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">CLOCK IN</span>
                            <span className="text-xs font-black text-rose-600">{item.record.clockIn}</span>
                         </div>
                         <p className="text-[7px] font-bold text-slate-300 uppercase tracking-widest mt-1.5">SHIFT: {item.shift.startTime}</p>
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="py-20 text-center flex flex-col items-center gap-6 opacity-30">
                    <Icons.Check className="w-16 h-16 text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Tidak Ada Karyawan Terlambat</p>
                 </div>
               )}
            </div>
            
            <div className="p-8 border-t bg-white shrink-0">
               <button 
                 onClick={() => setIsLateModalOpen(false)}
                 className="w-full bg-[#0f172a] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
               >
                 Tutup Dashboard
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
