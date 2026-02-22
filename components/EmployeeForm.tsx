import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee } from '../types';
import { BANK_OPTIONS, Icons } from '../constants';
import { supabase } from '../App';

interface EmployeeFormProps {
  initialData: Employee | null;
  employees: Employee[];
  userRole: string;
  userCompany: string;
  currentUserEmployee: Employee | null; 
  onSave: (employee: Employee) => void;
  onCancel: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ initialData, employees, userRole, userCompany, currentUserEmployee, onSave, onCancel }) => {
  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const isSystemAdmin = isOwner || isSuper;

  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    idKaryawan: '',
    nama: '',
    jabatan: '',
    division: '',
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
    gender: 'Laki-laki',
    avatarUrl: '',
    photoBase64: '',
    hutang: 0,
    isRemoteAllowed: false,
    ktpDocBase64: '',
    ktpDocType: 'image',
    contractDocBase64: ''
  });

  const [divisions, setDivisions] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allCompanies = useMemo(() => {
    const companies = Array.from(new Set(employees.map(e => e.company || 'Visibel')));
    if (!companies.includes(userCompany)) companies.push(userCompany);
    return companies.sort();
  }, [employees, userCompany]);

  useEffect(() => {
    if (formData.company) {
      fetchSettings(formData.company);
    }
  }, [formData.company]);

  const fetchSettings = async (targetCompany: string) => {
    setDivisions([]);
    setPositions([]);
    try {
      const { data: divData } = await supabase.from('settings').select('value').eq('key', `divisions_${targetCompany}`).single();
      if (divData && Array.isArray(divData.value)) {
        setDivisions(divData.value);
      } else {
        setDivisions([]);
      }

      const { data: posData } = await supabase.from('settings').select('value').eq('key', `positions_${targetCompany}`).single();
      if (posData && Array.isArray(posData.value)) {
        // Normalize positions to string array to avoid React Error #31
        const normalized = posData.value.map((p: any) => 
          typeof p === 'string' ? p : (p.name || '')
        );
        setPositions(normalized);
      } else {
        setPositions([]);
      }
    } catch (e) {
      setDivisions([]);
      setPositions([]);
    }
  };

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData({
        ...rest,
        hutang: rest.hutang || 0,
        isRemoteAllowed: rest.isRemoteAllowed || false
      });
    } else {
      const generateNextSequentialId = (list: Employee[], currentCompany: string) => {
        const isSellerSpace = currentCompany.toLowerCase().includes('seller space');
        const prefix = isSellerSpace ? 'SS-' : 'VID-';
        const regex = new RegExp(`${prefix}(\\d+)`);

        const ids = list
          .filter(e => (e.company || '').toLowerCase() === currentCompany.toLowerCase())
          .map(e => {
            const match = (e.idKaryawan || '').match(regex);
            return match ? parseInt(match[1], 10) : null;
          })
          .filter((id): id is number => id !== null);

        const defaultStart = isSellerSpace ? 0 : 7250;
        const maxId = ids.length > 0 ? Math.max(...ids) : defaultStart;
        const nextNum = maxId + 1;
        
        if (isSellerSpace) {
          return `SS-${nextNum.toString().padStart(2, '0')}`;
        }
        return `VID-${nextNum}`;
      };
      
      const nextId = generateNextSequentialId(employees, formData.company);
      const today = new Date();
      const formattedToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      
      setFormData(prev => ({
        ...prev,
        idKaryawan: nextId,
        avatarUrl: '',
        tanggalMasuk: formattedToday,
        company: formData.company || userCompany,
        hutang: 0,
        isRemoteAllowed: false
      }));
    }
  }, [initialData, employees, userCompany]);

  const formatCurrencyInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '0';
    return new Intl.NumberFormat('id-ID').format(parseInt(numericValue));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    const restrictedFields = ['idKaryawan', 'jabatan', 'tanggalMasuk', 'hutang', 'isRemoteAllowed'];
    if (!isSystemAdmin && restrictedFields.includes(name)) return;

    if (name === 'company' && !isOwner) return;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === 'hutang') {
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: Number(numericValue) }));
      return;
    }

    if (['noRekening', 'noKtp', 'noHandphone'].includes(name)) {
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: numericValue }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.tempatLahir.trim()) {
      newErrors.tempatLahir = "Tempat lahir wajib diisi.";
    }

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(formData.tanggalLahir)) {
      newErrors.tanggalLahir = "Format harus DD/MM/YYYY (contoh: 01/01/1995).";
    }

    if (formData.noKtp.length !== 16) {
      newErrors.noKtp = "Nomor KTP harus tepat 16 digit.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // RULE DATA BENTROK / DOUBLE
    const isDuplicateId = employees.some(emp => 
      emp.idKaryawan.trim().toUpperCase() === formData.idKaryawan.trim().toUpperCase() && 
      emp.id !== initialData?.id
    );
    const isDuplicateEmail = employees.some(emp => 
      emp.email.trim().toLowerCase() === formData.email.trim().toLowerCase() && 
      emp.id !== initialData?.id
    );

    if (isDuplicateId || isDuplicateEmail) {
      alert("DATA BENTROK! ID Karyawan atau Email ini sudah terdaftar dalam sistem. Silakan periksa kembali.");
      return;
    }

    onSave({
      ...formData,
      id: initialData?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
                 <input required name="idKaryawan" readOnly={!isSystemAdmin} value={formData.idKaryawan} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-[#FFD700] rounded-xl text-lg font-bold text-black outline-none disabled:opacity-70" />
               </div>
               <div className="bg-sky-50 p-5 rounded-[24px] border border-sky-100">
                 <label className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-1.5 block">COMPANY</label>
                 {isOwner ? (
                   <select 
                     name="company" 
                     value={formData.company} 
                     onChange={handleChange} 
                     className="w-full px-4 py-2 bg-white border border-sky-100 rounded-xl text-lg font-bold text-slate-900 outline-none"
                   >
                     {allCompanies.map((c: string) => <option key={c} value={c}>{c}</option>)}
                   </select>
                 ) : (
                   <input required name="company" readOnly value={formData.company} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-sky-100 rounded-xl text-lg font-bold text-slate-900 outline-none disabled:opacity-70" />
                 )}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nama Lengkap</label>
                <input required name="nama" value={formData.nama} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Divisi</label>
                <select name="division" value={formData.division} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all">
                  <option value="">Pilih Divisi...</option>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Jabatan</label>
                <select 
                  required 
                  name="jabatan" 
                  disabled={!isSystemAdmin} 
                  value={formData.jabatan} 
                  onChange={handleChange} 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all disabled:opacity-70"
                >
                  <option value="">Pilih Jabatan...</option>
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                  {formData.jabatan && !positions.includes(formData.jabatan) && (
                    <option value={formData.jabatan}>{formData.jabatan}</option>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tempat Lahir</label>
                <input required name="tempatLahir" value={formData.tempatLahir} onChange={handleChange} className={`w-full px-5 py-3 bg-slate-50 border rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all ${errors.tempatLahir ? 'border-rose-500' : 'border-slate-100'}`} />
                {errors.tempatLahir && <p className="text-[10px] text-rose-500 font-bold uppercase">{errors.tempatLahir}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tanggal Lahir (DD/MM/YYYY)</label>
                <input required name="tanggalLahir" value={formData.tanggalLahir} onChange={handleChange} placeholder="01/01/1995" className={`w-full px-5 py-3 bg-slate-50 border rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all ${errors.tanggalLahir ? 'border-rose-500' : 'border-slate-100'}`} />
                {errors.tanggalLahir && <p className="text-[10px] text-rose-500 font-bold uppercase">{errors.tanggalLahir}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Email (Login Google)</label>
                  {sysRole && (
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black ${sysRole.color}`}>{sysRole.label}</span>
                  )}
                </div>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Jenis Kelamin</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all">
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor HP</label>
                <input required name="noHandphone" value={formData.noHandphone} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor KTP (16 Digit)</label>
                <input required name="noKtp" value={formData.noKtp} onChange={handleChange} maxLength={16} className={`w-full px-5 py-3 bg-slate-50 border rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all ${errors.noKtp ? 'border-rose-500' : 'border-slate-100'}`} />
                {errors.noKtp && <p className="text-[10px] text-rose-500 font-bold uppercase">{errors.noKtp}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tanggal Masuk</label>
                <input required name="tanggalMasuk" readOnly={!isSystemAdmin} value={formData.tanggalMasuk} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-black outline-none focus:bg-white transition-all disabled:opacity-70" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Hutang Karyawan (Rp)</label>
                <div className="relative">
                  <input name="hutang" readOnly={!isSystemAdmin} value={formatCurrencyInput(String(formData.hutang || 0))} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-black outline-none focus:bg-white transition-all text-lg disabled:opacity-70 pl-12" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rp</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <input 
                  type="checkbox" 
                  name="isRemoteAllowed" 
                  disabled={!isSystemAdmin}
                  checked={formData.isRemoteAllowed} 
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-emerald-200 text-emerald-600 focus:ring-emerald-500" 
                />
                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Izinkan Absen Remote (Individu)</label>
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