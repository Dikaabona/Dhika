
import React, { useState } from 'react';
import { Employee, AttendanceStatus, Submission } from '../types';
import { Icons, LIVE_BRANDS } from '../constants';
import { supabase } from '../App';

interface SubmissionFormProps {
  employee: Employee | null;
  onSuccess: () => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ employee, onSuccess }) => {
  const [status, setStatus] = useState<AttendanceStatus>('Izin');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // State khusus lembur
  const [overtimeBrand, setOvertimeBrand] = useState(LIVE_BRANDS[0].name);
  const [overtimeStart, setOvertimeStart] = useState('17:00');
  const [overtimeEnd, setOvertimeEnd] = useState('20:00');
  
  const [docBase64, setDocBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setDocBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) {
      alert("Sesi karyawan tidak ditemukan. Silakan login ulang.");
      return;
    }

    setIsLoading(true);
    try {
      // Format notes khusus jika lembur
      let finalNotes = notes;
      if (status === 'Lembur') {
        finalNotes = `BRAND: ${overtimeBrand} | JAM: ${overtimeStart} - ${overtimeEnd} | ALASAN: ${notes || '-'}`;
      }

      const newSubmission: Submission = {
        employeeId: employee.id,
        employeeName: employee.nama,
        type: status,
        startDate,
        // Untuk lembur, end date disamakan dengan start date (single day)
        endDate: status === 'Lembur' ? startDate : endDate,
        notes: finalNotes,
        docBase64: status === 'Sakit' ? (docBase64 || undefined) : undefined,
        status: 'Pending',
        submittedAt: new Date().toISOString()
      };

      const { error } = await supabase.from('submissions').insert([newSubmission]);
      
      if (error) {
        if (error.code === '42501') {
          throw new Error("Akses Ditolak (RLS Policy).");
        }
        throw error;
      }

      const waNumber = '6285717393436';
      const detailMsg = status === 'Lembur' 
        ? `Lembur di ${overtimeBrand} (${overtimeStart}-${overtimeEnd}) pada tanggal ${startDate}`
        : `${status} dari tanggal ${startDate} sampai ${endDate}`;
        
      const message = `Halo Pak Reza, saya ${employee.nama} mengajukan ${detailMsg}. Alasan: ${notes || '-'}. Mohon konfirmasinya melalui portal HR. Terima kasih.`;
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      alert("Pengajuan Berhasil Dikirim!");
      setNotes('');
      setDocBase64(null);
      onSuccess();
    } catch (err: any) {
      alert("Gagal mengirim pengajuan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-10 rounded-[48px] shadow-sm border border-slate-50">
      <div className="flex items-center gap-5 mb-10">
        <div className="bg-[#FFC000] p-4 rounded-2xl text-slate-900 shadow-lg shadow-amber-200/50">
          <Icons.Megaphone className="w-8 h-8" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-3xl font-black text-[#0f172a] tracking-tight leading-none">PUSAT PENGAJUAN</h2>
          <p className="text-[11px] text-slate-400 font-bold tracking-[0.3em] uppercase mt-2">CUTI • IZIN • SAKIT • LEMBUR</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">JENIS PENGAJUAN</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['Cuti', 'Izin', 'Sakit', 'Lembur'] as AttendanceStatus[]).map(s => (
              <button 
                key={s} 
                type="button"
                onClick={() => setStatus(s)}
                className={`py-5 rounded-[24px] font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm ${
                  status === s 
                  ? 'bg-[#0f172a] text-[#FFC000] shadow-xl shadow-slate-200 scale-[1.02]' 
                  : 'bg-[#f8fafc] text-slate-400 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {status === 'Lembur' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
             <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">BRAND LEMBUR</label>
                <select 
                  value={overtimeBrand} 
                  onChange={e => setOvertimeBrand(e.target.value)}
                  className="w-full bg-[#f8fafc] px-6 py-5 rounded-[24px] border border-slate-100 text-sm font-bold text-[#0f172a] outline-none"
                >
                  {LIVE_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">TANGGAL</label>
                  <div className="bg-[#f8fafc] px-6 py-5 rounded-[24px] border border-slate-100 flex items-center justify-center">
                    <input 
                      required 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full text-sm font-bold text-[#0f172a] bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">JAM MULAI</label>
                  <div className="bg-[#f8fafc] px-6 py-5 rounded-[24px] border border-slate-100 flex items-center justify-center">
                    <input 
                      required 
                      type="time" 
                      value={overtimeStart} 
                      onChange={e => setOvertimeStart(e.target.value)} 
                      className="w-full text-sm font-bold text-[#0f172a] bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">JAM SELESAI</label>
                  <div className="bg-[#f8fafc] px-6 py-5 rounded-[24px] border border-slate-100 flex items-center justify-center">
                    <input 
                      required 
                      type="time" 
                      value={overtimeEnd} 
                      onChange={e => setOvertimeEnd(e.target.value)} 
                      className="w-full text-sm font-bold text-[#0f172a] bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">TANGGAL MULAI</label>
              <div className="bg-[#f8fafc] px-6 py-5 rounded-[24px] border border-slate-100 flex items-center justify-center">
                <input 
                  required 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="w-full text-sm font-bold text-[#0f172a] bg-transparent outline-none cursor-pointer text-center" 
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">TANGGAL SELESAI</label>
              <div className="bg-[#f8fafc] px-6 py-5 rounded-[24px] border border-slate-100 flex items-center justify-center">
                <input 
                  required 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="w-full text-sm font-bold text-[#0f172a] bg-transparent outline-none cursor-pointer text-center" 
                />
              </div>
            </div>
          </div>
        )}

        {status === 'Sakit' && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">UNGGAH SURAT SAKIT</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              className="hidden" 
              id="doc-upload" 
            />
            <label 
              htmlFor="doc-upload" 
              className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[32px] cursor-pointer transition-all ${docBase64 ? 'bg-emerald-50 border-emerald-300' : 'bg-[#f8fafc] border-slate-200 hover:border-[#FFC000]'}`}
            >
              <div className={docBase64 ? 'text-emerald-600' : 'text-slate-400'}>
                <Icons.Upload className="w-8 h-8" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3">
                {docBase64 ? 'SURAT SAKIT TERLAMPIR' : 'KLIK UNTUK UNGGAH BERKAS'}
              </p>
            </label>
          </div>
        )}

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">KETERANGAN / ALASAN</label>
          <textarea 
            required={status !== 'Lembur'} 
            rows={5} 
            value={notes} 
            onChange={e => setNotes(e.target.value)} 
            placeholder="Tuliskan keterangan..."
            className="w-full px-8 py-6 bg-[#f8fafc] border border-slate-100 rounded-[32px] text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#FFC000] resize-none shadow-inner"
          />
        </div>

        <button 
          disabled={isLoading} 
          type="submit" 
          className="w-full bg-[#0f172a] hover:bg-black text-[#FFC000] py-7 rounded-[40px] font-bold text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all disabled:opacity-50 active:scale-[0.98] mt-4"
        >
          {isLoading ? 'MENGIRIM DATA...' : 'KIRIM PENGAJUAN'}
        </button>
      </form>
    </div>
  );
};

export default SubmissionForm;
