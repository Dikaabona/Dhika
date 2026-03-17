import React, { useState } from 'react';
import { Employee } from '../types';
import { Icons } from '../constants';
import { calculateTenure } from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';

interface EmployeeDetailModalProps {
  employee: Employee;
  userRole: string;
  onClose: () => void;
  onUpdate?: () => void;
}

interface InfoRowProps {
  label: string;
  value: string | number | undefined;
  field?: keyof Employee;
  type?: string;
  isEditing: boolean;
  editedEmployee: Employee;
  setEditedEmployee: (emp: Employee) => void;
  branches?: string[];
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, field, type = 'text', isEditing, editedEmployee, setEditedEmployee, branches = [] }) => {
  const statusOptions = ['Tetap', 'Kontrak', 'Probation', 'Freelance'];
  const maritalOptions = ['Menikah', 'Lajang'];
  const religionOptions = ['Islam', 'Kristen', 'Protestan', 'Hindu', 'Budha', 'Konghucu'];

  return (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0 items-center">
      <span className="text-xs text-slate-500">{label}</span>
      {isEditing && field ? (
        field === 'statusKaryawan' ? (
          <select
            value={value || 'Tetap'}
            onChange={(e) => setEditedEmployee({ ...editedEmployee, [field]: e.target.value })}
            className="text-xs font-semibold text-slate-800 text-right bg-slate-50 px-2 py-1 rounded border border-slate-200 outline-none focus:border-[#FFC000] max-w-[60%]"
          >
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : field === 'statusNikah' ? (
          <select
            value={value || 'Lajang'}
            onChange={(e) => setEditedEmployee({ ...editedEmployee, [field]: e.target.value })}
            className="text-xs font-semibold text-slate-800 text-right bg-slate-50 px-2 py-1 rounded border border-slate-200 outline-none focus:border-[#FFC000] max-w-[60%]"
          >
            {maritalOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : field === 'agama' ? (
          <select
            value={value || 'Islam'}
            onChange={(e) => setEditedEmployee({ ...editedEmployee, [field]: e.target.value })}
            className="text-xs font-semibold text-slate-800 text-right bg-slate-50 px-2 py-1 rounded border border-slate-200 outline-none focus:border-[#FFC000] max-w-[60%]"
          >
            {religionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : field === 'lokasiKerja' && branches.length > 0 ? (
          <select
            value={value || ''}
            onChange={(e) => setEditedEmployee({ ...editedEmployee, [field]: e.target.value })}
            className="text-xs font-semibold text-slate-800 text-right bg-slate-50 px-2 py-1 rounded border border-slate-200 outline-none focus:border-[#FFC000] max-w-[60%]"
          >
            <option value="">Pilih Cabang</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <input 
            type={type}
            value={value || ''}
            onChange={(e) => setEditedEmployee({ ...editedEmployee, [field]: e.target.value })}
            className="text-xs font-semibold text-slate-800 text-right bg-slate-50 px-2 py-1 rounded border border-slate-200 outline-none focus:border-[#FFC000] max-w-[60%]"
          />
        )
      ) : (
        <span className="text-xs font-semibold text-slate-800 text-right max-w-[60%]">{value || '-'}</span>
      )}
    </div>
  );
};

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="bg-[#FFC000] px-4 py-2 flex items-center gap-2 rounded-t-xl">
    <Icon className="w-4 h-4 text-black" />
    <span className="text-xs font-bold text-black uppercase tracking-wider">{title}</span>
  </div>
);

const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ employee, userRole, onClose, onUpdate }) => {
  const [activeSubView, setActiveSubView] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEmployee, setEditedEmployee] = useState<Employee>(employee);
  const [branches, setBranches] = useState<string[]>([]);

  React.useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `attendance_settings_${employee.company}`)
          .single();
        
        if (data?.value?.branches) {
          setBranches(data.value.branches.map((b: any) => b.name));
        }
      } catch (e) {}
    };
    fetchBranches();
  }, [employee.company]);

  const handleSave = async () => {
    try {
      const { error } = await supabase.from('employees').update({
        idKaryawan: editedEmployee.idKaryawan,
        tanggalMasuk: editedEmployee.tanggalMasuk,
        division: editedEmployee.division,
        jabatan: editedEmployee.jabatan,
        tempatLahir: editedEmployee.tempatLahir,
        gender: editedEmployee.gender,
        noKtp: editedEmployee.noKtp,
        noHandphone: editedEmployee.noHandphone,
        alamat: editedEmployee.alamat,
        statusNikah: editedEmployee.statusNikah,
        agama: editedEmployee.agama,
        golonganDarah: editedEmployee.golonganDarah,
        jenjangPendidikan: editedEmployee.jenjangPendidikan,
        lembagaPendidikan: editedEmployee.lembagaPendidikan,
        tahunLulus: editedEmployee.tahunLulus,
        nilaiPendidikan: editedEmployee.nilaiPendidikan,
        statusPtkp: editedEmployee.statusPtkp,
        tahunPtkp: editedEmployee.tahunPtkp,
        kelurahan: editedEmployee.kelurahan,
        kecamatan: editedEmployee.kecamatan,
        kota: editedEmployee.kota,
        kodePos: editedEmployee.kodePos,
        lokasiKerja: editedEmployee.lokasiKerja,
        statusKaryawan: editedEmployee.statusKaryawan,
        masaProbation: editedEmployee.masaProbation,
        bpjsKetenagakerjaan: editedEmployee.bpjsKetenagakerjaan,
        bpjsKesehatan: editedEmployee.bpjsKesehatan,
        email: editedEmployee.email,
        resigned_at: editedEmployee.resigned_at,
        sisaCuti: editedEmployee.sisaCuti
      }).eq('id', employee.id);

      if (error) throw error;
      setIsEditing(false);
      if (onUpdate) onUpdate();
      alert('Data berhasil diperbarui');
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    }
  };

  const menuItems = [
    { id: 'personal', label: 'Informasi personal', icon: Icons.User },
    { id: 'employment', label: 'Informasi kepegawaian', icon: Icons.Building },
    { id: 'password', label: 'Ubah password', icon: Icons.Lock },
    { id: 'pin', label: 'Ubah PIN', icon: Icons.Hash },
  ];

  if (activeSubView === 'employment') {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
        <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-2xl bg-[#f8fafc] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
          {/* Yellow Header */}
          <div className="bg-[#FFC000] px-6 pt-12 pb-6 md:pt-10 md:pb-8 relative shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => { setActiveSubView(null); setIsEditing(false); }} className="text-black hover:bg-black/10 p-2 rounded-full transition-colors">
                <Icons.ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-black">Informasi kepegawaian</h1>
            </div>
            <div className="flex gap-2">
              {(userRole === 'owner' || userRole === 'super') && (
                isEditing ? (
                  <button 
                    onClick={handleSave}
                    className="bg-black text-white px-6 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-transform"
                  >
                    Simpan
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="bg-white text-black px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-transform hover:bg-slate-50"
                  >
                    <Icons.Edit className="w-3 h-3" /> Ubah
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-4">
            {/* Informasi Kepegawaian */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <SectionHeader title="Informasi kepegawaian" icon={Icons.Briefcase} />
              <div className="p-5 space-y-1">
                <InfoRow label="NIK" value={editedEmployee.idKaryawan} field="idKaryawan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Email" value={editedEmployee.email} field="email" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Tanggal masuk kerja" value={editedEmployee.tanggalMasuk} field="tanggalMasuk" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Kontrak berakhir" value={editedEmployee.resigned_at || ''} field="resigned_at" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Status karyawan" value={editedEmployee.statusKaryawan} field="statusKaryawan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Lokasi kerja" value={editedEmployee.lokasiKerja} field="lokasiKerja" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} branches={branches} />
                <InfoRow label="Divisi" value={editedEmployee.division} field="division" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Jabatan" value={editedEmployee.jabatan} field="jabatan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Sisa Cuti" value={editedEmployee.sisaCuti} field="sisaCuti" type="number" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
              </div>
            </div>

            {/* Informasi BPJS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <SectionHeader title="Informasi BPJS" icon={Icons.Users} />
              <div className="p-5 space-y-1">
                <InfoRow label="No BPJS Ketenagakerjaan" value={editedEmployee.bpjsKetenagakerjaan} field="bpjsKetenagakerjaan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="No BPJS Kesehatan" value={editedEmployee.bpjsKesehatan} field="bpjsKesehatan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubView === 'personal') {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
        <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-2xl bg-[#f8fafc] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
          {/* Yellow Header */}
          <div className="bg-[#FFC000] px-6 pt-12 pb-6 md:pt-10 md:pb-8 relative shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => { setActiveSubView(null); setIsEditing(false); }} className="text-black hover:bg-black/10 p-2 rounded-full transition-colors">
                <Icons.ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-black">Informasi personal</h1>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <button 
                  onClick={handleSave}
                  className="bg-black text-white px-6 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-transform"
                >
                  Simpan
                </button>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-white text-black px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-transform hover:bg-slate-50"
                >
                  <Icons.Edit className="w-3 h-3" /> Ubah
                </button>
              )}
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6">
            {/* Informasi Umum */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <SectionHeader title="Informasi umum" icon={Icons.Users} />
              <div className="p-5 space-y-1">
                <InfoRow label="Tempat lahir" value={editedEmployee.tempatLahir} field="tempatLahir" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Jenis kelamin" value={editedEmployee.gender} field="gender" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Status nikah" value={editedEmployee.statusNikah} field="statusNikah" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Agama" value={editedEmployee.agama} field="agama" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Nomor KTP" value={editedEmployee.noKtp} field="noKtp" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Nomor handphone" value={editedEmployee.noHandphone} field="noHandphone" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Golongan darah" value={editedEmployee.golonganDarah} field="golonganDarah" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
              </div>
            </div>

            {/* Pendidikan Terakhir */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <SectionHeader title="Pendidikan terakhir" icon={Icons.GraduationCap} />
              <div className="p-5 space-y-1">
                <InfoRow label="Jenjang pendidikan" value={editedEmployee.jenjangPendidikan} field="jenjangPendidikan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Lembaga pendidikan" value={editedEmployee.lembagaPendidikan} field="lembagaPendidikan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Tahun lulus" value={editedEmployee.tahunLulus} field="tahunLulus" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Nilai" value={editedEmployee.nilaiPendidikan} field="nilaiPendidikan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
              </div>
            </div>

            {/* Informasi Status PTKP */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <SectionHeader title="Informasi status PTKP" icon={Icons.FileText} />
              <div className="p-5 space-y-1">
                <InfoRow label="Status PTKP" value={editedEmployee.statusPtkp} field="statusPtkp" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Tahun efektif berlaku" value={editedEmployee.tahunPtkp} field="tahunPtkp" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
              </div>
            </div>

            {/* Alamat KTP */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <SectionHeader title="Alamat KTP" icon={Icons.Home} />
              <div className="p-5 space-y-1">
                <InfoRow label="Alamat" value={editedEmployee.alamat} field="alamat" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Kelurahan" value={editedEmployee.kelurahan} field="kelurahan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Kecamatan" value={editedEmployee.kecamatan} field="kecamatan" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Kota" value={editedEmployee.kota} field="kota" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
                <InfoRow label="Kode pos" value={editedEmployee.kodePos} field="kodePos" isEditing={isEditing} editedEmployee={editedEmployee} setEditedEmployee={setEditedEmployee} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubView === 'password' || activeSubView === 'pin') {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
        <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-md bg-[#f8fafc] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
          {/* Yellow Header */}
          <div className="bg-[#FFC000] px-6 pt-12 pb-6 md:pt-10 md:pb-8 relative shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveSubView(null)} className="text-black hover:bg-black/10 p-2 rounded-full transition-colors">
                <Icons.ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-black">
                {activeSubView === 'password' ? 'Ubah Password' : 'Ubah PIN'}
              </h1>
            </div>
          </div>

          <div className="flex-grow p-6 md:p-10 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {activeSubView === 'password' ? 'Password Baru' : 'PIN Baru (6 Digit)'}
                </label>
                <input 
                  type={activeSubView === 'password' ? 'password' : 'number'}
                  placeholder={activeSubView === 'password' ? 'Masukkan password baru' : 'Masukkan 6 digit PIN'}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Konfirmasi</label>
                <input 
                  type={activeSubView === 'password' ? 'password' : 'number'}
                  placeholder="Ketik ulang untuk konfirmasi"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                />
              </div>
              <button className="w-full bg-black text-white py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-transform mt-4">
                Simpan Perubahan
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center px-4">
              {activeSubView === 'password' 
                ? 'Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.' 
                : 'PIN digunakan untuk verifikasi cepat pada beberapa fitur aplikasi.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[250] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-500">
      <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl bg-white md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
        {/* Yellow Header */}
        <div className="bg-[#FFC000] px-6 pt-12 pb-10 md:pt-14 md:pb-14 relative shrink-0">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button onClick={onClose} className="text-black hover:bg-black/10 p-2 rounded-full transition-colors">
                <Icons.ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-black">Profil</h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-white/20 shadow-lg shrink-0">
              {employee.photoBase64 || employee.avatarUrl ? (
                <img src={employee.photoBase64 || employee.avatarUrl} className="w-full h-full object-cover" alt={employee.nama} />
              ) : (
                <Icons.Users className="w-12 h-12 md:w-16 md:h-16 text-slate-300" />
              )}
            </div>
            <div className="text-black">
              <h2 className="text-2xl md:text-4xl font-bold leading-tight">{employee.nama}</h2>
              <p className="text-sm md:text-base opacity-70 mt-1 font-medium tracking-wider">{employee.idKaryawan}</p>
            </div>
          </div>
        </div>

        {/* Menu List */}
        <div className="flex-grow overflow-y-auto bg-white">
          <div className="px-2 py-4">
            {menuItems.map((item, index) => (
              <button 
                key={index}
                onClick={() => setActiveSubView(item.id)}
                className="w-full flex items-center justify-between px-6 py-5 md:py-6 border-b border-slate-50 hover:bg-slate-50 transition-all group rounded-2xl mb-1"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#FFC000]/10 group-hover:text-[#FFC000] transition-colors">
                    <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-[15px] md:text-lg font-semibold text-slate-700">{item.label}</span>
                </div>
                <Icons.ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;