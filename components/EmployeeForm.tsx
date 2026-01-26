
import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { BANK_OPTIONS } from '../constants';

interface EmployeeFormProps {
  initialData: Employee | null;
  onSave: (employee: Employee) => void;
  onCancel: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    nama: '',
    tempatLahir: '',
    tanggalLahir: '',
    alamat: '',
    noKtp: '',
    noHandphone: '',
    tanggalMasuk: '',
    bank: BANK_OPTIONS[0],
    noRekening: '',
    namaDiRekening: '',
    avatarUrl: '',
    photoBase64: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData(prev => ({
        ...prev,
        avatarUrl: `https://picsum.photos/seed/${Math.random()}/200`
      }));
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoBase64: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: initialData?.id || Date.now().toString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Ubah Data Karyawan' : 'Tambah Karyawan Baru'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-50">
                {(formData.photoBase64 || formData.avatarUrl) ? (
                  <img 
                    src={formData.photoBase64 || formData.avatarUrl} 
                    className="w-full h-full object-cover" 
                    alt="Preview"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                )}
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <p className="text-xs text-slate-500 mt-2">Upload Foto Karyawan</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
              <input 
                required 
                name="nama" 
                value={formData.nama} 
                onChange={handleChange} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
                placeholder="Contoh: Budi Santoso" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Nomor KTP</label>
              <input 
                required 
                name="noKtp" 
                value={formData.noKtp} 
                onChange={handleChange} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
                placeholder="16 Digit NIK" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tempat Lahir</label>
              <input 
                required 
                name="tempatLahir" 
                value={formData.tempatLahir} 
                onChange={handleChange} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
                placeholder="Kota Kelahiran" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tanggal Lahir</label>
              <input 
                required 
                type="date" 
                name="tanggalLahir" 
                value={formData.tanggalLahir} 
                onChange={handleChange} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Alamat Lengkap</label>
              <textarea 
                required 
                name="alamat" 
                value={formData.alamat} 
                onChange={handleChange} 
                rows={2} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
                placeholder="Jl. Raya No. 123..." 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">No. Handphone</label>
              <input 
                required 
                name="noHandphone" 
                value={formData.noHandphone} 
                onChange={handleChange} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
                placeholder="08xxxxxxxxx" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tanggal Masuk</label>
              <input 
                required 
                type="date" 
                name="tanggalMasuk" 
                value={formData.tanggalMasuk} 
                onChange={handleChange} 
                className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 shadow-sm transition-all" 
              />
            </div>

            {/* SECTION: Bank Settings */}
            <div className="pt-6 border-t md:col-span-2 bg-slate-50/50 -mx-6 px-6 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <h3 className="text-md font-bold text-slate-800">Bank Settings (Pengaturan Bank)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Name</label>
                  <select 
                    name="bank" 
                    value={formData.bank} 
                    onChange={handleChange} 
                    className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-slate-900 font-medium"
                  >
                    {BANK_OPTIONS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Number</label>
                  <input 
                    required 
                    name="noRekening" 
                    value={formData.noRekening} 
                    onChange={handleChange} 
                    className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-slate-900 font-bold" 
                    placeholder="Digit Rekening" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Holder Name</label>
                  <input 
                    required 
                    name="namaDiRekening" 
                    value={formData.namaDiRekening} 
                    onChange={handleChange} 
                    className="w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-slate-900 font-medium" 
                    placeholder="Sesuai Buku Tabungan" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">
              Simpan Data Karyawan
            </button>
            <button type="button" onClick={onCancel} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-3 rounded-xl transition-all active:scale-[0.98]">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
