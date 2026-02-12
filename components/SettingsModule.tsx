import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../constants';
import { supabase } from '../App';
import { AttendanceSettings, Employee } from '../types';

interface SettingsModuleProps {
  userRole: string;
  userCompany: string;
  onRefresh: () => void;
}

type SubTab = 'MAPS' | 'ROLE' | 'KPI' | 'DIVISI';

interface CustomCriteria {
  id: string;
  name: string;
  weight: number;
}

interface KPISystemData {
  criteria: CustomCriteria[];
  attendanceWeight: number;
  contentWeight: number;
  gmvWeight: number;
  lateWeight: number;
  scores: Record<string, Record<string, Record<string, number>>>;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ userRole, userCompany, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('ROLE');
  const [selectedCompany, setSelectedCompany] = useState<string>(userCompany);
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  
  const [settings, setSettings] = useState<AttendanceSettings>({
    locationName: 'Visibel Office',
    latitude: -6.1754,
    longitude: 106.8272,
    radius: 100,
    allowRemote: false
  });
  
  const [kpiSystem, setKpiSystem] = useState<KPISystemData>({ 
    criteria: [], 
    attendanceWeight: 25, 
    contentWeight: 25, 
    gmvWeight: 25, 
    lateWeight: 25,
    scores: {} 
  });
  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [newCriteriaWeight, setNewCriteriaWeight] = useState(10);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [newPositionName, setNewPositionName] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchEmp, setSearchEmp] = useState('');
  const [searchRemote, setSearchRemote] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [remotePage, setRemotePage] = useState(1);
  const remoteItemsPerPage = 5;

  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const canAccessRoleManagement = isOwner || isSuper;

  useEffect(() => {
    fetchSettingsAndEmployees();
    fetchKPIConfig();
    fetchDivisionsAndPositions();
    if (isOwner) fetchAllCompanies();
  }, [selectedCompany, isOwner]);

  const fetchAllCompanies = async () => {
    try {
      const { data, error } = await supabase.from('employees').select('company');
      if (error) throw error;
      const unique = Array.from(new Set((data as any[]).map(e => e.company || 'Visibel'))).sort() as string[];
      setAllCompanies(unique);
    } catch (err) {
      console.error("Gagal memuat daftar perusahaan:", err);
    }
  };

  const fetchSettingsAndEmployees = async () => {
    setIsLoading(true);
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `attendance_settings_${targetCompany}`)
        .single();
      
      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      if (settingsData) setSettings(settingsData.value as AttendanceSettings);

      let query = supabase.from('employees').select('*').order('nama', { ascending: true });
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

  const fetchKPIConfig = async () => {
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { data } = await supabase.from('settings').select('value').eq('key', `kpi_system_${targetCompany}`).single();
      if (data) {
        const val = data.value as any;
        setKpiSystem({
          criteria: val.criteria || [],
          attendanceWeight: val.attendanceWeight ?? 25,
          contentWeight: val.contentWeight ?? 25,
          gmvWeight: val.gmvWeight ?? 25,
          lateWeight: val.lateWeight ?? 0,
          scores: val.scores || {}
        });
      }
      else setKpiSystem({ criteria: [], attendanceWeight: 25, contentWeight: 25, gmvWeight: 25, lateWeight: 0, scores: {} });
    } catch (e) {
      setKpiSystem({ criteria: [], attendanceWeight: 25, contentWeight: 25, gmvWeight: 25, lateWeight: 0, scores: {} });
    }
  };

  const fetchDivisionsAndPositions = async () => {
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { data: divData } = await supabase.from('settings').select('value').eq('key', `divisions_${targetCompany}`).single();
      if (divData && Array.isArray(divData.value)) {
        setDivisions(divData.value as string[]);
      } else {
        setDivisions([]);
      }

      const { data: posData } = await supabase.from('settings').select('value').eq('key', `positions_${targetCompany}`).single();
      if (posData && Array.isArray(posData.value)) {
        setPositions(posData.value as string[]);
      } else {
        setPositions([]);
      }
    } catch (e) {
      setDivisions([]);
      setPositions([]);
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

  const handleSaveKPISystem = async (newData: KPISystemData) => {
    setIsSaving(true);
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { error: settingsError } = await supabase.from('settings').upsert({
        key: `kpi_system_${targetCompany}`,
        value: newData
      }, { onConflict: 'key' });
      if (settingsError) throw settingsError;
      setKpiSystem(newData);
      alert("Konfigurasi KPI berhasil disimpan!");
    } catch (err: any) {
      alert("Gagal menyimpan kriteria KPI: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCriteria = () => {
    if (!newCriteriaName.trim()) return;
    const newCriteria: CustomCriteria = {
      id: `crit-${Date.now()}`,
      name: newCriteriaName.trim().toUpperCase(),
      weight: newCriteriaWeight
    };
    const updated = { ...kpiSystem, criteria: [...kpiSystem.criteria, newCriteria] };
    handleSaveKPISystem(updated);
    setNewCriteriaName('');
    setNewCriteriaWeight(10);
  };

  const handleDeleteCriteria = (id: string) => {
    if (!confirm('Hapus kriteria ini? Nilai yang sudah ada juga akan terhapus.')) return;
    const updated = { ...kpiSystem, criteria: kpiSystem.criteria.filter(c => c.id !== id) };
    handleSaveKPISystem(updated);
  };

  const handleAddDivision = async () => {
    const name = newDivisionName.trim().toUpperCase();
    if (!name) return;
    if (divisions.includes(name)) {
      alert("Divisi sudah ada!");
      return;
    }
    const updated = [...divisions, name];
    await saveSettingsToCloud(`divisions_${isOwner ? selectedCompany : userCompany}`, updated);
    setDivisions(updated);
    setNewDivisionName('');
  };

  const handleRemoveDivision = async (name: string) => {
    if (!confirm(`Hapus divisi "${name}"?`)) return;
    const updated = divisions.filter(d => d !== name);
    await saveSettingsToCloud(`divisions_${isOwner ? selectedCompany : userCompany}`, updated);
    setDivisions(updated);
  };

  const handleAddPosition = async () => {
    const name = newPositionName.trim().toUpperCase();
    if (!name) return;
    if (positions.includes(name)) {
      alert("Jabatan sudah ada!");
      return;
    }
    const updated = [...positions, name];
    await saveSettingsToCloud(`positions_${isOwner ? selectedCompany : userCompany}`, updated);
    setPositions(updated);
    setNewPositionName('');
  };

  const handleRemovePosition = async (name: string) => {
    if (!confirm(`Hapus jabatan "${name}"?`)) return;
    const updated = positions.filter(d => d !== name);
    await saveSettingsToCloud(`positions_${isOwner ? selectedCompany : userCompany}`, updated);
    setPositions(updated);
  };

  const saveSettingsToCloud = async (key: string, value: any) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
    } catch (err: any) {
      alert("Gagal menyimpan data: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateComponentWeight = (field: string, value: number) => {
    const updated = { ...kpiSystem, [field]: value };
    setKpiSystem(updated);
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

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.nama.toLowerCase().includes(searchEmp.toLowerCase()) || 
      e.idKaryawan.toLowerCase().includes(searchEmp.toLowerCase())
    );
  }, [employees, searchEmp]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const filteredRemoteEmployees = useMemo(() => {
    return employees.filter(e => 
      e.nama.toLowerCase().includes(searchRemote.toLowerCase()) || 
      e.idKaryawan.toLowerCase().includes(searchRemote.toLowerCase())
    );
  }, [employees, searchRemote]);

  const totalRemotePages = Math.ceil(filteredRemoteEmployees.length / remoteItemsPerPage);
  const paginatedRemoteEmployees = useMemo(() => {
    const start = (remotePage - 1) * remoteItemsPerPage;
    return filteredRemoteEmployees.slice(start, start + remoteItemsPerPage);
  }, [filteredRemoteEmployees, remotePage, remoteItemsPerPage]);

  const orgStructure = useMemo(() => {
    const structure: Record<string, Employee[]> = {};
    divisions.forEach(div => {
      const members = employees.filter(e => e.division === div);
      const sorted = members.sort((a, b) => a.nama.localeCompare(b.nama));
      structure[div] = sorted;
    });
    const noDiv = employees.filter(e => !e.division || !divisions.includes(e.division));
    if (noDiv.length > 0) structure['TIDAK TERDAFTAR'] = noDiv;
    return structure;
  }, [employees, divisions]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings({
          ...settings,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
        alert("Lokasi berhasil diambil!");
      },
      (err) => {
        alert(`Gagal mengambil lokasi: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalKPIWeight = kpiSystem.attendanceWeight + kpiSystem.contentWeight + kpiSystem.gmvWeight + kpiSystem.lateWeight + (kpiSystem.criteria as CustomCriteria[]).reduce((s, c) => s + (c.weight || 0), 0);

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
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner mt-4 w-fit overflow-x-auto no-scrollbar">
                {canAccessRoleManagement && (
                  <button 
                    onClick={() => setActiveSubTab('ROLE')} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'ROLE' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ROLE
                  </button>
                )}
                {canAccessRoleManagement && (
                  <button 
                    onClick={() => setActiveSubTab('KPI')} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'KPI' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    KPI
                  </button>
                )}
                <button 
                  onClick={() => setActiveSubTab('MAPS')} 
                  className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'MAPS' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  MAPS
                </button>
                <button 
                  onClick={() => setActiveSubTab('DIVISI')} 
                  className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'DIVISI' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  DIVISI & STRUKTUR
                </button>
              </div>
            </div>
          </div>
          
          {(activeSubTab !== 'DIVISI') && (
            <button 
              onClick={activeSubTab === 'KPI' ? () => handleSaveKPISystem(kpiSystem) : handleSaveSettings}
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

              <div className="bg-amber-50/50 p-6 rounded-[32px] border border-amber-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Koordinat Lokasi Kantor</p>
                  <button 
                    onClick={getCurrentLocation}
                    className="bg-[#0f172a] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                  >
                    Set Lokasi Disini
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={settings.latitude} 
                      onChange={e => setSettings({...settings, latitude: parseFloat(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 p-3 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-[#FFC000]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={settings.longitude} 
                      onChange={e => setSettings({...settings, longitude: parseFloat(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 p-3 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-[#FFC000]"
                    />
                  </div>
                </div>
                <p className="text-[7px] text-amber-700/60 font-medium uppercase tracking-widest italic text-center">Penting: Titik koordinat ini adalah pusat radius absensi.</p>
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
            </div>

            <div className="space-y-8">
              <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 flex flex-col h-full min-h-[500px]">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Izin Remote (Individu)</h4>
                    <div className="relative">
                      <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="CARI..." 
                        value={searchRemote}
                        onChange={e => { setSearchRemote(e.target.value); setRemotePage(1); }}
                        className="bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-[10px] font-black uppercase text-black outline-none focus:ring-2 focus:ring-[#FFC000]"
                      />
                    </div>
                 </div>
                 
                 <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-2 mb-6">
                    {paginatedRemoteEmployees.map(emp => (
                      <div key={emp.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                         <div className="flex items-center gap-3 truncate">
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
                    {paginatedRemoteEmployees.length === 0 && (
                      <div className="py-12 text-center opacity-30">
                         <Icons.Database className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tidak ada data</p>
                      </div>
                    )}
                 </div>

                 {totalRemotePages > 1 && (
                   <div className="flex items-center justify-between px-2 pt-4 border-t border-slate-100">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{remotePage} / {totalRemotePages}</span>
                     <div className="flex gap-2">
                        <button 
                          disabled={remotePage === 1}
                          onClick={() => setRemotePage(p => p - 1)}
                          className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                        >
                           <Icons.ChevronDown className="w-5 h-5 rotate-90" />
                        </button>
                        <button 
                          disabled={remotePage === totalRemotePages}
                          onClick={() => setRemotePage(p => p + 1)}
                          className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                        >
                           <Icons.ChevronDown className="w-5 h-5 -rotate-90" />
                        </button>
                     </div>
                   </div>
                 )}
              </div>
            </div>
          </div>
        ) : activeSubTab === 'ROLE' ? (
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
                    onChange={e => { setSearchEmp(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 pl-11 pr-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/10 text-black"
                  />
               </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 overflow-x-auto no-scrollbar shadow-sm">
               <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b">
                     <tr>
                        <th className="px-10 py-6">Karyawan</th>
                        <th className="px-10 py-6">Jabatan</th>
                        <th className="px-10 py-6">Role Aktif</th>
                        <th className="px-10 py-6 text-right">Ubah Role</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {paginatedEmployees.map(emp => (
                       <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-10 py-5 whitespace-nowrap">
                             <div className="flex items-center gap-4">
                                <div>
                                   <p className="text-[11px] font-black text-slate-900 uppercase">{emp.nama}</p>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{emp.idKaryawan}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-5 whitespace-nowrap">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">{emp.jabatan}</span>
                          </td>
                          <td className="px-10 py-5 whitespace-nowrap">
                             <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                               emp.role === 'owner' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                               emp.role === 'super' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                               emp.role === 'admin' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                               'bg-white text-slate-400 border-slate-100'
                             }`}>
                                {emp.role || 'employee'}
                             </span>
                          </td>
                          <td className="px-10 py-5 text-right whitespace-nowrap">
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-10 py-6 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
                  <span className="text-xs font-black text-slate-900 px-4 py-2 bg-slate-50 rounded-full border border-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => { setCurrentPage(prev => prev - 1); }}
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                  >
                    <Icons.ChevronDown className="w-5 h-5 rotate-90" />
                  </button>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => { setCurrentPage(prev => prev + 1); }}
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                  >
                    <Icons.ChevronDown className="w-5 h-5 -rotate-90" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeSubTab === 'KPI' ? (
          <div className="animate-in fade-in duration-300 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Pengaturan Perhitungan KPI</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Atur rumus perhitungan dan bobot (%) untuk setiap kategori penilaian.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="space-y-8">
                  <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-8 h-fit">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Kriteria Baru</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="text" 
                          value={newCriteriaName} 
                          onChange={e => setNewCriteriaName(e.target.value)} 
                          placeholder="NAMA KRITERIA (Sikap, S.I.A...)" 
                          className="flex-grow bg-white border border-slate-200 px-6 py-4 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/10 text-black shadow-sm" 
                        />
                        <div className="flex gap-3">
                          <div className="relative">
                            <input 
                              type="number" 
                              value={newCriteriaWeight} 
                              onChange={e => setNewCriteriaWeight(parseInt(e.target.value) || 0)} 
                              className="w-20 bg-white border border-slate-200 px-4 py-4 rounded-2xl text-[11px] font-black text-center outline-none focus:ring-4 focus:ring-indigo-500/10 text-black shadow-sm" 
                            />
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[7px] font-black text-indigo-400 uppercase">Bobot %</span>
                          </div>
                          <button 
                            onClick={handleAddCriteria}
                            disabled={isSaving}
                            className="bg-[#0f172a] text-[#FFC000] px-6 rounded-2xl shadow-xl active:scale-90 transition-all disabled:opacity-50"
                          >
                            <Icons.Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Kriteria Manual Aktif ({(kpiSystem.criteria as CustomCriteria[]).length})</h3>
                      <div className="space-y-3">
                        {(kpiSystem.criteria as CustomCriteria[]).map(c => (
                          <div key={c.id} className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 group shadow-sm">
                            <div className="flex items-baseline gap-3">
                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{c.name}</span>
                              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">({c.weight}%)</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteCriteria(c.id)} 
                              disabled={isSaving}
                              className="text-rose-400 hover:text-rose-600 transition-all p-2 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {(kpiSystem.criteria as CustomCriteria[]).length === 0 && (
                          <div className="py-12 text-center bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl">
                            <Icons.Sparkles className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Belum Ada Kriteria</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-slate-100 space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bobot Komponen Standar (%)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Presensi</label>
                        <input 
                          type="number" 
                          value={kpiSystem.attendanceWeight} 
                          onChange={e => handleUpdateComponentWeight('attendanceWeight', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-black text-center text-slate-900 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Tepat Waktu</label>
                        <input 
                          type="number" 
                          value={kpiSystem.lateWeight} 
                          onChange={e => handleUpdateComponentWeight('lateWeight', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-black text-center text-slate-900 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Konten (Creator)</label>
                        <input 
                          type="number" 
                          value={kpiSystem.contentWeight} 
                          onChange={e => handleUpdateComponentWeight('contentWeight', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-black text-center text-slate-900 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">GMV (Host)</label>
                        <input 
                          type="number" 
                          value={kpiSystem.gmvWeight} 
                          onChange={e => handleUpdateComponentWeight('gmvWeight', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-black text-center text-slate-900 outline-none" 
                        />
                      </div>
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100">
                     <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight mb-4">Informasi Perhitungan</h4>
                     <ul className="space-y-4">
                        <li className="flex gap-3 text-xs font-medium text-indigo-800">
                           <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0"></div>
                           <span>KPI dihitung berdasarkan bobot persentase di samping. Sistem akan menormalkan total bobot menjadi 100% secara otomatis.</span>
                        </li>
                        <li className="flex gap-3 text-xs font-medium text-indigo-800">
                           <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0"></div>
                           <span><b>Rumus Creator:</b> Presensi + Tepat Waktu + Konten + Manual Criteria.</span>
                        </li>
                        <li className="flex gap-3 text-xs font-medium text-indigo-800">
                           <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0"></div>
                           <span><b>Rumus Host:</b> Presensi + Tepat Waktu + GMV + Manual Criteria.</span>
                        </li>
                        <li className="flex gap-3 text-xs font-medium text-indigo-800">
                           <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0"></div>
                           <span><b>Total Bobot Aktif:</b> <span className={`px-2 py-0.5 rounded-lg font-black ${totalKPIWeight === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{totalKPIWeight}%</span></span>
                        </li>
                     </ul>
                  </div>
                  
                  <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                     <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-[#FFC000] rounded-xl text-black">
                              <Icons.Sparkles className="w-5 h-5" />
                           </div>
                           <h4 className="text-[10px] font-black tracking-widest uppercase text-[#FFC000]">Status Konfigurasi</h4>
                        </div>
                        <p className="text-xl font-black uppercase tracking-tight leading-snug">Data KPI tersimpan untuk unit bisnis: {isOwner ? selectedCompany : userCompany}</p>
                     </div>
                     <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFC000]/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-16">
            {/* MANAGEMENT SECTION */}
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Manajemen Divisi & Jabatan Perusahaan</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Daftarkan divisi dan jabatan yang ada di perusahaan Anda.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 {/* DIVISI SECTION */}
                 <div className="space-y-8">
                    <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-8 h-full">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Divisi Baru</label>
                          <div className="flex gap-3">
                             <input 
                               type="text" 
                               value={newDivisionName} 
                               onChange={e => setNewDivisionName(e.target.value)} 
                               placeholder="NAMA DIVISI (Marketing, HR...)" 
                               className="flex-grow bg-white border border-slate-200 px-6 py-4 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-[#FFC000]/10 text-black shadow-sm" 
                             />
                             <button 
                               onClick={handleAddDivision}
                               disabled={isSaving}
                               className="bg-[#0f172a] text-[#FFC000] px-8 rounded-2xl shadow-xl active:scale-90 transition-all disabled:opacity-50"
                             >
                               <Icons.Plus className="w-5 h-5" />
                             </button>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Daftar Divisi ({(divisions as string[]).length})</h3>
                          <div className="space-y-3">
                             {(divisions as string[]).map(d => (
                               <div key={d} className="bg-white p-5 rounded-2xl border border-slate-100 group shadow-sm flex items-center justify-between">
                                  <span className="text-[11px] font-black text-black uppercase tracking-widest">{d}</span>
                                  <button 
                                    onClick={() => handleRemoveDivision(d)} 
                                    disabled={isSaving}
                                    className="text-rose-400 hover:text-rose-600 transition-all p-2 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    <Icons.Trash className="w-4 h-4" />
                                  </button>
                               </div>
                             ))}
                             {(divisions as string[]).length === 0 && (
                               <div className="py-16 text-center bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl opacity-30">
                                  <Icons.Database className="w-12 h-12 mx-auto mb-2" />
                                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Belum ada divisi</p>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* JABATAN SECTION */}
                 <div className="space-y-8">
                    <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-8 h-full">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Jabatan Baru</label>
                          <div className="flex gap-3">
                             <input 
                               type="text" 
                               value={newPositionName} 
                               onChange={e => setNewPositionName(e.target.value)} 
                               placeholder="NAMA JABATAN (Manager, Staff...)" 
                               className="flex-grow bg-white border border-slate-200 px-6 py-4 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-[#FFC000]/10 text-black shadow-sm" 
                             />
                             <button 
                               onClick={handleAddPosition}
                               disabled={isSaving}
                               className="bg-[#0f172a] text-[#FFC000] px-8 rounded-2xl shadow-xl active:scale-90 transition-all disabled:opacity-50"
                             >
                               <Icons.Plus className="w-5 h-5" />
                             </button>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Daftar Jabatan ({(positions as string[]).length})</h3>
                          <div className="space-y-3">
                             {(positions as string[]).map(p => (
                               <div key={p} className="bg-white p-5 rounded-2xl border border-slate-100 group shadow-sm flex items-center justify-between">
                                  <span className="text-[11px] font-black text-black uppercase tracking-widest">{p}</span>
                                  <button 
                                    onClick={() => handleRemovePosition(p)} 
                                    disabled={isSaving}
                                    className="text-rose-400 hover:text-rose-600 transition-all p-2 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    <Icons.Trash className="w-4 h-4" />
                                  </button>
                               </div>
                             ))}
                             {(positions as string[]).length === 0 && (
                               <div className="py-16 text-center bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl opacity-30">
                                  <Icons.Database className="w-12 h-12 mx-auto mb-2" />
                                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Belum ada jabatan</p>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* VISUALIZATION SECTION */}
            <div className="space-y-8 pt-10 border-t-2 border-slate-100">
              <div className="space-y-2 mb-4">
                 <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">Struktur Organisasi</h3>
                 <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] pt-1">Visualisasi pembagian divisi dan personel resmi perusahaan.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
                {(Object.entries(orgStructure) as [string, Employee[]][]).map(([divName, members]) => {
                  return (
                    <div key={divName} className="bg-[#f1f5f9]/40 p-8 rounded-[48px] border border-slate-100 flex flex-col h-full shadow-inner animate-in zoom-in-95 duration-500">
                      <div className="flex items-center justify-between mb-8 border-b-2 border-slate-200/50 pb-6">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-[0.2em] truncate pr-2 leading-none">{divName}</h4>
                        <div className="bg-slate-900 text-[#FFC000] w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg">
                          {members.length}
                        </div>
                      </div>
                      <div className="flex-grow space-y-4">
                        {members.map(m => {
                          return (
                            <div key={m.id} className="bg-white p-5 rounded-[28px] border border-slate-50 flex items-center gap-5 shadow-sm transition-all duration-300 group hover:shadow-xl hover:-translate-y-0.5">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 flex items-center justify-center shrink-0 transition-colors">
                                 {m.photoBase64 || m.avatarUrl ? (
                                   <img src={m.photoBase64 || m.avatarUrl} className="w-full h-full object-cover" alt={m.nama} />
                                 ) : (
                                   <Icons.Users className="w-5 h-5 text-slate-300" />
                                 )}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[11px] font-black text-slate-900 uppercase truncate leading-none mb-1">{m.nama}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase truncate tracking-widest">{m.jabatan}</p>
                              </div>
                            </div>
                          );
                        })}
                        {members.length === 0 && (
                          <div className="py-20 text-center opacity-30 border-2 border-dashed border-slate-300 rounded-[32px]">
                             <Icons.Database className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Belum Ada Anggota</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModule;