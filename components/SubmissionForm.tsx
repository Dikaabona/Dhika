
import React, { useState } from 'react';
import { Employee, AttendanceStatus, Submission } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';

interface SubmissionFormProps {
  employee: Employee | null;
  company: string;
  onSuccess: () => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ employee, company, onSuccess }) => {
  const [status, setStatus] = useState<AttendanceStatus>('Izin');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [overtimeBrand, setOvertimeBrand] = useState('');
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

    if (status === 'Lembur' && !overtimeBrand.trim()) {
      alert("Silakan isi nama Brand Lembur.");
      return;
    }

    setIsLoading(true);
    try {
      let finalNotes = notes;
      if (status === 'Lembur') {
        finalNotes = `BRAND: ${overtimeBrand.toUpperCase()} | JAM: ${overtimeStart} - ${overtimeEnd} | ALASAN: ${notes || '-'}`;
      }

      const newSubmission: Submission = {
        employeeId: employee.id,
        employeeName: employee.nama,
        company: company,
        type: status,
        startDate,
        endDate: status === 'Lembur' ? startDate : endDate,
        notes: finalNotes,
        docBase64: status === 'Sakit' ? (docBase64 || undefined) : undefined,
        status: 'Pending',
        submittedAt: new Date().toISOString()
      };

      const { error } = await supabase.from('submissions').insert([newSubmission]);
      
      if (error) throw error;

      const waNumber = '6285717393436';
      const detailMsg = status === 'Lembur' 
        ? `Lembur di ${overtimeBrand.toUpperCase()} (${overtimeStart}-${overtimeEnd}) pada tanggal ${startDate}`
        : `${status} dari tanggal ${startDate} sampai ${endDate}`;
        
      const message = `Halo Admin ${company}, saya ${employee.nama} mengajukan ${detailMsg}. Alasan: ${notes || '-'}. Mohon konfirmasinya melalui portal HR. Terima kasih.`;
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      alert("Pengajuan Berhasil Dikirim!");
      setNotes('');
      setOvertimeBrand('');
      setDocBase64(null);
      onSuccess();
    } catch (err: any) {
      alert("Gagal mengirim pengajuan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] shadow-sm border border-slate-50">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">JENIS PENGAJUAN</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['Cuti', 'Izin', 'Sakit', 'Lembur'] as AttendanceStatus[]).map(s => (
              <button 
                key={s} 
                type="button"
                onClick={() => setStatus(s)}
                className={`py-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm ${
                  status === s 
                  ? 'bg-[#0f172a] text-[#FFC000] scale-[1.05] shadow-lg' 
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">BRAND LEMBUR</label>
                <div className="bg-slate-100 p-1.5 rounded-[28px]">
                  <input 
                    type="text"
                    placeholder="KETIK NAMA BRAND..."
                    value={overtimeBrand} 
                    onChange={e => setOvertimeBrand(e.target.value.toUpperCase())}
                    className="w-full bg-white px-8 py-5 rounded-[22px] border-none text-sm font-black text-black outline-none placeholder:text-slate-300 uppercase tracking-widest shadow-sm"
                  />
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">TANGGAL</label>
                  <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl flex items-center justify-center">
                    <input 
                      required 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full text-sm font-black text-black bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">JAM MULAI</label>
                  <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl flex items-center justify-center">
                    <input 
                      required 
                      type="time" 
                      value={overtimeStart} 
                      onChange={e => setOvertimeStart(e.target.value)} 
                      className="w-full text-sm font-black text-black bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">JAM SELESAI</label>
                  <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl flex items-center justify-center">
                    <input 
                      required 
                      type="time" 
                      value={overtimeEnd} 
                      onChange={e => setOvertimeEnd(e.target.value)} 
                      className="w-full text-sm font-black text-black bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">TANGGAL MULAI</label>
              <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl flex items-center justify-center">
                <input 
                  required 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="w-full text-sm font-black text-black bg-transparent outline-none cursor-pointer text-center" 
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">TANGGAL SELESAI</label>
              <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl flex items-center justify-center">
                <input 
                  required 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="w-full text-sm font-black text-black bg-transparent outline-none cursor-pointer text-center" 
                />
              </div>
            </div>
          </div>
        )}

        {status === 'Sakit' && (
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">UNGGAH SURAT SAKIT</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="doc-upload" />
            <label htmlFor="doc-upload" className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[32px] cursor-pointer transition-all ${docBase64 ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:border-[#FFC000]'}`}>
              <div className={docBase64 ? 'text-emerald-600' : 'text-slate-400'}><Icons.Upload className="w-8 h-8" /></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3">{docBase64 ? 'SURAT SAKIT TERLAMPIR' : 'KLIK UNTUK UNGGAH BERKAS'}</p>
            </label>
          </div>
        )}

        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">KETERANGAN / ALASAN</label>
          <div className="bg-slate-100 p-2 rounded-[32px]">
            <textarea 
              required={status !== 'Lembur'} 
              rows={4} 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Tuliskan keterangan di sini..."
              className="w-full px-8 py-6 bg-white border-none rounded-[24px] text-sm font-medium text-black outline-none focus:ring-0 resize-none shadow-inner"
            />
          </div>
        </div>

        <button 
          disabled={isLoading} 
          type="submit" 
          className="w-full bg-[#0f172a] hover:bg-black text-[#FFC000] py-6 rounded-full font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {isLoading ? 'MENGIRIM DATA...' : 'KIRIM PENGAJUAN'}
        </button>
      </form>
    </div>
  );
};

export default SubmissionForm;
