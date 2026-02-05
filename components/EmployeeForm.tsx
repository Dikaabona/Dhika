
import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { BANK_OPTIONS, Icons } from '../constants';

interface EmployeeFormProps {
  initialData: Employee | null;
  employees: Employee[];
  userRole: string;
  userCompany: string;
  onSave: (employee: Employee) => void;
  onCancel: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ initialData, employees, userRole, userCompany, onSave, onCancel }) => {
  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const isAdmin = userRole === 'admin';
  // System Admin (Owner, Super, Admin) can edit restricted fields
  const isSystemAdmin = isOwner || isSuper || isAdmin;
  
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    idKaryawan: '',
    nama: '',
    jabatan: '',
    email: '',
    tempatLahir: '',
    tanggalLahir: '',
    alamat: '',
    noKtp: '',
    noHandphone: '',
    tanggalMasuk: '',
    bank: BANK_OPTIONS[0],
    noRekening: '',
    namaDiRekening: '',
    company: userCompany,
    avatarUrl: '',
    photoBase64: '',
    hutang: 0,
    isRemoteAllowed: false,
    ktpDocBase64: '',
    ktpDocType: 'image',
    contractDocBase64: ''
  });

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData({
        ...rest,
        hutang: rest.hutang || 0,
        isRemoteAllowed: rest.isRemoteAllowed || false
      });
    } else {
      const generateNextSequentialId = (list: Employee[]) => {
        const ids = list
          .map(e => {
            const match = (e.idKaryawan || '').match(/VID-(\d+)/);
            return match ? parseInt(match[1], 10) : null;
          })
          .filter((id): id is number => id !== null);
        const maxId = ids.length > 0 ? Math.max(...ids) : 7250;
        return `VID-${maxId + 1}`;
      };
      
      const nextId = generateNextSequentialId(employees);
      const today = new Date();
      const formattedToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      
      setFormData(prev => ({
        ...prev,
        idKaryawan: nextId,
        avatarUrl: '',
        tanggalMasuk: formattedToday,
        company: userCompany,
        hutang: 0,
        isRemoteAllowed: false
      }));
    }
  }, [initialData, employees, userCompany]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Perbaikan: Izinkan System Admin (termasuk Ariyansyah/Admin) mengubah field ini
    const restrictedFields = ['idKaryawan', 'jabatan', 'tanggalMasuk', 'hutang', 'company'];
    if (!isSystemAdmin && restrictedFields.includes(name)) return;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }

    if (['noRekening', 'noKtp', 'noHandphone', 'hutang'].includes(name)) {
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: name === 'hutang' ? Number(numericValue) : numericValue }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      if (field === 'photo') {
        const resized = await new Promise<string>((resolve) => {
          const img = new Image();
          img.src = base64;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const SIZE = 300;
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const minSize = Math.min(img.width, img.height);
              const startX = (img.width - minSize) / 2;
              const startY = (img.height - minSize) / 2;
              ctx.drawImage(img, startX, startY, minSize, minSize, 0, 0, SIZE, SIZE);
              
              let quality = 0.7;
              let res = canvas.toDataURL('image/jpeg', quality);
              while (res.length * 0.75 > 100000 && quality > 0.1) {
                quality -= 0.1;
                res = canvas.toDataURL('image/jpeg', quality);
              }
              resolve(res);
            } else {
              resolve(base64);
            }
          };
        });
        setFormData(prev => ({ ...prev, photoBase64: resized }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: initialData?.id || Date.now().toString()
    });
  };

  const getSystemRoleDisplay = (email: string) => {
    const emailLower = email.toLowerCase();
    if (emailLower === 'muhammadmahardhikadib@gmail.com') {
      return { label: 'OWNER', color: 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300' };
    }
    if (emailLower === 'rezaajidharma@gmail.com') {
      return { label: 'SUPER ADMIN', color: 'bg-amber-400 text-black' };
    }
    if (emailLower === 'fikryadityar93@gmail.com' || emailLower === 'ariyansyah02122002@gmail.com') {
      return { label: 'ADMIN SYSTEM', color: 'bg-slate-800 text-white' };
    }
    return null;
  };

  const sysRole = getSystemRoleDisplay(formData.email);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="px-10 py-8 border-b flex justify-between items-center bg-[#ffdc04] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-black tracking-tight">{initialData ? 'Perbarui Data' : 'Registrasi Baru'}</h2>
          </div>
          <button onClick={onCancel} className="text-black hover:text-red-600 transition-colors text-3xl p-2 leading-none font-black">&times;</button>
        </div>
        <form id="employee-form" onSubmit={handleSubmit} className="px-10 py-8 space-y-8 overflow-y-auto flex-grow bg-white custom-scrollbar">
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 shadow-lg bg-slate-50 relative flex items-center justify-center">
                  {formData.photoBase64 ? <img src={formData.photoBase64} alt="Profile" className="w-full h-full object-cover" /> : <Icons.Users />}
                  <label htmlFor="photo-upload" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Icons.Plus className="text-white" /></label>
                </div>
                <input type="file" id="photo-upload" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'photo')} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-[#FFFBEB] p-5 rounded-[24px] border border-[#FFD700]">
                 <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5 block">ID KARYAWAN RESMI</label>
                 <input required name="idKaryawan" readOnly={!isSystemAdmin} value={formData.idKaryawan} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-[#FFD700] rounded-xl text-lg font-bold text-black outline-none" />
               </div>
               <div className="bg-sky-50 p-5 rounded-[24px] border border-sky-100">
                 <label className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-1.5 block">COMPANY</label>
                 <input required name="company" readOnly={!isSystemAdmin} value={formData.company} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-sky-100 rounded-xl text-lg font-bold text-slate-900 outline-none" />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nama Lengkap</label>
                <input required name="nama" value={formData.nama} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Jabatan</label>
                <input required name="jabatan" readOnly={!isSystemAdmin} value={formData.jabatan} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tempat Lahir</label>
                <input required name="tempatLahir" value={formData.tempatLahir} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tanggal Lahir</label>
                <input required name="tanggalLahir" value={formData.tanggalLahir} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Email</label>
                  {sysRole && (
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black ${sysRole.color}`}>{sysRole.label}</span>
                  )}
                </div>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor HP</label>
                <input required name="noHandphone" value={formData.noHandphone} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor KTP</label>
                <input required name="noKtp" value={formData.noKtp} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tanggal Masuk</label>
                <input required name="tanggalMasuk" readOnly={!isSystemAdmin} value={formData.tanggalMasuk} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Hutang Karyawan (Rp)</label>
                <input name="hutang" readOnly={!isSystemAdmin} value={formData.hutang || 0} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-black outline-none focus:bg-white transition-all text-lg" />
              </div>
              <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <input 
                  type="checkbox" 
                  name="isRemoteAllowed" 
                  checked={formData.isRemoteAllowed} 
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-emerald-200 text-emerald-600 focus:ring-emerald-500" 
                />
                <label className="text-[10px] text-emerald-800 font-black uppercase tracking-widest">Izinkan Absen Remote (Individu)</label>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Alamat</label>
              <textarea required name="alamat" value={formData.alamat} onChange={handleChange} rows={3} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
            </div>
            <div className="pt-6 border-t"><label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 block">REKENING</label>
              <div className="grid grid-cols-3 gap-4">
                <select name="bank" value={formData.bank} onChange={handleChange} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs font-bold text-black outline-none focus:bg-white transition-all">{BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}</select>
                <input required name="noRekening" value={formData.noRekening} onChange={handleChange} placeholder="Rekening" className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm font-bold text-black outline-none focus:bg-white transition-all" />
                <input required name="namaDiRekening" value={formData.namaDiRekening} onChange={handleChange} placeholder="Nama Di Rekening" className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm font-bold text-black outline-none focus:bg-white transition-all" />
              </div>
            </div>
          </div>
        </form>
        <div className="px-10 py-8 border-t bg-slate-50 flex gap-5 shrink-0">
          <button type="submit" form="employee-form" className="flex-1 bg-slate-900 text-[#ffdc04] py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all">Simpan</button>
          <button type="button" onClick={onCancel} className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-5 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition-all">Batal</button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeForm;
