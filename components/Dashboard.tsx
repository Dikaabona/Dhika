
import React, { useMemo } from 'react';
import { Employee, Submission, Broadcast } from '../types';
import { Icons } from '../constants';
import { getDaysUntilBirthday } from '../utils/dateUtils';

interface DashboardProps {
  employees: Employee[];
  submissions: Submission[];
  broadcasts: Broadcast[];
  userRole: string;
  currentUserEmployee: Employee | null;
  weeklyHolidays?: Record<string, string[]>;
}

const Dashboard: React.FC<DashboardProps> = ({ employees, submissions, broadcasts, userRole, currentUserEmployee, weeklyHolidays }) => {
  const isSuper = userRole === 'super';
  const isAdmin = userRole === 'admin' || isSuper;

  const upcomingBirthdays = useMemo(() => {
    return employees
      .map(emp => ({
        ...emp,
        daysUntil: getDaysUntilBirthday(emp.tanggalLahir)
      }))
      .filter(emp => emp.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  const attentionItems = useMemo(() => {
    const items: { text: string; icon: React.ReactNode; color: string }[] = [];
    
    if (isAdmin) {
      const pending = submissions.filter(s => s.status === 'Pending').length;
      if (pending > 0) {
        items.push({ 
          text: `Ada ${pending} pengajuan baru yang menunggu persetujuan.`, 
          icon: <Icons.FileText className="w-5 h-5" />, 
          color: 'text-amber-400' 
        });
      }
      
      if (upcomingBirthdays.length > 0) {
        const today = upcomingBirthdays.filter(b => b.daysUntil === 0);
        if (today.length > 0) {
          items.push({ 
            text: `${today.length} Karyawan berulang tahun hari ini!`, 
            icon: <Icons.Cake className="w-5 h-5" />, 
            color: 'text-rose-400' 
          });
        }
      }
    }

    if (userRole === 'employee' && currentUserEmployee) {
      const daysToBday = getDaysUntilBirthday(currentUserEmployee.tanggalLahir);
      if (daysToBday === 0) {
        items.push({ 
          text: `Selamat Ulang Tahun, ${currentUserEmployee.nama.split(' ')[0]}!`, 
          icon: <Icons.Sparkles className="w-5 h-5" />, 
          color: 'text-[#FFC000]' 
        });
      }

      // Fitur Deteksi Libur Mingguan Host
      if (currentUserEmployee.jabatan.toLowerCase().includes('host') && weeklyHolidays) {
        const myName = currentUserEmployee.nama.toUpperCase();
        // Added type assertion to names to fix TypeScript error: Property 'map' does not exist on type 'unknown'
        const myOffDays = Object.entries(weeklyHolidays)
          .filter(([day, names]) => (names as string[]).map(n => n.toUpperCase()).includes(myName))
          .map(([day]) => day);

        if (myOffDays.length > 0) {
          items.push({
            text: `Jadwal libur mingguan Anda: ${myOffDays.join(', ')}.`,
            icon: <Icons.Calendar className="w-5 h-5" />,
            color: 'text-emerald-400'
          });
        }
      }

      const myBroadcasts = broadcasts.filter(b => b.targetEmployeeIds.includes(currentUserEmployee.id));
      if (myBroadcasts.length > 0) {
        items.push({ 
          text: `Ada ${myBroadcasts.length} pengumuman baru untuk Anda.`, 
          icon: <Icons.Megaphone className="w-5 h-5" />, 
          color: 'text-cyan-400' 
        });
      }
    }

    if (items.length === 0) {
      items.push({ 
        text: "Sistem normal. Tidak ada tugas mendesak.", 
        icon: <Icons.Sparkles className="w-5 h-5" />, 
        color: 'text-slate-400' 
      });
    }

    return items;
  }, [submissions, upcomingBirthdays, userRole, currentUserEmployee, broadcasts, isAdmin, weeklyHolidays]);

  const stats = [
    { label: 'Total Karyawan', value: employees.length, color: '[#FFC000]' },
    { label: 'Karyawan Baru', value: employees.filter(e => {
        const joinDate = new Date(e.tanggalMasuk);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return joinDate > thirtyDaysAgo;
      }).length, color: 'emerald' 
    },
    { label: 'Ulang Tahun', value: upcomingBirthdays.length, color: 'rose' }
  ];

  return (
    <div className="mb-6 md:mb-8 space-y-4 md:space-y-6">
      {isSuper && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 transition-transform hover:scale-[1.02]">
              <div className={`p-2.5 md:p-4 rounded-lg md:rounded-xl bg-slate-50 text-${stat.color === '[#FFC000]' ? '[#FFC000]' : stat.color + '-600'} border border-slate-100`}>
                {stat.label.includes('Ulang Tahun') ? <Icons.Cake className="w-4 h-4 md:w-6 md:h-6" /> : <Icons.Users className="w-4 h-4 md:w-6 md:h-6" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">{stat.label}</p>
                <p className="text-xl md:text-3xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REFINED ATTENTION MODULE - Mobile Optimized */}
      <div className="w-full bg-[#0f172a] rounded-[32px] md:rounded-[48px] p-0.5 md:p-1 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-white/5">
        <div className="p-6 md:p-12 text-white relative">
          <div className="flex flex-row items-center justify-between gap-4 mb-6 md:mb-12">
            <div className="flex items-center gap-3 md:gap-5">
              <div className="bg-[#FFC000] p-2.5 md:p-4 rounded-xl md:rounded-2xl text-black shadow-[0_0_20px_rgba(255,192,0,0.3)] transform rotate-2">
                <Icons.Bell className="w-5 h-5 md:w-8 md:h-8" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-black text-xl md:text-5xl tracking-[-0.04em] uppercase leading-none text-white">
                  ATTENTION
                </h3>
                <div className="hidden md:flex items-center gap-3 mt-2">
                  <div className="h-[2px] w-6 bg-[#FFC000]"></div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] whitespace-nowrap">Notifications Hub</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-3 bg-white/5 border border-white/10 rounded-full md:rounded-2xl backdrop-blur-md">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#FFC000] rounded-full animate-pulse"></div>
              <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-slate-300">Live</span>
            </div>
          </div>

          <div className="space-y-2 md:space-y-4">
            {attentionItems.map((item, idx) => (
              <div key={idx} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-[32px] p-4 md:p-8 flex items-center gap-3 md:gap-6 group hover:bg-white/10 transition-all duration-500">
                <div className={`${item.color} p-2 md:p-3 rounded-xl bg-white/5 transition-transform group-hover:scale-110 shadow-lg shrink-0`}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { className: 'w-4 h-4 md:w-6 md:h-6' })}
                </div>
                <p className="text-xs md:text-lg font-medium leading-tight md:leading-relaxed text-slate-100">
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          {/* Abstract Decorations - Hidden on small mobile to improve performance */}
          <div className="hidden md:block absolute top-0 right-0 w-[400px] h-[400px] bg-[#FFC000]/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-50"></div>
          <div className="hidden md:block absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none opacity-40"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
