import React, { useMemo, useState, useEffect } from 'react';
import { Submission, Employee, Broadcast, AttendanceRecord } from '../types.ts';
import { Icons } from '../constants.tsx';
import { supabase } from '../App.tsx';
import { formatDateToYYYYMMDD } from '../utils/dateUtils.ts';

interface InboxProps {
  submissions: Submission[];
  broadcasts: Broadcast[];
  employee: Employee | null;
  userRole: string;
  onUpdate: () => void;
}

const Inbox: React.FC<InboxProps> = ({ submissions, broadcasts, employee, userRole, onUpdate }) => {
  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const isAdmin = userRole === 'admin';
  const canApproveSomething = isSuper || isAdmin;

  const [historyPage, setHistoryPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const itemsPerPage = isMobile ? 3 : 10;

  const fetchBroadcastImage = async (id: string) => {
    setIsPhotoLoading(true);
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('imageBase64')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (data?.imageBase64) {
        setZoomedImage(data.imageBase64);
      } else {
        alert("Gambar tidak ditemukan.");
      }
    } catch (err: any) {
      alert("Gagal memuat gambar: " + err.message);
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const handleApprove = async (sub: Submission) => {
    if (!sub.id) {
      alert("ID Pengajuan tidak ditemukan.");
      return;
    }
    
    if (!confirm(`Setujui pengajuan ${sub.type.toUpperCase()} dari ${sub.employeeName}?`)) return;

    try {
      const dates: string[] = [];
      let current = new Date(sub.startDate);
      const last = new Date(sub.endDate);
      
      current.setHours(0, 0, 0, 0);
      last.setHours(0, 0, 0, 0);

      while (current <= last) {
        dates.push(formatDateToYYYYMMDD(current));
        current.setDate(current.getDate() + 1);
      }

      const attendanceRecords: Partial<AttendanceRecord>[] = dates.map(date => {
        let clockIn = '--:--';
        let clockOut = '--:--';
        
        if (sub.type === 'Lembur') {
          const timeMatch = sub.notes.match(/(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/);
          if (timeMatch) {
            clockIn = timeMatch[1].replace('.', ':');
            clockOut = timeMatch[2].replace('.', ':');
          }
        }
        
        return {
          employeeId: sub.employeeId,
          company: sub.company,
          date,
          status: sub.type,
          clockIn,
          clockOut,
          notes: `Pengajuan disetujui: ${sub.notes}`
        };
      });

      const { error: attError } = await supabase.from('attendance').upsert(attendanceRecords, { onConflict: 'employeeId,date' });
      if (attError) throw new Error(`Gagal mencatat absensi: ${attError.message}`);

      const { error: subError } = await supabase.from('submissions').update({ status: 'Approved' }).eq('id', sub.id);
      if (subError) throw new Error(`Gagal update status pengajuan: ${subError.message}`);

      alert("Pengajuan berhasil disetujui!");
      onUpdate();
    } catch (err: any) {
      alert(err.message || "Gagal memproses pengajuan.");
    }
  };

  const handleReject = async (id: string) => {
    if (!id) return;
    if (!confirm('Tolak pengajuan ini?')) return;
    
    try {
      const { error } = await supabase.from('submissions').update({ status: 'Rejected' }).eq('id', id);
      if (error) throw new Error(error.message);
      
      alert("Pengajuan telah ditolak.");
      onUpdate();
    } catch (err: any) {
      alert(`Gagal menolak pengajuan: ${err.message}`);
    }
  };

  const oneMonthAgo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  }, []);

  const pendingApprovals = useMemo(() => {
    const pending = submissions.filter(s => s.status === 'Pending');
    if (isSuper) return pending;
    if (isAdmin) return pending.filter(s => s.type === 'Lembur');
    return [];
  }, [submissions, isSuper, isAdmin]);

  const submissionHistory = useMemo(() => {
    let base = submissions.filter(s => s.status !== 'Pending');
    if (!isSuper && employee) {
      if (isAdmin) {
         base = base.filter(s => s.employeeId === employee.id || s.type === 'Lembur');
      } else {
         base = base.filter(s => s.employeeId === employee.id);
      }
    }
    return base.filter(s => {
      const subDate = new Date(s.submittedAt);
      return subDate >= oneMonthAgo;
    });
  }, [submissions, isSuper, isAdmin, employee, oneMonthAgo]);

  const totalHistoryPages = Math.ceil(submissionHistory.length / itemsPerPage);
  const paginatedHistory = useMemo(() => {
    return submissionHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);
  }, [submissionHistory, historyPage, itemsPerPage]);
  
  const myBroadcasts = (userRole === 'employee' || userRole === 'admin') && employee
    ? broadcasts.filter(b => {
        const targets = Array.isArray(b.targetEmployeeIds) 
          ? b.targetEmployeeIds 
          : JSON.parse(b.targetEmployeeIds as any || "[]");
        return targets.map(String).includes(String(employee.id));
      })
    : broadcasts;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[80vh] rounded-[32px] shadow-2xl border-4 border-white/10 scale-95 animate-in zoom-in-95 duration-300" alt="Verifikasi" />
        </div>
      )}

      {isPhotoLoading && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-[2px] z-[250] flex items-center justify-center">
           <div className="bg-slate-900 text-[#FFC000] px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in zoom-in duration-300">
              <div className="w-5 h-5 border-2 border-[#FFC000]/20 border-t-[#FFC000] rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Memproses Lampiran...</p>
           </div>
        </div>
      )}

      <div className="flex items-center gap-5 mb-12">
        <div className="bg-[#0f172a] p-4 rounded-2xl text-[#FFC000] shadow-xl">
          <Icons.Mail className="w-8 h-8" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-3xl font-black text-[#0f172a] tracking-tight leading-none uppercase">KOTAK MASUK</h2>
          <p className="text-[11px] text-slate-400 font-bold tracking-[0.3em] uppercase mt-2">
            {canApproveSomething ? 'PUSAT KENDALI PENGAJUAN' : 'PESAN & PEMBERITAHUAN'}
          </p>
        </div>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-4">PENGAJUAN MENUNGGU PERSETUJUAN</h3>
          <div className="grid grid-cols-1 gap-6">
            {pendingApprovals.map((sub) => (
              <div 
                key={sub.id} 
                className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8 border-l-[12px] border-l-[#FFC000] hover:shadow-xl transition-all duration-300"
              >
                <div className="flex-grow space-y-4 w-full">
                  <div className="flex items-center gap-4">
                    <span className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] bg-amber-50 text-amber-600 border border-amber-100">
                      {sub.type}
                    </span>
                    <p className="text-lg font-bold text-[#0f172a] tracking-tight">{sub.employeeName}</p>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                    <Icons.Calendar className="w-5 h-5 text-slate-400" />
                    <span>{sub.startDate} {sub.startDate !== sub.endDate ? `- ${sub.endDate}` : ''}</span>
                  </div>
                  <p className="text-sm text-slate-500 italic font-medium leading-relaxed">
                    "{sub.notes}"
                  </p>
                </div>
                <div className="flex gap-3 shrink-0 w-full md:w-auto">
                  <button onClick={() => handleApprove(sub)} className="flex-1 md:flex-none bg-[#059669] hover:bg-[#047857] text-white px-10 py-4 rounded-[18px] font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95">SETUJUI</button>
                  <button onClick={() => handleReject(sub.id!)} className="flex-1 md:flex-none bg-white border-2 border-[#f43f5e] text-[#f43f5e] hover:bg-rose-50 px-10 py-4 rounded-[18px] font-black text-[11px] uppercase tracking-widest transition-all active:scale-95">TOLAK</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {submissionHistory.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-slate-100 pb-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">HISTORY PENGAJUAN (TERSIMPAN 1 BULAN)</h3>
            {totalHistoryPages > 1 && (
              <div className="flex gap-2">
                 <button 
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(p => p - 1)}
                  className="p-2 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-all"
                 >
                   <Icons.ChevronDown className="w-4 h-4 rotate-90" />
                 </button>
                 <span className="text-[10px] font-black text-slate-900 bg-white px-3 py-2 rounded-lg border shadow-sm whitespace-nowrap min-w-[60px] flex items-center justify-center">
                   {historyPage} / {totalHistoryPages}
                 </span>
                 <button 
                  disabled={historyPage === totalHistoryPages}
                  onClick={() => setHistoryPage(p => p + 1)}
                  className="p-2 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-all"
                 >
                   <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
                 </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedHistory.map((sub) => (
              <div key={sub.id} className={`bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex justify-between items-center gap-6 border-l-[10px] ${sub.status === 'Approved' ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
                <div className="space-y-1.5 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${sub.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {sub.status === 'Approved' ? 'DISETUJUI' : 'DITOLAK'}
                    </span>
                    {(isSuper || isAdmin) && <p className="text-[10px] font-black text-slate-900 truncate">{sub.employeeName}</p>}
                    <p className="text-[10px] font-bold text-slate-700 truncate">Pengajuan {sub.type}</p>
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold">{sub.startDate} {sub.startDate !== sub.endDate ? `- ${sub.endDate}` : ''}</p>
                  <p className="text-[9px] text-slate-400 italic truncate" title={sub.notes}>"{sub.notes}"</p>
                </div>
                <div className="shrink-0">
                  <Icons.Sparkles className={sub.status === 'Approved' ? 'text-emerald-500 w-5 h-5' : 'text-rose-500 w-5 h-5'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-4">PENGUMUMAN & PESAN</h3>
        <div className="grid grid-cols-1 gap-6">
          {myBroadcasts.map((brd) => {
            return (
              <div key={brd.id} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-4 relative group hover:shadow-xl transition-all border-l-[12px] border-l-slate-900">
                <div className="flex justify-between items-start">
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">{brd.title}</h4>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(brd.sentAt).toLocaleDateString('id-ID')}</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line">{brd.message}</p>
                
                <div className="mt-6 space-y-4">
                  <button 
                    onClick={() => brd.id && fetchBroadcastImage(brd.id)}
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 flex items-center gap-3 hover:bg-slate-100 transition-all group/btn"
                  >
                    <Icons.Image className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lihat Lampiran Gambar</span>
                  </button>
                  <p className="text-[9px] font-bold text-slate-400 italic">Gunakan tombol di atas untuk memuat lampiran (Slip Gaji/Pengumuman).</p>
                </div>

                <div className="pt-4">
                  <span className="inline-block bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">OFFICIAL ANNOUNCEMENT</span>
                </div>
              </div>
            );
          })}

          {myBroadcasts.length === 0 && submissionHistory.length === 0 && pendingApprovals.length === 0 && (
            <div className="bg-slate-50 py-20 rounded-[40px] border-2 border-dashed border-slate-200 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kotak masuk kosong</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;