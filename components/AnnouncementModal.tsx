
import React, { useState, useMemo } from 'react';
import { Employee, Broadcast } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';

interface AnnouncementModalProps {
  employees: Employee[];
  // Added company prop to match Broadcast interface requirement
  company: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ employees, company, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(employees.map(e => e.id)));
  const [isSending, setIsSending] = useState(false);

  const filteredList = useMemo(() => {
    return employees.filter(e => 
      e.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.jabatan.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => setSelectedIds(new Set(employees.map(e => e.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleSend = async () => {
    if (!title || !message) {
      alert("Judul dan pesan wajib diisi.");
      return;
    }

    const selectedEmployeeIds: string[] = Array.from(selectedIds);
    if (selectedEmployeeIds.length === 0) {
      alert("Silakan pilih setidaknya satu karyawan.");
      return;
    }

    setIsSending(true);
    try {
      // 1. Simpan ke Supabase agar muncul di Inbox
      // Added company field to fix Property 'company' is missing error
      const newBroadcast: Broadcast = {
        title,
        message,
        company,
        targetEmployeeIds: selectedEmployeeIds,
        sentAt: new Date().toISOString()
      };

      const { error: dbError } = await supabase.from('broadcasts').insert([newBroadcast]);
      if (dbError) throw dbError;

      // 2. Kirim Email Client (Opsional)
      const selectedEmails = employees
        .filter(e => selectedIds.has(e.id))
        .map(e => e.email)
        .filter(email => email && email.includes('@'))
        .join(',');

      if (selectedEmails) {
        const subject = encodeURIComponent(title);
        const body = encodeURIComponent(message + "\n\n---\nSalam,\nHR Visibel ID");
        window.location.href = `mailto:?bcc=${selectedEmails}&subject=${subject}&body=${body}`;
      }
      
      alert("Broadcast berhasil dikirim ke Inbox Karyawan!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert("Gagal mengirim broadcast: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFC000] p-2 rounded-xl text-black">
              <Icons.Megaphone />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Broadcast Pengumuman</h2>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                {selectedIds.size} dari {employees.length} Karyawan Terpilih
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none opacity-60 hover:opacity-100 transition-opacity">&times;</button>
        </div>

        <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 p-6 space-y-4 border-r border-slate-100 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Judul Email</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Subjek pengumuman..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FFC000] outline-none text-sm font-bold text-black transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Isi Pesan</label>
              <textarea 
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan detail pengumuman..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FFC000] outline-none text-sm font-medium text-black transition-all resize-none"
              />
            </div>
          </div>

          <div className="w-full md:w-72 bg-slate-50 flex flex-col border-t md:border-t-0">
            <div className="p-4 border-b bg-white">
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Icons.Search />
                </div>
                <input 
                  type="text"
                  placeholder="Cari penerima..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-black outline-none focus:ring-2 focus:ring-[#FFC000]"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll} className="flex-1 py-1 text-[10px] font-black uppercase text-[#806000] bg-[#FFFBEB] rounded-md hover:bg-[#FFF3C2]">Pilih Semua</button>
                <button onClick={deselectAll} className="flex-1 py-1 text-[10px] font-black uppercase text-slate-500 bg-slate-100 rounded-md hover:bg-slate-200">Kosongkan</button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-1 max-h-[250px] md:max-h-none">
              {filteredList.map(e => (
                <label key={e.id} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${selectedIds.has(e.id) ? 'bg-white border-[#FFD700] shadow-sm' : 'border-transparent hover:bg-slate-200'}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(e.id)}
                    onChange={() => toggleSelect(e.id)}
                    className="w-3.5 h-3.5 rounded text-[#FFC000] focus:ring-[#FFC000]"
                  />
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                      {e.photoBase64 || e.avatarUrl ? (
                        <img src={e.photoBase64 || e.avatarUrl} className="w-full h-full object-cover" alt="" />
                      ) : null}
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-bold text-slate-900 truncate">{e.nama}</p>
                      <p className="text-[9px] text-slate-500 truncate">{e.jabatan}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border-t flex gap-3">
          <button 
            onClick={handleSend}
            disabled={selectedIds.size === 0 || isSending}
            className="flex-1 bg-[#FFC000] hover:bg-[#E6AD00] disabled:bg-slate-300 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
          >
            {isSending ? 'Mengirim...' : <><Icons.Megaphone /> Kirim ke {selectedIds.size} Orang</>}
          </button>
          <button 
            onClick={onClose}
            className="px-6 bg-white border border-slate-200 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-all text-sm"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
