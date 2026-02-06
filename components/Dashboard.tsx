
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

const ALARM_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const Dashboard: React.FC<DashboardProps> = ({ 
  employees, 
  submissions, 
  broadcasts, 
  contentPlans, 
  userRole, 
  currentUserEmployee, 
  userCompany,
  weeklyHolidays, 
  contentBrandConfigs = [], 
  onNavigate,
  onOpenBroadcast,
  onOpenDrive
}) => {
  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super' || isOwner;
  const isAdmin = userRole === 'admin' || isSuper;
  const [playedAlarms, setPlayedAlarms] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isCreator = useMemo(() => {
    const jabatan = (currentUserEmployee?.jabatan || '').toLowerCase();
    return jabatan.includes('content creator') || jabatan.includes('creator') || jabatan.includes('lead content');
  }, [currentUserEmployee]);

  const upcomingBirthdays = useMemo(() => {
    return employees
      .map(emp => ({
        ...emp,
        daysUntil: getDaysUntilBirthday(emp.tanggalLahir)
      }))
      .filter(emp => emp.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  const playAlarm = (alarmId: string) => {
    if (!playedAlarms.has(alarmId)) {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALARM_SOUND_URL);
      }
      audioRef.current.play().catch(() => console.warn("Auto-play blocked by browser."));
      setPlayedAlarms(prev => new Set(prev).add(alarmId));
    }
  };

  const attentionItems = useMemo(() => {
    const items: { text: string; icon: React.ReactNode; color: string; action?: string; urgent?: boolean; date?: string }[] = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 1. Notifications for Admin (Submissions) - Filter < 1 week
    if (isAdmin) {
      const pendingSubmissions = submissions.filter(s => {
        const subDate = new Date(s.submittedAt);
        return s.status === 'Pending' && subDate >= oneWeekAgo;
      });

      pendingSubmissions.forEach(s => {
        items.push({ 
          text: `PENGAJUAN BARU: ${s.type} dari ${s.employeeName}`, 
          icon: <Icons.FileText className="w-5 h-5" />, 
          color: 'text-amber-400',
          action: 'inbox',
          date: s.submittedAt
        });
      });
    }

    // 2. Broadcast Notifications - Filter < 1 week
    if (currentUserEmployee) {
      const myBroadcasts = broadcasts.filter(b => {
        const targets = Array.isArray(b.targetEmployeeIds) 
          ? b.targetEmployeeIds 
          : JSON.parse((b.targetEmployeeIds as any) || "[]");
        const sentDate = new Date(b.sentAt);
        return targets.map(String).includes(String(currentUserEmployee.id)) && sentDate >= oneWeekAgo;
      });

      myBroadcasts.forEach(brd => {
        items.push({
          text: `PENGUMUMAN PERUSAHAAN: ${brd.title}`,
          icon: <Icons.Megaphone className="w-5 h-5" />,
          color: 'text-cyan-400 font-bold',
          action: 'inbox',
          date: brd.sentAt
        });
      });
    }

    // 3. AUTOMATIC UPLOAD ALARM
    if (isCreator && contentBrandConfigs.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      contentBrandConfigs.forEach(brand => {
        if (brand.jamUpload) {
          const alreadyUploadedToday = contentPlans.some(p => 
            p.brand === brand.name && 
            p.postingDate === todayStr && 
            p.status === 'Selesai'
          );
          
          if (!alreadyUploadedToday) {
            const [hours, minutes] = brand.jamUpload.split(':').map(Number);
            const uploadTime = new Date();
            uploadTime.setHours(hours, minutes, 0, 0);
            
            const diffMs = uploadTime.getTime() - now.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            
            if (diffMinutes <= 60 && diffMinutes > -120) {
              const isPastTime = diffMinutes < 0;
              
              items.unshift({
                text: isPastTime 
                  ? `ALARM TELAT: Konten ${brand.name} belum upload! (Jadwal: ${brand.jamUpload})`
                  : `ALARM UPLOAD: ${brand.name} wajib upload jam ${brand.jamUpload} (${diffMinutes} menit lagi!)`,
                icon: <Icons.Clock className={`w-5 h-5 ${!isPastTime ? 'animate-pulse' : ''}`} />,
                color: isPastTime ? 'text-rose-500 font-black' : 'text-[#FFC000] font-black',
                action: 'content',
                urgent: true
              });

              if (diffMinutes <= 15) {
                playAlarm(`upload-alarm-${brand.name}-${todayStr}`);
              }
            }
          }
        }
      });
    }

    if (items.length === 0) {
      items.push({ 
        text: `Selamat datang di portal ${isOwner ? 'Global' : userCompany}. Belum ada notifikasi mendesak.`, 
        icon: <Icons.Sparkles className="w-5 h-5" />, 
        color: 'text-slate-400' 
      });
    }

    return items;
  }, [submissions, broadcasts, userRole, currentUserEmployee, isAdmin, weeklyHolidays, isCreator, contentPlans, contentBrandConfigs, playedAlarms, userCompany, isOwner]);

  const itemsPerPage = 2;
  const totalPages = Math.ceil(attentionItems.length / itemsPerPage);
  const currentItems = attentionItems.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const stats = [
    { label: 'TOTAL KARYAWAN', value: employees.length, color: 'amber', icon: <Icons.Users className="w-5 h-5" /> },
    { label: 'KARYAWAN BARU', value: employees.filter(e => {
        const joinDate = new Date(e.tanggalMasuk);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return joinDate > thirtyDaysAgo;
      }).length, color: 'emerald', icon: <Icons.Users className="w-5 h-5" />
    },
    { label: 'ULANG TAHUN', value: upcomingBirthdays.length, color: 'rose', icon: <Icons.Cake className="w-5 h-5" /> }
  ];

  return (
    <div className="mb-6 md:mb-8 space-y-6 md:space-y-8">
      <div className="flex justify-between items-center bg-white px-8 py-8 rounded-[40px] sm:rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
         <div className="flex flex-col gap-1 relative z-10">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
              WORKSPACE: {isOwner ? 'GLOBAL ACCESS' : userCompany.toUpperCase()}
            </h1>
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Sistem Manajemen Terpadu</p>
         </div>
         <div className="hidden sm:flex items-center gap-4 relative z-10">
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

      {isSuper && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className={`w-11 h-11 rounded-[16px] bg-slate-50 flex items-center justify-center text-${stat.color}-500 shadow-inner shrink-0`}>
                {React.cloneElement(stat.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
              </div>
              <div className="overflow-hidden">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">{stat.label}</p>
                <p className="text-xl font-black text-slate-900 leading-none">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
           {isSuper && (
             <button onClick={onOpenDrive} className="bg-slate-50 hover:bg-white text-blue-600 border border-slate-100 px-8 py-4 rounded-[22px] flex items-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95">
                <Icons.Video className="w-4 h-4" /> DRIVE
             </button>
           )}
           <button onClick={onOpenBroadcast} className="bg-slate-900 hover:bg-black text-[#FFC000] px-8 py-4 rounded-[22px] flex items-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 border border-slate-800">
              <Icons.Megaphone className="w-4 h-4" /> BROADCAST
           </button>
        </div>
      )}

      <div className="w-full bg-[#0f172a] rounded-[48px] p-0.5 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-white/5">
        <div className="p-6 sm:p-10 text-white relative">
          <div className="flex flex-row items-center justify-between gap-4 mb-6 sm:mb-10">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="bg-[#FFC000] p-3 sm:p-4 rounded-[22px] sm:rounded-[28px] text-black shadow-[0_0_30px_rgba(255,192,0,0.15)] transform rotate-2">
                <Icons.Bell className="w-6 h-6 sm:w-10 sm:h-10" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-black text-2xl sm:text-5xl tracking-tighter uppercase leading-none text-white">
                  ATTENTION
                </h3>
                <div className="flex items-center gap-3">
                  <div className="h-[2px] w-6 bg-[#FFC000]"></div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-[0.5em] whitespace-nowrap">NOTIFICATIONS HUB - {isOwner ? 'GLOBAL' : userCompany.toUpperCase()}</p>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2.5 px-6 py-3 bg-white/5 border border-white/10 rounded-[22px] backdrop-blur-md">
              <div className="w-1.5 h-1.5 bg-[#FFC000] rounded-full animate-pulse shadow-[0_0_8px_#FFC000]"></div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Active Session</span>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4 max-w-4xl">
            {currentItems.map((item, idx) => (
              <button 
                key={idx} 
                onClick={() => item.action && onNavigate(item.action)}
                className={`w-full text-left bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 flex items-center gap-4 sm:gap-8 group hover:bg-white/10 transition-all duration-500 ${item.urgent ? 'ring-2 ring-[#FFC000] ring-offset-4 ring-offset-[#0f172a]' : ''} ${item.action ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'}`}
              >
                <div className={`${item.color} p-3 sm:p-4 rounded-[18px] sm:rounded-[24px] bg-white/5 transition-transform group-hover:scale-110 shadow-lg shrink-0`}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { className: 'w-5 h-5 sm:w-7 sm:h-7' })}
                </div>
                <div className="flex-grow">
                  <p className="text-sm sm:text-xl font-black leading-tight sm:leading-snug text-slate-50 uppercase tracking-tight">
                    {item.text}
                  </p>
                  {item.date && (
                    <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 max-w-4xl px-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Halaman</span>
                <span className="text-xs font-black text-white px-3 py-1 bg-white/10 rounded-lg">{currentPage + 1} / {totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                >
                  <Icons.ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <button 
                  disabled={currentPage === totalPages - 1}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                >
                  <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            </div>
          )}

          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#FFC000]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-40"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none opacity-30"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
