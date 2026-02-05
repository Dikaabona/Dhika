
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../constants';
import { supabase } from '../App';
import { AttendanceSettings, Employee } from '../types';

interface SettingsModuleProps {
  userRole: string;
  userCompany: string;
  onRefresh: () => void;
}

type SubTab = 'MAPS' | 'ROLE';

const SettingsModule: React.FC<SettingsModuleProps> = ({ userRole, userCompany, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('MAPS');
  const [selectedCompany, setSelectedCompany] = useState<string>(userCompany);
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  
  const [settings, setSettings] = useState<AttendanceSettings>({
    locationName: 'Visibel Office',
    latitude: -6.1754,
    longitude: 106.8272,
    radius: 100,
    allowRemote: false
  });
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchEmp, setSearchEmp] = useState('');

  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const canAccessRoleManagement = isOwner || isSuper;

  useEffect(() => {
    fetchSettingsAndEmployees();
    if (isOwner) fetchAllCompanies();
  }, [selectedCompany, isOwner]);

  const fetchAllCompanies = async () => {
    try {
      const { data, error } = await supabase.from('employees').select('company');
      if (error) throw error;
      const unique = Array.from(new Set(data.map(e => e.company || 'Visibel'))).sort();
      setAllCompanies(unique);
    } catch (err) {
      console.error("Gagal memuat daftar perusahaan:", err);
    }
  };

  const fetchSettingsAndEmployees = async () => {
    setIsLoading(true);
    try {
      // Fetch settings for the currently selected company (Owner can switch, others fixed to their own)
      const targetCompany = isOwner ? selectedCompany : userCompany;
      
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `attendance_settings_${targetCompany}`)
        .single();
      
      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      if (settingsData) setSettings(settingsData.value);

      // Fetch employees based on role & company
      let query = supabase.from('employees').select('*').order('nama', { ascending: true });
      
      // Super admin only sees their company, Owner sees the selected context
      query = query.eq('company', targetCompany);

      const { data: empData, error: empError } = await query;

      if (empError) throw empError;
      setEmployees(empData || []);
    } catch (err: any) {
      console.error("Gagal memuat data:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { error: settingsError } = await supabase.from('settings').upsert({
        key: `attendance_settings_${targetCompany}`,
        value: settings
      }, { onConflict: 'key' });
      
      if (settingsError) throw settingsError;
      alert("Pengaturan sistem berhasil diperbarui!");
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (empId: string, newRole: string) => {
    if (!confirm(`Ubah role karyawan ini menjadi ${newRole.toUpperCase()}?`)) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ role: newRole })
        .eq('id', empId);

      if (error) throw error;
      alert("Role berhasil diperbarui!");
      onRefresh(); 
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, role: newRole as any } : e));
    } catch (err: any) {
      alert("Gagal mengubah role: " + err.message);
    }
  };

  const toggleEmployeeRemote = async (emp: Employee) => {
    const newValue = !emp.isRemoteAllowed;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ isRemoteAllowed: newValue })
        .eq('id', emp.id);

      if (error) throw error;
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, isRemoteAllowed: newValue } : e));
    } catch (err: any) {
      alert("Gagal memperbarui izin: " + err.message);
    }
  };

  const getCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung browser ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      setSettings({
        ...settings,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
    }, (err) => {
      alert("Gagal mendeteksi lokasi: " + err.message);
    });
  };

  const openGoogleMapsPicker = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`;
    window.open(url, '_blank');
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.nama.toLowerCase().includes(searchEmp.toLowerCase()) || 
      e.idKaryawan.toLowerCase().includes(searchEmp.toLowerCase())
    );
  }, [employees, searchEmp]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="bg-white rounded-[48px] p-8 sm:p-12 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div className="bg-[#0f172a] p-5 rounded-3xl text-[#FFC000] shadow-xl">
               <Icons.Settings className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">Setting</h2>
                {isOwner && (
                  <div className="relative">
                    <select 
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value)}
                      className="bg-slate-100 border border-slate-200 text-slate-900 text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-[#FFC000] cursor-pointer"
                    >
                      {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner mt-4 w-fit">
                <button 
                  onClick={() => setActiveSubTab('MAPS')} 
                  className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'MAPS' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  MAPS
                </button>
                {canAccessRoleManagement && (
                  <button 
                    onClick={() => setActiveSubTab('ROLE')} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'ROLE' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ROLE
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {activeSubTab === 'MAPS' && (
            <button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-[#0f172a] hover:bg-black text-[#FFC000] px-10 py-5 rounded-3xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
            >
              {isSaving ? 'Menyimpan...' : <><Icons.Database className="w-4 h-4"/> Simpan Konfigurasi</>}
            </button>
          )}
        </div>

        {activeSubTab === 'MAPS' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-300">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lokasi Utama</label>
                <input 
                  type="text" 
                  value={settings.locationName} 
                  onChange={e => setSettings({...settings, locationName: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black text-black outline-none focus:border-[#FFC000] transition-all"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Radius Verifikasi (Meter)</label>
                   <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{settings.radius}m</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="1000" 
                  step="10"
                  value={settings.radius} 
                  onChange={e => setSettings({...settings, radius: parseInt(e.target.value)})}
                  className="w-full accent-slate-900"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <div className="space-y-0.5">
                    <p className="text-[11px] font-black text-slate-900 uppercase">Absen Luar Kantor (Global)</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Semua karyawan bebas radius</p>
                 </div>
                 <button 
                  onClick={() => setSettings({...settings, allowRemote: !settings.allowRemote})}
                  className={`w-14 h-8 rounded-full relative transition-all duration-300 ${settings.allowRemote ? 'bg-emerald-500' : 'bg-slate-300'}`}
                 >
                   <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${settings.allowRemote ? 'left-7' : 'left-1'}`}></div>
                 </button>
              </div>

              <div className="bg-[#FFFBEB] p-8 rounded-[40px] border-2 border-[#FFD700]/30 space-y-6">
                 <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-[#806000] uppercase tracking-widest">Koordinat Lokasi</p>
                    <div className="flex gap-2">
                       <button onClick={getCurrentGPS} className="bg-white border-2 border-amber-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 shadow-sm text-black">Ambil GPS</button>
                       <button onClick={openGoogleMapsPicker} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95">Preview</button>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-amber-600/60 uppercase ml-1">Latitude</span>
                      <input type="number" step="any" value={settings.latitude} onChange={e => setSettings({...settings, latitude: parseFloat(e.target.value) || 0})} className="w-full bg-white border border-amber-100 p-4 rounded-2xl text-xs font-black outline-none focus:border-amber-400 text-black" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-amber-600/60 uppercase ml-1">Longitude</span>
                      <input type="number" step="any" value={settings.longitude} onChange={e => setSettings({...settings, longitude: parseFloat(e.target.value) || 0})} className="w-full bg-white border border-amber-100 p-4 rounded-2xl text-xs font-black outline-none focus:border-amber-400 text-black" />
                    </div>
                 </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="p-4 bg-slate-50 rounded-[40px] border border-slate-100 aspect-video overflow-hidden relative shadow-inner">
                  <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${settings.latitude},${settings.longitude}&hl=id&z=16&output=embed`}></iframe>
              </div>
              <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 flex flex-col h-[300px]">
                 <h4 className="text-[11px] font-black text-slate-900 uppercase mb-4 tracking-widest">Izin Remote (Individu)</h4>
                 <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {employees.map(emp => (
                      <div key={emp.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                         <div className="flex items-center gap-3 truncate">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border bg-slate-50 shrink-0">
                               {emp.photoBase64 ? <img src={emp.photoBase64} className="w-full h-full object-cover" /> : null}
                            </div>
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">{emp.nama}</p>
                         </div>
                         <button 
                          onClick={() => toggleEmployeeRemote(emp)}
                          className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${emp.isRemoteAllowed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                         >
                           {emp.isRemoteAllowed ? 'ON' : 'OFF'}
                         </button>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div className="space-y-2">
                  <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Manajemen Role Karyawan</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Atur hak akses aplikasi untuk setiap karyawan.</p>
               </div>
               <div className="relative w-full md:w-80">
                  <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="CARI NAMA..." 
                    value={searchEmp}
                    onChange={e => setSearchEmp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-11 pr-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/10 text-black"
                  />
               </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b">
                     <tr>
                        <th className="px-10 py-6">Karyawan</th>
                        <th className="px-10 py-6">Jabatan</th>
                        <th className="px-10 py-6">Role Aktif</th>
                        <th className="px-10 py-6 text-right">Ubah Role</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {filteredEmployees.map(emp => (
                       <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-10 py-5">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 bg-white shadow-sm shrink-0">
                                   {emp.photoBase64 ? <img src={emp.photoBase64} className="w-full h-full object-cover" /> : null}
                                </div>
                                <div>
                                   <p className="text-[11px] font-black text-slate-900 uppercase">{emp.nama}</p>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{emp.idKaryawan}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-5">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">{emp.jabatan}</span>
                          </td>
                          <td className="px-10 py-5">
                             <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                               emp.role === 'owner' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                               emp.role === 'super' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                               emp.role === 'admin' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                               'bg-white text-slate-400 border-slate-100'
                             }`}>
                                {emp.role || 'employee'}
                             </span>
                          </td>
                          <td className="px-10 py-5 text-right">
                             <select 
                               value={emp.role || 'employee'}
                               onChange={(e) => handleUpdateRole(emp.id, e.target.value)}
                               className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none cursor-pointer focus:border-indigo-400 transition-all text-black"
                             >
                                <option value="employee" className="text-black">Employee</option>
                                <option value="admin" className="text-black">Admin</option>
                                <option value="super" className="text-black">Super Admin</option>
                             </select>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModule;
