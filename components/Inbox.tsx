import React from 'react';
import { Submission, Employee, Broadcast, AttendanceRecord } from '../types.ts';
import { Icons } from '../constants.tsx';
import { supabase } from '../App.tsx';

interface InboxProps {
  submissions: Submission[];
  broadcasts: Broadcast[];
  employee: Employee | null;
  userRole: string;
  onUpdate: () => void;
}

const Inbox: React.FC<InboxProps> = ({ submissions, broadcasts, employee, userRole, onUpdate }) => {
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
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      // Logic parsing khusus untuk lembur
      let clockIn: string | undefined = undefined;
      let clockOut: string | undefined = undefined;

      if (sub.type === 'Lembur') {
        const timeMatch = sub.notes.match(/JAM: (\d{2}:\d{2}) - (\d{2}:\d{2})/);
        if (timeMatch) {
          clockIn = timeMatch[1];
          clockOut = timeMatch[2];
        }
      }

      // 1. Catat ke tabel attendance
      const attendanceRecords: Partial<AttendanceRecord>[] = dates.map(date => ({
        employeeId: sub.employeeId,
        date,
        status: sub.type,
        clockIn,
        clockOut,
        notes: `Pengajuan disetujui: ${sub.notes}`
      }));

      const { error: attError } = await supabase.from('attendance').upsert(attendanceRecords, { onConflict: 'employeeId,date' });
      if (attError) {
        console.error("Attendance Error:", attError);
        throw new Error(`Gagal mencatat absensi: ${attError.message}`);
      }

      // 2. Update status pengajuan
      const { error: subError } = await supabase.from('submissions').update({ status: 'Approved' }).eq('id', sub.id);
      if (subError) {
        console.error("Submission Update Error:", subError);
        throw new Error(`Gagal update status pengajuan: ${subError.message}`);
      }

      alert("Pengajuan berhasil disetujui!");
      onUpdate();
    } catch (err: any) {
      console.error("Full Error Object:", err);
      alert(err.message || "Gagal memproses pengajuan. Periksa koneksi atau hak akses database.");
    }
  };

  const handleReject = async (id: string) => {
    if (!id) return;
    if (!confirm('Tolak pengajuan ini?')) return;
    
    try {
      const { error } = await supabase.from('submissions').update({ status: 'Rejected' }).eq('id', id);
      if (error) {
        console.error("Reject Error:", error);
        throw new Error(error.message);
      }
      
      alert("Pengajuan telah ditolak.");
      onUpdate();
    } catch (err: any) {
      console.error("Full Reject Error:", err);
      alert(`Gagal menolak pengajuan: ${err.message || "Error tidak diketahui"}`);
    }
  };

  const pendingApprovals = userRole !== 'employee' ? submissions.filter(s => s.status === 'Pending') : [];

  const mySubmissions = (userRole === 'employee' && employee) 
    ? submissions.filter(s => s.employeeId === employee.id && s.status !== 'Pending') 
    : [];
  
  const myBroadcasts = (userRole === 'employee' && employee)
    ? broadcasts.filter(b => {
        const targets = Array.isArray(b.targetEmployeeIds) 
          ? b.targetEmployeeIds 
          : JSON.parse(b.targetEmployeeIds as any || "[]");
        return targets.map(String).includes(String(employee.id));
      })
    : broadcasts;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center gap-5 mb-12">
        <div className="bg-[#0f172a] p-4 rounded-2xl text-[#FFC000] shadow-xl">
          <Icons.Mail className="w-8 h-8" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-3xl font-black text-[#0f172a] tracking-tight leading-none uppercase">KOTAK MASUK</h2>
          <p className="text-[11px] text-slate-400 font-bold tracking-[0.3em] uppercase mt-2">
            {userRole !== 'employee' ? 'PUSAT KENDALI PENGAJUAN' : 'PESAN & PEMBERITAHUAN'}
          </p>
        </div>
      </div>

      {userRole !== 'employee' && pendingApprovals.length > 0 && (
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

      <div className="space-y-6">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-4">PENGUMUMAN & PESAN</h3>
        <div className="grid grid-cols-1 gap-6">
          {myBroadcasts.map((brd) => (
            <div key={brd.id} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-4 relative group hover:shadow-xl transition-all border-l-[12px] border-l-slate-900">
              <div className="flex justify-between items-start">
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">{brd.title}</h4>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(brd.sentAt).toLocaleDateString('id-ID')}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line">{brd.message}</p>
              <div className="pt-4">
                <span className="inline-block bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">OFFICIAL ANNOUNCEMENT</span>
              </div>
            </div>
          ))}

          {userRole === 'employee' && mySubmissions.map((sub) => (
            <div key={sub.id} className={`bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex justify-between items-center gap-6 border-l-[12px] ${sub.status === 'Approved' ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${sub.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {sub.status === 'Approved' ? 'DISETUJUI' : 'DITOLAK'}
                  </span>
                  <p className="text-sm font-bold text-slate-900">Pengajuan {sub.type}</p>
                </div>
                <p className="text-xs text-slate-500">{sub.startDate} {sub.startDate !== sub.endDate ? `- ${sub.endDate}` : ''}</p>
                <p className="text-[10px] text-slate-400 italic">"{sub.notes}"</p>
              </div>
              <Icons.Sparkles className={sub.status === 'Approved' ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
          ))}

          {myBroadcasts.length === 0 && mySubmissions.length === 0 && pendingApprovals.length === 0 && (
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