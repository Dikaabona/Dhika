
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Employee, Submission, Broadcast, ContentPlan } from '../types';
import { Icons } from '../constants';
import { getDaysUntilBirthday } from '../utils/dateUtils';

interface DashboardProps {
  employees: Employee[];
  submissions: Submission[];
  broadcasts: Broadcast[];
  contentPlans: ContentPlan[];
  userRole: string;
  currentUserEmployee: Employee | null;
  userCompany: string;
  weeklyHolidays?: Record<string, string[]>;
  contentBrandConfigs?: any[];
  onNavigate: (tab: any) => void;
  onOpenBroadcast?: () => void;
  onOpenDrive?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  employees, 
  submissions, 
  broadcasts, 
  contentPlans, 
  userRole, 
  currentUserEmployee, 
  userCompany,
  onNavigate,
  onOpenBroadcast,
  onOpenDrive
}) => {
  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super' || isOwner;
  const isAdmin = userRole === 'admin' || isSuper;

  // Stats Data
  const unreadSubmissions = useMemo(() => submissions.filter(s => s.status === 'Pending').length, [submissions]);
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

  const saldoCuti = tenureYears >= 1 ? 12 : 0;

  // Icons for Grid Menu - Optimized for Mobile Screenshot Reference
  const menuItems = useMemo(() => {
    const base = [
      { id: 'absen', label: 'Absensi', icon: <Icons.Camera className="w-6 h-6" />, tab: 'absen' },
      { id: 'attendance', label: 'Rekap Absen', icon: <Icons.FileText className="w-6 h-6" />, tab: 'attendance' },
      { id: 'submissions', label: 'Pengajuan', icon: <Icons.Calendar className="w-6 h-6" />, tab: 'submissions' },
      { id: 'schedule', label: 'Live Stream', icon: <Icons.Video className="w-6 h-6" />, tab: 'schedule' },
      { id: 'shift', label: 'Jadwal Shift', icon: <Icons.Clock className="w-6 h-6" />, tab: 'shift' },
      { id: 'content', label: 'Short Video', icon: <Icons.Image className="w-6 h-6" />, tab: 'content' },
      { id: 'minvis', label: 'MinVis AI', icon: <Icons.Cpu className="w-6 h-6" />, tab: 'minvis' },
      { id: 'database', label: 'Database', icon: <Icons.Users className="w-6 h-6" />, tab: 'database' },
    ];

    if (isSuper) {
      base.push({ id: 'kpi', label: 'KPI Performance', icon: <Icons.Sparkles className="w-6 h-6" />, tab: 'kpi' });
      base.push({ id: 'settings', label: 'Pengaturan', icon: <Icons.Settings className="w-6 h-6" />, tab: 'settings' });
    }

    return base;
  }, [isSuper]);

  return (
    <div className="space-y-6 md:space-y-10 pb-20">
      
      {/* --- MOBILE VIEW (Hidden on Desktop) --- */}
      <div className="md:hidden space-y-8 animate-in fade-in duration-500">
        
        {/* User Profile Header */}
        <div className="flex items-center gap-4 px-2">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-100 shrink-0">
            {currentUserEmployee?.photoBase64 ? (
              <img src={currentUserEmployee.photoBase64} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Icons.Users className="w-7 h-7" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-lg font-black text-slate-900 leading-tight uppercase truncate">
              {currentUserEmployee?.nama || 'User'}
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {currentUserEmployee?.jabatan || 'Staff'}
            </p>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 gap-3 px-2">
          <div className="bg-slate-50/50 p-4 rounded-[28px] border border-slate-100 flex items-center gap-4">
            <div className="text-[#FFC000] shrink-0">
              <Icons.Calendar className="w-5 h-5" />
            </div>
            <div className="flex-grow">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-slate-900 leading-none">{saldoCuti}</p>
                <div className="h-1 flex-grow bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-[#FFC000]" style={{ width: `${(saldoCuti/12)*100}%` }}></div>
                </div>
              </div>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Saldo Cuti</p>
            </div>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-[28px] border border-slate-100 flex items-center gap-4">
            <div className="text-indigo-400 shrink-0">
              <Icons.FileText className="w-5 h-5" />
            </div>
            <div className="flex-grow">
               <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-slate-900 leading-none">{unreadSubmissions}</p>
                <div className="h-1 flex-grow bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-400" style={{ width: '30%' }}></div>
                </div>
              </div>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Pengajuan</p>
            </div>
          </div>
        </div>

        {/* DYNAMIC ATTENTION HUB */}
        <div className="px-2">
          <div className="bg-slate-900 rounded-[32px] p-6 text-white relative overflow-hidden shadow-xl border border-white/5">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#FFC000] p-2 rounded-xl text-black">
                  <Icons.Bell className="w-5 h-5" />
                </div>
                <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-[#FFC000]">ATTENTION</h3>
              </div>
              
              <div className="h-px bg-white/10 w-full"></div>

              {(isAdmin && unreadSubmissions > 0) ? (
                <button 
                  onClick={() => onNavigate('inbox')}
                  className="w-full text-left space-y-2 animate-in fade-in slide-in-from-bottom-2"
                >
                  <p className="text-[14px] font-black leading-tight text-white uppercase tracking-tight">
                    ADA {unreadSubmissions} PENGAJUAN BARU YANG MENUNGGU PERSETUJUAN.
                  </p>
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>PROSES SEKARANG</span>
                    <Icons.ChevronDown className="w-3 h-3 -rotate-90" />
                  </div>
                </button>
              ) : (
                <div className="space-y-1">
                  <p className="text-[14px] font-black leading-tight text-white uppercase tracking-tight">
                    BELUM ADA NOTIFIKASI MENDESAK SAAT INI.
                  </p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">SISTEM BERJALAN OPTIMAL</p>
                </div>
              )}
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-10">
               <Icons.Megaphone className="w-32 h-32 text-white" />
            </div>
          </div>
        </div>

        {/* Menu Grid Utama */}
        <div className="space-y-4 px-2">
          <div className="flex justify-between items-center px-2">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Menu Utama</h4>
            {isSuper && (
              <button onClick={() => onNavigate('settings')} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">UBAH</button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-6">
            {menuItems.map((item) => (
              <button 
                key={item.id} 
                onClick={() => onNavigate(item.tab)}
                className="flex flex-col items-center gap-2.5 transition-all active:scale-90 group"
              >
                <div className="w-[68px] h-[68px] bg-slate-50 border border-slate-100 rounded-[22px] flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-[#FFC000] transition-all shadow-sm">
                  {item.icon}
                </div>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter text-center leading-tight">
                  {item.label}
                </span>
              </button>
            ))}
            <button 
              onClick={onOpenBroadcast}
              className="flex flex-col items-center gap-2.5 active:scale-90 group"
            >
              <div className="w-[68px] h-[68px] bg-[#FFC000] rounded-[22px] flex items-center justify-center text-black shadow-md shadow-amber-100 group-hover:bg-black group-hover:text-[#FFC000] transition-all">
                <Icons.Megaphone className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-black text-slate-900 uppercase tracking-tighter text-center leading-tight">
                BROADCAST
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* --- DESKTOP VIEW (Hidden on Mobile) --- */}
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
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[20px] flex items-center justify-center text-slate-300 shadow-sm">
                 <Icons.Users className="w-6 h-6" />
              </div>
           </div>
           <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
        </div>

        <div className="space-y-4">
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight ml-2">DATA KARYAWAN</h2>
           {isSuper && (
             <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                   <Icons.Users className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Karyawan</p>
                   <p className="text-3xl font-black text-slate-900 leading-none">{employees.length}</p>
                 </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-inner">
                   <Icons.Users className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Karyawan Baru</p>
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
               <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
                   <Icons.Cake className="w-7 h-7" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Ulang Tahun</p>
                   <p className="text-3xl font-black text-slate-900 leading-none">{employees.filter(emp => getDaysUntilBirthday(emp.tanggalLahir) <= 7).length}</p>
                 </div>
               </div>
             </div>
           )}
        </div>

        {/* Action Row for Desktop - Updated with Custom Gdrive Icon & Text */}
        <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
           <button 
             onClick={onOpenDrive}
             className="flex-1 bg-[#0f172a] text-white p-6 rounded-[36px] border border-white/5 shadow-2xl flex items-center justify-center gap-6 group hover:bg-black transition-all active:scale-95"
           >
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                 <img src="https://lh3.googleusercontent.com/d/1LmoGYgq9y5JQPWAf9eEHXMiK-8jBaoSr" className="w-7 h-7 object-contain" alt="Google Drive" />
              </div>
              <p className="text-xl font-black uppercase tracking-tight">Google Drive</p>
           </button>

           <button 
             onClick={onOpenBroadcast}
             className="flex-1 bg-[#FFC000] text-black p-6 rounded-[36px] shadow-xl shadow-amber-100 flex items-center justify-center gap-6 group hover:bg-black hover:text-[#FFC000] transition-all active:scale-95"
           >
              <div className="w-12 h-12 bg-black/5 group-hover:bg-[#FFC000]/10 rounded-xl flex items-center justify-center shrink-0">
                 <Icons.Megaphone className="w-7 h-7" />
              </div>
              <p className="text-xl font-black uppercase tracking-tight">Broadcast</p>
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
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Active Session</span>
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
                    <Icons.Sparkles className="w-7 h-7" />
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
      </div>

    </div>
  );
};

export default Dashboard;
