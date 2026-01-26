
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { Employee } from './types';
import { Icons } from './constants';
import EmployeeForm from './components/EmployeeForm';
import Dashboard from './components/Dashboard';
import SalarySlipModal from './components/SalarySlipModal';
import { calculateTenure } from './utils/dateUtils';

const App: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('hr_employees');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Gagal memuat data dari storage", e);
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [slipEmployee, setSlipEmployee] = useState<Employee | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaveStatus('saving');
    localStorage.setItem('hr_employees', JSON.stringify(employees));
    const timer = setTimeout(() => setSaveStatus('saved'), 800);
    return () => clearTimeout(timer);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.bank.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.noKtp.includes(searchQuery)
    );
  }, [employees, searchQuery]);

  const handleSave = (employee: Employee) => {
    if (editingEmployee) {
      setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
    } else {
      setEmployees(prev => [employee, ...prev]);
    }
    setIsFormOpen(false);
    setEditingEmployee(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus data karyawan ini?')) {
      setEmployees(prev => prev.filter(e => e.id !== id));
    }
  };

  const downloadTemplate = () => {
    const templateData = [{
      'Nama': 'Budi Santoso',
      'Tempat Lahir': 'Jakarta',
      'Tanggal Lahir': '1990-01-01',
      'Alamat': 'Jl. Contoh No. 123, Bogor',
      'No KTP': '3201234567890001',
      'No Handphone': '08123456789',
      'Tanggal Masuk': '2023-01-15',
      'Bank': 'BCA',
      'No Rekening': '1234567890',
      'Nama di Rekening': 'Budi Santoso'
    }];
    
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Format_Data_Karyawan.xlsx");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        console.log("Raw Excel Data:", jsonData); // Untuk debugging

        if (jsonData.length === 0) {
          alert("File Excel kosong atau format tidak didukung.");
          return;
        }

        // Fungsi pencarian kolom yang lebih toleran (menghapus spasi, titik, dan case-insensitive)
        const findVal = (row: any, keys: string[]) => {
          const rowKeys = Object.keys(row);
          const cleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          for (const k of keys) {
            const target = cleanKey(k);
            const match = rowKeys.find(rk => cleanKey(rk) === target);
            if (match) return row[match];
          }
          return '';
        };

        const formatDate = (val: any) => {
          if (!val) return '';
          const date = new Date(val);
          if (isNaN(date.getTime())) return '';
          return date.toISOString().split('T')[0];
        };

        const mappedData: Employee[] = jsonData
          .map((row: any, idx) => {
            const nama = String(findVal(row, ['Nama', 'Nama Lengkap', 'Nama Karyawan', 'Employee Name']) || '').trim();
            
            // Jika nama kosong, baris ini diabaikan
            if (!nama) return null;

            return {
              id: String(findVal(row, ['ID', 'id']) || `imp_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`),
              nama,
              noKtp: String(findVal(row, ['No KTP', 'NIK', 'Nomor KTP', 'KTP']) || ''),
              tempatLahir: String(findVal(row, ['Tempat Lahir', 'Tpt Lahir']) || ''),
              tanggalLahir: formatDate(findVal(row, ['Tanggal Lahir', 'Tgl Lahir', 'Birth Date'])),
              alamat: String(findVal(row, ['Alamat', 'Alamat Lengkap', 'Address']) || ''),
              noHandphone: String(findVal(row, ['No Handphone', 'No HP', 'Telepon', 'Phone']) || ''),
              tanggalMasuk: formatDate(findVal(row, ['Tanggal Masuk', 'Tgl Masuk', 'Join Date'])),
              bank: String(findVal(row, ['Bank', 'Nama Bank', 'Bank Name']) || 'BCA'),
              noRekening: String(findVal(row, ['No Rekening', 'Nomor Rekening', 'Norek', 'No Rek', 'Account Number']) || ''),
              namaDiRekening: String(findVal(row, ['Nama di Rekening', 'Nama Rekening', 'Atas Nama', 'Account Holder']) || nama),
              avatarUrl: `https://picsum.photos/seed/${nama}/200`
            };
          })
          .filter((item): item is Employee => item !== null);

        if (mappedData.length > 0) {
          if (window.confirm(`Ditemukan ${mappedData.length} data karyawan yang valid. Impor sekarang?`)) {
            setEmployees(prev => {
              const combined = [...mappedData, ...prev];
              // Filter agar tidak ada ID ganda (data baru dari Excel akan menang)
              return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            });
            alert("Data berhasil diimpor!");
          }
        } else {
          alert("Tidak ditemukan data karyawan yang valid dalam file tersebut. Pastikan kolom 'Nama' terisi.");
        }
      } catch (err) {
        console.error("Import error:", err);
        alert("Terjadi kesalahan saat membaca file. Pastikan Anda menggunakan file .xlsx atau .xls");
      }
      
      // Reset input agar bisa upload file yang sama jika perlu
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Icons.Users />
              </div>
              <h1 className="text-xl font-bold text-slate-800 hidden sm:block tracking-tight">HR-Smart</h1>
            </div>
            
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Icons.Search />
                </div>
                <input
                  type="text"
                  placeholder="Cari nama, NIK, atau bank..."
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 sm:text-sm transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all border border-slate-200"
                title="Unduh Format Excel"
              >
                <Icons.Download />
                <span className="hidden sm:inline">Format Excel</span>
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl transition-all shadow-lg shadow-emerald-100"
                title="Unggah Data Sekaligus"
              >
                <Icons.Upload />
                <span className="hidden sm:inline">Unggah Excel</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={importData} />

              <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

              <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-lg shadow-blue-200 transition-all text-sm">
                <Icons.Plus />
                <span className="hidden lg:inline">Tambah Manual</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Dashboard employees={employees} />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800">Daftar Karyawan</h2>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total {employees.length} staff perusahaan</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredEmployees.length} Ditampilkan</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Profil Karyawan</th>
                  <th className="px-6 py-4">NIK & Kontak</th>
                  <th className="px-6 py-4">Masa Kerja</th>
                  <th className="px-6 py-4">Data Bank</th>
                  <th className="px-6 py-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={emp.photoBase64 || emp.avatarUrl} alt={emp.nama} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                        <div>
                          <p className="font-bold text-slate-800 leading-tight">{emp.nama}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{emp.tempatLahir}, {emp.tanggalLahir}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{emp.noKtp}</p>
                      <p className="text-xs text-blue-600 font-bold">{emp.noHandphone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                        {calculateTenure(emp.tanggalMasuk)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{emp.bank}</p>
                      <p className="text-xs text-slate-500 font-mono">{emp.noRekening}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setSlipEmployee(emp)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Slip Gaji">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </button>
                        <button onClick={() => { setEditingEmployee(emp); setIsFormOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <Icons.Edit />
                        </button>
                        <button onClick={() => handleDelete(emp.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="flex flex-col items-center opacity-40">
                        <div className="bg-slate-100 p-4 rounded-full mb-4">
                          <Icons.Users />
                        </div>
                        <p className="text-sm font-bold text-slate-800">Database Kosong</p>
                        <p className="text-xs text-slate-500 max-w-xs mt-1">Silakan unduh format Excel, isi data karyawan, lalu unggah kembali untuk mengisi data sekaligus.</p>
                        <button onClick={downloadTemplate} className="text-blue-600 text-xs mt-4 font-bold border-b border-blue-600 hover:text-blue-700">Unduh Format Excel Sekarang</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isFormOpen && (
        <EmployeeForm 
          initialData={editingEmployee}
          onSave={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingEmployee(null); }}
        />
      )}

      {slipEmployee && (
        <SalarySlipModal 
          employee={slipEmployee}
          onClose={() => setSlipEmployee(null)}
        />
      )}
    </div>
  );
};

export default App;
