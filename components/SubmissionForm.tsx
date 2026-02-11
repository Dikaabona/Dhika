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

  const [reimburseAmount, setReimburseAmount] = useState('');
  
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

    if (status === 'Reimburse' && (!reimburseAmount || !docBase64)) {
      alert("Silakan isi nominal dan unggah bukti kwitansi.");
      return;
    }

    setIsLoading(true);
    try {
      let finalNotes = notes;
      if (status === 'Lembur') {
        finalNotes = `BRAND: ${overtimeBrand.toUpperCase()} | JAM: ${overtimeStart} - ${overtimeEnd} | ALASAN: ${notes || '-'}`;
      } else if (status === 'Reimburse') {
        finalNotes = `NOMINAL: Rp ${new Intl.NumberFormat('id-ID').format(Number(reimburseAmount.replace(/\D/g, '')))} | ALASAN: ${notes || '-'}`;
      }

      const newSubmission: Submission = {
        employeeId: employee.id,
        employeeName: employee.nama,
        company: company,
        type: status,
        startDate,
        endDate: (status === 'Lembur' || status === 'Reimburse') ? startDate : endDate,
        notes: finalNotes,
        docBase64: (status === 'Sakit' || status === 'Reimburse') ? (docBase64 || undefined) : undefined,
        status: 'Pending',
        submittedAt: new Date().toISOString()
      };

      const { error } = await supabase.from('submissions').insert([newSubmission]);
      
      if (error) throw error;

      const waNumber = '6285717393436';
      let detailMsg = '';
      if (status === 'Lembur') {
        detailMsg = `Lembur di ${overtimeBrand.toUpperCase()} (${overtimeStart}-${overtimeEnd}) pada tanggal ${startDate}`;
      } else if (status === 'Reimburse') {
        detailMsg = `Reimburse senilai Rp ${new Intl.NumberFormat('id-ID').format(Number(reimburseAmount.replace(/\D/g, '')))} pada tanggal ${startDate}`;
      } else {
        detailMsg = `${status} dari tanggal ${startDate} sampai ${endDate}`;
      }
        
      const message = `Halo Admin ${company}, saya ${employee.nama} mengajukan ${detailMsg}. Alasan: ${notes || '-'}. Mohon konfirmasinya melalui portal HR. Terima kasih.`;
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      alert("Pengajuan Berhasil Dikirim!");
      setNotes('');
      setOvertimeBrand('');
      setReimburseAmount('');
      setDocBase64(null);
      onSuccess();
    } catch (err: any) {
      alert("Gagal mengirim pengajuan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setReimburseAmount(val);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-4 sm:p-12 rounded-[40px] sm:rounded-[60px] shadow-sm border border-slate-50">
      <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10">
        <div className="bg-slate-50/50 p-3 sm:p-8 rounded-[24px] sm:rounded-[48px] border border-slate-100/50 space-y-5 sm:space-y-6 shadow-inner">
          <div className="flex items-center gap-3 ml-1 sm:ml-2">
            <div className="w-1.5 h-1.5 bg-[#FFC000] rounded-full shadow-[0_0_8px_#FFC000]"></div>
            <label className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Jenis Pengajuan</label>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
            {(['Cuti', 'Izin', 'Sakit', 'Lembur', 'Reimburse'] as AttendanceStatus[]).map((s, idx) => (
              <button 
                key={s} 
                type="button"
                onClick={() => setStatus(s)}
                className={`relative py-3.5 sm:py-6 rounded-[18px] sm:rounded-[32px] font-black text-[9px] sm:text-[11px] uppercase tracking-[0.15em] transition-all border-2 flex flex-col items-center justify-center gap-2 sm:gap-3 active:scale-95 ${
                  status === s 
                  ? 'bg-[#0f172a] text-[#FFC000] border-[#0f172a] shadow-xl -translate-y-1' 
                  : 'bg-white text-slate-300 border-slate-50 shadow-sm hover:border-slate-200'
                } ${idx === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${status === s ? 'bg-[#FFC000] scale-125 shadow-[0_0_8px_#FFC000]' : 'bg-transparent'}`}></div>
                {s}
              </button>
            ))}
          </div>
        </div>

        {status === 'Lembur' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Brand Lembur</label>
                <div className="bg-slate-100 p-2 rounded-[28px] shadow-inner">
                  <input 
                    type="text"
                    placeholder="Masukkan nama brand..."
                    value={overtimeBrand} 
                    onChange={e => setOvertimeBrand(e.target.value.toUpperCase())}
                    className="w-full bg-white px-8 py-5 rounded-[22px] border-none text-sm font-black text-slate-900 outline-none placeholder:text-slate-300 uppercase tracking-widest shadow-sm transition-all focus:ring-2 focus:ring-[#FFC000]/10"
                  />
                </div>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                <div className="col-span-2 md:col-span-1 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tanggal</label>
                  <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center justify-center shadow-sm focus-within:border-[#FFC000] transition-all">
                    <input 
                      required 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Jam Mulai</label>
                  <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center justify-center shadow-sm focus-within:border-[#FFC000] transition-all">
                    <input 
                      required 
                      type="time" 
                      value={overtimeStart} 
                      onChange={e => setOvertimeStart(e.target.value)} 
                      className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Jam Selesai</label>
                  <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center justify-center shadow-sm focus-within:border-[#FFC000] transition-all">
                    <input 
                      required 
                      type="time" 
                      value={overtimeEnd} 
                      onChange={e => setOvertimeEnd(e.target.value)} 
                      className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
             </div>
          </div>
        ) : status === 'Reimburse' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tanggal</label>
                  <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center justify-center shadow-sm focus-within:border-[#FFC000] transition-all">
                    <input 
                      required 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none cursor-pointer text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nominal (Rp)</label>
                  <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center shadow-sm focus-within:border-[#FFC000] transition-all">
                    <span className="text-slate-400 font-black text-[10px] sm:text-xs mr-1 sm:mr-2">Rp</span>
                    <input 
                      required 
                      type="text" 
                      value={new Intl.NumberFormat('id-ID').format(Number(reimburseAmount || 0))}
                      onChange={handleAmountChange} 
                      placeholder="0"
                      className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none" 
                    />
                  </div>
                </div>
             </div>
             
             <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Unggah Bukti Nota / Kwitansi</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="receipt-upload" />
                <label htmlFor="receipt-upload" className={`flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-[32px] cursor-pointer transition-all ${docBase64 ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:border-[#FFC000] hover:bg-slate-100/50'}`}>
                  <div className={docBase64 ? 'text-emerald-600' : 'text-slate-400'}><Icons.Image className="w-10 h-10" /></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-4 text-center">{docBase64 ? 'BUKTI BERHASIL DIUNGGAH' : 'KLIK UNTUK UNGGAH FOTO NOTA'}</p>
                  {docBase64 && <div className="mt-4 px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-full uppercase">Siap Dikirim</div>}
                </label>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 animate-in fade-in duration-500">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tanggal Mulai</label>
              <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center justify-center shadow-sm focus-within:border-[#FFC000] transition-all">
                <input 
                  required 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none cursor-pointer text-center" 
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tanggal Selesai</label>
              <div className="bg-slate-50 border border-slate-100 px-4 sm:px-6 py-4.5 rounded-[24px] flex items-center justify-center shadow-sm focus-within:border-[#FFC000] transition-all">
                <input 
                  required 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="w-full text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none cursor-pointer text-center" 
                />
              </div>
            </div>
          </div>
        )}

        {status === 'Sakit' && (
          <div className="space-y-4 animate-in zoom-in-95 duration-300">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Unggah Surat Sakit</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="doc-upload" />
            <label htmlFor="doc-upload" className={`flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-[32px] cursor-pointer transition-all ${docBase64 ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:border-[#FFC000] hover:bg-slate-100/50'}`}>
              <div className={docBase64 ? 'text-emerald-600' : 'text-slate-400'}><Icons.Upload className="w-10 h-10" /></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-4 text-center">{docBase64 ? 'SURAT SAKIT BERHASIL DIUNGGAH' : 'KLIK UNTUK UNGGAH BERKAS (IMAGE)'}</p>
              {docBase64 && <div className="mt-4 px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-full uppercase">Siap Dikirim</div>}
            </label>
          </div>
        )}

        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Keterangan / Alasan</label>
          <div className="bg-slate-100 p-2.5 rounded-[32px] shadow-inner">
            <textarea 
              required={status !== 'Lembur' && status !== 'Reimburse'} 
              rows={5} 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Berikan alasan yang jelas di sini..."
              className="w-full px-8 py-7 bg-white border-none rounded-[24px] text-sm font-medium text-slate-700 outline-none focus:ring-0 resize-none shadow-sm transition-all focus:bg-slate-50"
            />
          </div>
        </div>

        <button 
          disabled={isLoading} 
          type="submit" 
          className="w-full bg-[#0f172a] hover:bg-black text-[#FFC000] py-7 rounded-full font-black text-[11px] sm:text-xs uppercase tracking-[0.4em] shadow-2xl transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-4"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-[#FFC000]/30 border-t-[#FFC000] rounded-full animate-spin"></div>
              <span>Mengirim Data...</span>
            </>
          ) : (
            'Kirim Pengajuan'
          )}
        </button>
      </form>
    </div>
  );
};

export default SubmissionForm;