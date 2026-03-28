
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../constants';
import { supabase } from '../services/supabaseClient';
import { AttendanceSettings, Employee, Branch, SalaryData } from '../types';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useConfirmation } from '../contexts/ConfirmationContext';

// Fix for default marker icon
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface SettingsModuleProps {
  userRole: string;
  userCompany: string;
  userEmail?: string;
  onRefresh: () => void;
}

type SubTab = 'MAPS' | 'ROLE' | 'KPI' | 'DIVISI' | 'LEMBUR' | 'CLIENT' | 'COMPANY' | 'PAYROLL';

interface CustomCriteria {
  id: string;
  name: string;
  weight: number;
}

interface PositionConfig {
  name: string;
  bonus: number;
}

interface KPISystemData {
  criteria: CustomCriteria[];
  attendanceWeight: number;
  contentWeight: number;
  gmvWeight: number;
  lateWeight: number;
  scores: Record<string, Record<string, Record<string, number>>>;
}

const getReliableDriveUrl = (url: string) => {
  if (!url) return url;
  
  // Handle direct download links
  if (url.includes('drive.google.com/uc?id=')) {
    return url.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/');
  }
  
  // Handle view links: https://drive.google.com/file/d/FILE_ID/view...
  if (url.includes('drive.google.com/file/d/')) {
    const parts = url.split('/file/d/');
    if (parts.length > 1) {
      const id = parts[1].split('/')[0];
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }
  
  // Handle open links: https://drive.google.com/open?id=FILE_ID
  if (url.includes('drive.google.com/open?id=')) {
    const parts = url.split('id=');
    if (parts.length > 1) {
      const id = parts[1].split('&')[0];
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }

  return url;
};

const SettingsModule: React.FC<SettingsModuleProps> = ({ userRole, userCompany, userEmail, onRefresh }) => {
  const { confirm } = useConfirmation();
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
  const [positions, setPositions] = useState<PositionConfig[]>([]);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [newPositionName, setNewPositionName] = useState('');
  
  const [clients, setClients] = useState<any[]>([]);
  const [newClient, setNewClient] = useState({ namaPic: '', noTelepon: '', namaBrand: '', alamat: '' });
  
  const [companyData, setCompanyData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    npwp: '',
    logo: ''
  });
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({
    code: '',
    name: '',
    address: '',
    phone: '',
    latitude: -6.1754,
    longitude: 106.8272,
    radius: 100
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [trialInfo, setTrialInfo] = useState<{ startDate: string; isPremium: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingOvertime, setIsEditingOvertime] = useState(false);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [searchEmp, setSearchEmp] = useState('');
  const [searchRemote, setSearchRemote] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [remotePage, setRemotePage] = useState(1);
  const remoteItemsPerPage = 5;

  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const isHighAdminAccess = isOwner || isSuper;
  const canAccessRoleManagement = isHighAdminAccess;
  const canAccessClientData = isHighAdminAccess || userEmail === 'wida.oktapiani99@gmail.com';

  useEffect(() => {
    fetchSettingsAndEmployees();
    fetchKPIConfig();
    fetchDivisionsAndPositions();
    fetchClients();
    fetchCompanyData();
    fetchTrialInfo();
    if (isOwner) fetchAllCompanies();
  }, [selectedCompany, isOwner, userCompany]);

  const fetchTrialInfo = async () => {
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { data } = await supabase.from('settings').select('value').eq('key', `trial_info_${targetCompany}`).single();
      if (data) setTrialInfo(data.value);
      else setTrialInfo(null);
    } catch (e) {
      setTrialInfo(null);
    }
  };

  const handleActivatePremium = async () => {
    const isConfirmed = await confirm({
      title: 'Aktifkan Premium?',
      message: 'Aktifkan layanan Premium untuk perusahaan ini?',
      type: 'warning',
      confirmText: 'AKTIFKAN'
    });
    if (!isConfirmed) return;
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { error } = await supabase.from('settings').upsert({
        key: `trial_info_${targetCompany}`,
        value: { ...(trialInfo || { startDate: new Date().toISOString() }), isPremium: true }
      }, { onConflict: 'key' });
      if (error) throw error;
      alert("Layanan Premium Aktif!");
      fetchTrialInfo();
      onRefresh();
    } catch (e: any) {
      alert("Gagal mengaktifkan premium: " + e.message);
    }
  };

  const fetchCompanyData = async () => {
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { data } = await supabase.from('settings').select('value').eq('key', `company_details_${targetCompany}`).single();
      if (data) {
        setCompanyData(data.value);
      } else {
        setCompanyData({ name: targetCompany, address: '', phone: '', email: '', npwp: '', logo: '' });
      }
    } catch (e) {
      setCompanyData({ name: isOwner ? selectedCompany : userCompany, address: '', phone: '', email: '', npwp: '', logo: '' });
    }
  };

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
        const normalized = posData.value.map((p: any) => 
          typeof p === 'string' ? { name: p, bonus: 0 } : p
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

  const fetchClients = async () => {
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { data } = await supabase.from('settings').select('value').eq('key', `clients_${targetCompany}`).single();
      if (data && Array.isArray(data.value)) {
        setClients(data.value);
      } else {
        setClients([]);
      }
    } catch (e) {
      setClients([]);
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
      onRefresh();
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
      onRefresh();
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

  const handleDeleteCriteria = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Kriteria?',
      message: 'Hapus kriteria ini? Nilai yang sudah ada juga akan terhapus.',
      type: 'danger',
      confirmText: 'HAPUS'
    });
    if (!isConfirmed) return;
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
    onRefresh();
  };

  const handleRemoveDivision = async (name: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Divisi?',
      message: `Hapus divisi "${name}"?`,
      type: 'danger',
      confirmText: 'HAPUS'
    });
    if (!isConfirmed) return;
    const updated = divisions.filter(d => d !== name);
    await saveSettingsToCloud(`divisions_${isOwner ? selectedCompany : userCompany}`, updated);
    setDivisions(updated);
    onRefresh();
  };

  const handleAddPosition = async () => {
    const name = newPositionName.trim().toUpperCase();
    if (!name) return;
    if (positions.some(p => p.name === name)) {
      alert("Jabatan sudah ada!");
      return;
    }
    const updated = [...positions, { name, bonus: 0 }];
    await saveSettingsToCloud(`positions_${isOwner ? selectedCompany : userCompany}`, updated);
    setPositions(updated);
    setNewPositionName('');
    onRefresh();
  };

  const handleRemovePosition = async (name: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Jabatan?',
      message: `Hapus jabatan "${name}"?`,
      type: 'danger',
      confirmText: 'HAPUS'
    });
    if (!isConfirmed) return;
    const updated = positions.filter(p => p.name !== name);
    await saveSettingsToCloud(`positions_${isOwner ? selectedCompany : userCompany}`, updated);
    setPositions(updated);
    onRefresh();
  };

  const handleUpdatePositionBonus = async (name: string, bonus: number) => {
    const updated = positions.map(p => p.name === name ? { ...p, bonus } : p);
    setPositions(updated);
    await saveSettingsToCloud(`positions_${isOwner ? selectedCompany : userCompany}`, updated);
    onRefresh();
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
    const isConfirmed = await confirm({
      title: 'Ubah Role?',
      message: `Ubah role karyawan ini menjadi ${newRole.toUpperCase()}?`,
      type: 'warning',
      confirmText: 'UBAH ROLE'
    });
    if (!isConfirmed) return;
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

  const handleUpdateSalaryConfig = async (empId: string, updates: Partial<SalaryData>) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    
    const updatedSalaryConfig = {
      ...(emp.salaryConfig || {}),
      ...updates
    };

    try {
      const { error } = await supabase
        .from('employees')
        .update({ salaryConfig: updatedSalaryConfig })
        .eq('id', empId);

      if (error) throw error;
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, salaryConfig: updatedSalaryConfig as any } : e));
      onRefresh();
    } catch (err: any) {
      alert("Gagal memperbarui konfigurasi payroll: " + err.message);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.namaPic || !newClient.namaBrand) {
      alert("Nama PIC dan Nama Brand wajib diisi!");
      return;
    }
    const updated = [...clients, { ...newClient, id: `client-${Date.now()}` }];
    await saveSettingsToCloud(`clients_${isOwner ? selectedCompany : userCompany}`, updated);
    setClients(updated);
    setNewClient({ namaPic: '', noTelepon: '', namaBrand: '', alamat: '' });
    alert("Data client berhasil ditambahkan!");
  };

  const handleRemoveClient = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Client?',
      message: 'Hapus data client ini?',
      type: 'danger',
      confirmText: 'HAPUS'
    });
    if (!isConfirmed) return;
    const updated = clients.filter(c => c.id !== id);
    await saveSettingsToCloud(`clients_${isOwner ? selectedCompany : userCompany}`, updated);
    setClients(updated);
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
      onRefresh();
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

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setNewBranch(prev => ({ ...prev, latitude: parseFloat(lat), longitude: parseFloat(lon) }));
      } else {
        alert("Lokasi tidak ditemukan");
      }
    } catch (e) {
      console.error("Search error:", e);
    }
  };

  const LocationPicker = (): null => {
    useMapEvents({
      click(e) {
        setNewBranch(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng }));
      },
    });
    return null;
  };

  const MapUpdater = ({ center }: { center: [number, number] }): null => {
    const map = useMap();
    useEffect(() => {
      map.setView(center);
    }, [center, map]);
    return null;
  };

  const handleAddBranch = async () => {
    if (!newBranch.code || !newBranch.name) {
      alert("Kode dan Nama Cabang wajib diisi!");
      return;
    }
    const branch: Branch = {
      id: `branch-${Date.now()}`,
      code: newBranch.code!,
      name: newBranch.name!,
      address: newBranch.address || '',
      phone: newBranch.phone || '',
      latitude: newBranch.latitude || 0,
      longitude: newBranch.longitude || 0,
      radius: newBranch.radius || 100
    };
    const updatedBranches = [...(settings.branches || []), branch];
    const newSettings = { ...settings, branches: updatedBranches };
    setSettings(newSettings);
    await saveAttendanceSettings(newSettings);
    setNewBranch({
      code: '',
      name: '',
      address: '',
      phone: '',
      latitude: -6.1754,
      longitude: 106.8272,
      radius: 100
    });
    setSearchQuery('');
  };

  const handleRemoveBranch = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Cabang?',
      message: 'Hapus cabang ini?',
      type: 'danger',
      confirmText: 'HAPUS'
    });
    if (!isConfirmed) return;
    const updatedBranches = (settings.branches || []).filter(b => b.id !== id);
    const newSettings = { ...settings, branches: updatedBranches };
    setSettings(newSettings);
    await saveAttendanceSettings(newSettings);
  };

  const saveAttendanceSettings = async (newSettings: AttendanceSettings) => {
    setIsSaving(true);
    try {
      const targetCompany = isOwner ? selectedCompany : userCompany;
      const { error: settingsError } = await supabase.from('settings').upsert({
        key: `attendance_settings_${targetCompany}`,
        value: newSettings
      }, { onConflict: 'key' });
      
      if (settingsError) throw settingsError;
      onRefresh();
    } catch (err: any) {
      console.error("Gagal menyimpan:", err.message);
    } finally {
      setIsSaving(false);
    }
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
                    onClick={() => setActiveSubTab('COMPANY')} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'COMPANY' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    DATA PERUSAHAAN
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
                  onClick={() => setActiveSubTab('LEMBUR')} 
                  className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'LEMBUR' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  LEMBUR
                </button>
                <button 
                  onClick={() => setActiveSubTab('PAYROLL')} 
                  className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'PAYROLL' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  PAYROLL
                </button>
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
                {canAccessClientData && (
                  <button 
                    onClick={() => setActiveSubTab('CLIENT')} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'CLIENT' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    DATA CLIENT
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {(activeSubTab !== 'DIVISI' && activeSubTab !== 'LEMBUR' && activeSubTab !== 'CLIENT' && activeSubTab !== 'PAYROLL') && (
            <button 
              onClick={
                activeSubTab === 'KPI' ? () => handleSaveKPISystem(kpiSystem) : 
                activeSubTab === 'COMPANY' ? () => saveSettingsToCloud(`company_details_${isOwner ? selectedCompany : userCompany}`, companyData).then(() => { alert("Data Perusahaan berhasil disimpan!"); setIsEditingCompany(false); }) :
                handleSaveSettings
              }
              disabled={isSaving}
              className="bg-[#0f172a] hover:bg-black text-[#FFC000] px-10 py-5 rounded-3xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
            >
              {isSaving ? 'Menyimpan...' : <><Icons.Database className="w-4 h-4"/> Simpan Konfigurasi</>}
            </button>
          )}
        </div>

        {activeSubTab === 'PAYROLL' ? (
          <div className="animate-in fade-in duration-300 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Konfigurasi Payroll Karyawan</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tentukan apakah karyawan dibayar per bulan atau per hari.</p>
              </div>
              {!isEditingSalary ? (
                <button 
                  onClick={() => setIsEditingSalary(true)}
                  className="bg-white border-2 border-slate-100 text-slate-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Icons.Edit className="w-4 h-4" /> EDIT DATA
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setIsEditingSalary(false);
                    alert("Konfigurasi Payroll berhasil disimpan!");
                  }}
                  className="bg-[#0f172a] hover:bg-black text-[#FFC000] px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3"
                >
                  <Icons.Check className="w-4 h-4" /> SELESAI
                </button>
              )}
            </div>

            <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="relative flex-grow max-w-md">
                    <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      placeholder="CARI NAMA KARYAWAN..." 
                      value={searchEmp}
                      onChange={e => { setSearchEmp(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl text-[11px] font-black uppercase text-black outline-none focus:ring-4 focus:ring-[#FFC000]/10"
                    />
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full">
                   <thead>
                     <tr className="border-b border-slate-200">
                       <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Karyawan</th>
                       <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jabatan</th>
                       <th className="text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe Payroll</th>
                       <th className="text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nominal</th>
                       <th className="text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cut Off</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {paginatedEmployees.map(emp => (
                       <tr key={emp.id} className="hover:bg-white/50 transition-colors">
                         <td className="py-4 px-4">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                               {emp.photoBase64 || emp.avatarUrl ? (
                                 <img src={emp.photoBase64 || emp.avatarUrl} className="w-full h-full object-cover" alt={emp.nama} />
                               ) : (
                                 <Icons.User className="w-4 h-4 text-slate-400" />
                               )}
                             </div>
                             <div>
                               <p className="text-[11px] font-black text-slate-900 uppercase leading-none mb-1">{emp.nama}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{emp.idKaryawan}</p>
                             </div>
                           </div>
                         </td>
                         <td className="py-4 px-4">
                           <span className="text-[10px] font-bold text-slate-600 uppercase">{emp.jabatan}</span>
                         </td>
                         <td className="py-4 px-4">
                           <div className="flex items-center justify-center gap-2">
                             <button
                               disabled={!isEditingSalary}
                               onClick={() => handleUpdateSalaryConfig(emp.id, { type: 'monthly' })}
                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                 emp.salaryConfig?.type === 'monthly' || !emp.salaryConfig?.type
                                   ? 'bg-[#0f172a] text-white shadow-lg'
                                   : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-600'
                               } disabled:opacity-50`}
                             >
                               BULANAN
                             </button>
                             <button
                               disabled={!isEditingSalary}
                               onClick={() => handleUpdateSalaryConfig(emp.id, { type: 'daily' })}
                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                 emp.salaryConfig?.type === 'daily'
                                   ? 'bg-emerald-600 text-white shadow-lg'
                                   : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-600'
                               } disabled:opacity-50`}
                             >
                               HARIAN
                             </button>
                           </div>
                         </td>
                         <td className="py-4 px-4">
                            <div className="relative max-w-[160px] mx-auto">
                               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px]">Rp</span>
                               <input 
                                  type="text"
                                  disabled={!isEditingSalary}
                                  value={new Intl.NumberFormat('id-ID').format(emp.salaryConfig?.gapok || 0)}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    handleUpdateSalaryConfig(emp.id, { gapok: parseInt(val) || 0 });
                                  }}
                                  className="w-full bg-white border border-slate-200 pl-8 pr-3 py-2 rounded-xl text-[11px] font-black text-black outline-none focus:border-[#FFC000] transition-all disabled:opacity-50"
                               />
                            </div>
                         </td>
                         <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-2">
                               <input 
                                  type="number"
                                  min="1"
                                  max="31"
                                  disabled={!isEditingSalary}
                                  value={emp.salaryConfig?.cutoffStart || 26}
                                  onChange={(e) => handleUpdateSalaryConfig(emp.id, { cutoffStart: parseInt(e.target.value) || 26 })}
                                  className="w-12 bg-white border border-slate-200 px-1 py-1 rounded-lg text-[10px] font-black text-black text-center outline-none focus:border-[#FFC000] disabled:opacity-50"
                                  title="Mulai"
                               />
                               <span className="text-slate-300">-</span>
                               <input 
                                  type="number"
                                  min="1"
                                  max="31"
                                  disabled={!isEditingSalary}
                                  value={emp.salaryConfig?.cutoffEnd || 25}
                                  onChange={(e) => handleUpdateSalaryConfig(emp.id, { cutoffEnd: parseInt(e.target.value) || 25 })}
                                  className="w-12 bg-white border border-slate-200 px-1 py-1 rounded-lg text-[10px] font-black text-black text-center outline-none focus:border-[#FFC000] disabled:opacity-50"
                                  title="Selesai"
                               />
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>

               {totalPages > 1 && (
                 <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman {currentPage} dari {totalPages}</span>
                   <div className="flex gap-2">
                     <button 
                       disabled={currentPage === 1}
                       onClick={() => setCurrentPage(p => p - 1)}
                       className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                     >
                       <Icons.ChevronDown className="w-5 h-5 rotate-90" />
                     </button>
                     <button 
                       disabled={currentPage === totalPages}
                       onClick={() => setCurrentPage(p => p + 1)}
                       className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                     >
                       <Icons.ChevronDown className="w-5 h-5 -rotate-90" />
                     </button>
                   </div>
                 </div>
               )}
            </div>
          </div>
        ) : activeSubTab === 'MAPS' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-300">
            {/* Left Column: Branch List & Remote Permissions */}
            <div className="lg:col-span-4 space-y-6">
              {/* Branch List */}
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col h-fit max-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Daftar Cabang</h4>
                  <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-bold">{(settings.branches || []).length}</span>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-2">
                  {(settings.branches || []).map(branch => (
                    <div key={branch.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group hover:border-[#FFC000] transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black">{branch.code}</span>
                          <p className="text-[10px] font-black text-slate-900 uppercase truncate">{branch.name}</p>
                        </div>
                        <button 
                          onClick={() => handleRemoveBranch(branch.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Icons.Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Icons.MapPin className="w-3 h-3" />
                          <p className="text-[9px] font-medium truncate">{branch.address || '-'}</p>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <Icons.Phone className="w-3 h-3" />
                          <p className="text-[9px] font-medium">{branch.phone || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!settings.branches || settings.branches.length === 0) && (
                    <div className="py-20 text-center opacity-30">
                      <Icons.Map className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Belum ada cabang</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Permissions List */}
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col h-fit max-h-[500px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Izin Remote (Individu)</h4>
                    <div className="relative">
                      <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="CARI..." 
                        value={searchRemote}
                        onChange={e => { setSearchRemote(e.target.value); setRemotePage(1); }}
                        className="bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-[10px] font-black uppercase text-black outline-none focus:ring-2 focus:ring-[#FFC000] w-full"
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
                          className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${emp.isRemoteAllowed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
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
                          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                        >
                           <Icons.ChevronDown className="w-4 h-4 rotate-90" />
                        </button>
                        <button 
                          disabled={remotePage === totalRemotePages}
                          onClick={() => setRemotePage(p => p + 1)}
                          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm"
                        >
                           <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
                        </button>
                     </div>
                   </div>
                 )}
              </div>
            </div>

            {/* Right Column: Add Branch Form & Map */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Tambah Cabang</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kode Cabang *</label>
                    <div className="relative">
                      <Icons.Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Contoh: TSM (Maksimal 3 karakter)"
                        maxLength={3}
                        value={newBranch.code}
                        onChange={e => setNewBranch({...newBranch, code: e.target.value.toUpperCase()})}
                        className="w-full bg-slate-50 border border-slate-100 pl-12 pr-5 py-4 rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Cabang *</label>
                    <div className="relative">
                      <Icons.Edit className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Contoh: TASIKMALAYA (Maksimal 50 karakter)"
                        value={newBranch.name}
                        onChange={e => setNewBranch({...newBranch, name: e.target.value.toUpperCase()})}
                        className="w-full bg-slate-50 border border-slate-100 pl-12 pr-5 py-4 rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Cabang *</label>
                    <div className="relative">
                      <Icons.MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Contoh: Jln. Perintis Kemerdekaan No. 80"
                        value={newBranch.address}
                        onChange={e => setNewBranch({...newBranch, address: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 pl-12 pr-5 py-4 rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telepon Cabang *</label>
                    <div className="relative">
                      <Icons.Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Contoh: 0265311766"
                        value={newBranch.phone}
                        onChange={e => setNewBranch({...newBranch, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 pl-12 pr-5 py-4 rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Radius Verifikasi (Meter)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="10" 
                        max="1000" 
                        step="10"
                        value={newBranch.radius} 
                        onChange={e => setNewBranch({...newBranch, radius: parseInt(e.target.value)})}
                        className="flex-grow accent-slate-900"
                      />
                      <span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-600 min-w-[50px] text-center">{newBranch.radius}m</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Lokasi di Peta</label>
                  <div className="relative">
                    <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      placeholder="Cari lokasi (contoh: Tasikmalaya, Jawa Barat)"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchLocation()}
                      className="w-full bg-slate-50 border border-slate-100 pl-12 pr-24 py-4 rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all"
                    />
                    <button 
                      onClick={handleSearchLocation}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#0f172a] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                    >
                      Cari
                    </button>
                  </div>

                  <div className="h-[400px] rounded-[32px] overflow-hidden border-2 border-slate-100 relative z-10">
                    <MapContainer 
                      center={[newBranch.latitude!, newBranch.longitude!]} 
                      zoom={13} 
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <Marker position={[newBranch.latitude!, newBranch.longitude!]}>
                      </Marker>
                      <LocationPicker />
                      <MapUpdater center={[newBranch.latitude!, newBranch.longitude!]} />
                    </MapContainer>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-grow mr-4">
                      <Icons.MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="space-y-0.5 flex-grow">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Lokasi Cabang (Latitude, Longitude)</p>
                        <input 
                          type="text"
                          value={`${newBranch.latitude}, ${newBranch.longitude}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            const parts = val.split(',').map(p => p.trim());
                            if (parts.length === 2) {
                              const lat = parseFloat(parts[0]);
                              const lon = parseFloat(parts[1]);
                              if (!isNaN(lat) && !isNaN(lon)) {
                                setNewBranch(prev => ({ ...prev, latitude: lat, longitude: lon }));
                              }
                            }
                          }}
                          className="w-full bg-transparent text-[11px] font-black text-slate-900 outline-none border-b border-slate-300 focus:border-[#FFC000] transition-all"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleAddBranch}
                      className="bg-[#0f172a] text-[#FFC000] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all shrink-0"
                    >
                      Tambah Cabang
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeSubTab === 'COMPANY' ? (
          <div className="animate-in fade-in duration-300 space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div className="space-y-2">
                  <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Data Profil Perusahaan</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Informasi resmi yang akan tampil pada invoice dan dokumen perusahaan.</p>
               </div>
               {!isEditingCompany && (
                 <button 
                   onClick={() => setIsEditingCompany(true)}
                   className="bg-white border-2 border-slate-100 text-slate-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                 >
                   <Icons.Edit className="w-4 h-4" /> EDIT PROFIL
                 </button>
               )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Perusahaan</label>
                    <input 
                      type="text" 
                      disabled={!isEditingCompany}
                      value={companyData.name} 
                      onChange={e => setCompanyData({...companyData, name: e.target.value})}
                      className="w-full bg-white border-2 border-slate-100 p-5 rounded-3xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all disabled:opacity-50 disabled:bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No Telepon</label>
                    <input 
                      type="text" 
                      disabled={!isEditingCompany}
                      value={companyData.phone} 
                      onChange={e => setCompanyData({...companyData, phone: e.target.value})}
                      className="w-full bg-white border-2 border-slate-100 p-5 rounded-3xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all disabled:opacity-50 disabled:bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Perusahaan</label>
                    <input 
                      type="email" 
                      disabled={!isEditingCompany}
                      value={companyData.email} 
                      onChange={e => setCompanyData({...companyData, email: e.target.value})}
                      className="w-full bg-white border-2 border-slate-100 p-5 rounded-3xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all disabled:opacity-50 disabled:bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NPWP (Opsional)</label>
                    <input 
                      type="text" 
                      disabled={!isEditingCompany}
                      value={companyData.npwp} 
                      onChange={e => setCompanyData({...companyData, npwp: e.target.value})}
                      className="w-full bg-white border-2 border-slate-100 p-5 rounded-3xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all disabled:opacity-50 disabled:bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo URL</label>
                    <input 
                      type="text" 
                      disabled={!isEditingCompany}
                      value={companyData.logo} 
                      onChange={e => setCompanyData({...companyData, logo: e.target.value})}
                      className="w-full bg-white border-2 border-slate-100 p-5 rounded-3xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all disabled:opacity-50 disabled:bg-slate-50/50"
                      placeholder="https://..."
                    />
                    {companyData.logo && (
                      <div className="mt-4 p-6 bg-white border-2 border-slate-100 rounded-[32px] flex flex-col items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Logo Preview</p>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 w-full flex justify-center">
                          <img 
                            src={getReliableDriveUrl(companyData.logo)} 
                            alt="Logo Preview" 
                            className="max-h-24 object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Invalid+Logo+URL';
                            }}
                          />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 mt-4 break-all text-center px-4">
                          Resolved URL: {getReliableDriveUrl(companyData.logo)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Lengkap Perusahaan</label>
                  <textarea 
                    disabled={!isEditingCompany}
                    value={companyData.address} 
                    onChange={e => setCompanyData({...companyData, address: e.target.value})}
                    className="w-full bg-white border-2 border-slate-100 p-5 rounded-3xl text-sm font-bold text-black outline-none focus:border-[#FFC000] transition-all min-h-[200px] disabled:opacity-50 disabled:bg-slate-50/50"
                    placeholder="Masukkan alamat lengkap..."
                  />
                </div>
              </div>

              {isOwner && (
                <div className="space-y-8">
                  <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 space-y-6 shadow-2xl">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                        <Icons.Sparkles className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tight">Status Layanan</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kelola paket langganan perusahaan.</p>
                      </div>
                    </div>

                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paket Saat Ini</span>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${trialInfo?.isPremium ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {trialInfo?.isPremium ? 'PREMIUM ACCESS' : 'TRIAL MODE'}
                        </span>
                      </div>
                      {!trialInfo?.isPremium && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Berlaku</span>
                          <span className="text-sm font-black text-white">
                            {trialInfo ? (() => {
                              const start = new Date(trialInfo.startDate);
                              const now = new Date();
                              const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                              const left = 7 - diff;
                              return left > 0 ? `${left} Hari Tersisa` : 'Trial Berakhir';
                            })() : '7 Hari'}
                          </span>
                        </div>
                      )}
                    </div>

                    {!trialInfo?.isPremium && (
                      <button 
                        onClick={handleActivatePremium}
                        className="w-full bg-[#FFC000] text-slate-900 py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-white transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <Icons.Check className="w-5 h-5" /> AKTIFKAN PREMIUM
                      </button>
                    )}
                    
                    {trialInfo?.isPremium && (
                      <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-center">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Sistem Berjalan dalam Mode Full Akses</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isEditingCompany && (
              <div className="flex justify-end pt-6">
                <button 
                  onClick={() => {
                    saveSettingsToCloud(`company_details_${isOwner ? selectedCompany : userCompany}`, companyData)
                      .then(() => {
                        alert("Data Perusahaan berhasil disimpan!");
                        setIsEditingCompany(false);
                      });
                  }}
                  disabled={isSaving}
                  className="bg-[#0f172a] hover:bg-black text-[#FFC000] px-12 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-4"
                >
                  {isSaving ? 'Menyimpan...' : <><Icons.Database className="w-5 h-5"/> Simpan Data Perusahaan</>}
                </button>
              </div>
            )}
          </div>
        ) : activeSubTab === 'CLIENT' ? (
          canAccessClientData ? (
            <div className="animate-in fade-in duration-300 space-y-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Manajemen Data Client</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kelola data client perusahaan untuk keperluan invoice.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-8">
                  <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Client Baru</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama PIC</label>
                        <input 
                          type="text" 
                          value={newClient.namaPic} 
                          onChange={e => setNewClient({...newClient, namaPic: e.target.value})} 
                          className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-[#FFC000]/10 text-black shadow-sm" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">No Telepon</label>
                        <input 
                          type="text" 
                          value={newClient.noTelepon} 
                          onChange={e => setNewClient({...newClient, noTelepon: e.target.value})} 
                          className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-[#FFC000]/10 text-black shadow-sm" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Brand</label>
                        <input 
                          type="text" 
                          value={newClient.namaBrand} 
                          onChange={e => setNewClient({...newClient, namaBrand: e.target.value})} 
                          className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-[#FFC000]/10 text-black shadow-sm" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat</label>
                        <textarea 
                          value={newClient.alamat} 
                          onChange={e => setNewClient({...newClient, alamat: e.target.value})} 
                          className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-[#FFC000]/10 text-black shadow-sm min-h-[100px]" 
                        />
                      </div>
                      <button 
                        onClick={handleAddClient}
                        disabled={isSaving}
                        className="w-full bg-[#0f172a] text-[#FFC000] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        <Icons.Plus className="w-4 h-4" /> TAMBAH CLIENT
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b">
                        <tr>
                          <th className="px-8 py-6">Client / Brand</th>
                          <th className="px-8 py-6">PIC / Kontak</th>
                          <th className="px-8 py-6">Alamat</th>
                          <th className="px-8 py-6 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clients.map((client, idx) => (
                          <tr key={client.id} className={`hover:bg-slate-50/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                            <td className="px-8 py-5">
                              <p className="text-[11px] font-black text-slate-900 uppercase">{client.namaBrand}</p>
                            </td>
                            <td className="px-8 py-5">
                              <p className="text-[10px] font-bold text-slate-700 uppercase">{client.namaPic}</p>
                              <p className="text-[9px] text-slate-400 font-medium">{client.noTelepon}</p>
                            </td>
                            <td className="px-8 py-5">
                              <p className="text-[9px] text-slate-500 uppercase line-clamp-2 max-w-[200px]">{client.alamat}</p>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <button 
                                onClick={() => handleRemoveClient(client.id)}
                                className="text-rose-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-all"
                              >
                                <Icons.Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {clients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-20 text-center opacity-30">
                              <Icons.Database className="w-12 h-12 mx-auto mb-4" />
                              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Belum ada data client</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Akses Ditolak</h2>
              <p className="text-slate-500">Anda tidak memiliki izin untuk mengakses data client.</p>
            </div>
          )
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
                     {paginatedEmployees.map((emp, idx) => (
                       <tr key={emp.id} className={`hover:bg-slate-50/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
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
                            className="bg-[#0f172a] text-[#FFC000] px-8 rounded-2xl shadow-xl active:scale-90 transition-all disabled:opacity-50"
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
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Konten</label>
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
        ) : activeSubTab === 'LEMBUR' ? (
          <div className="animate-in fade-in duration-300 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Perhitungan Lembur Jabatan</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Atur nominal lembur per jam untuk setiap kategori jabatan karyawan.</p>
              </div>
              {!isEditingOvertime ? (
                <button 
                  onClick={() => setIsEditingOvertime(true)}
                  className="bg-white border-2 border-slate-100 text-slate-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Icons.Edit className="w-4 h-4" /> EDIT DATA
                </button>
              ) : (
                <button 
                  onClick={() => {
                    saveSettingsToCloud(`positions_${isOwner ? selectedCompany : userCompany}`, positions)
                      .then(() => {
                        alert("Data Lembur berhasil disimpan!");
                        setIsEditingOvertime(false);
                        onRefresh();
                      });
                  }}
                  disabled={isSaving}
                  className="bg-[#0f172a] hover:bg-black text-[#FFC000] px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
                >
                  <Icons.Database className="w-4 h-4" /> SIMPAN DATA
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {positions.map(p => (
                 <div key={p.name} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="flex items-center justify-between">
                       <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">{p.name}</h4>
                       <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                          <Icons.Clock className="w-4 h-4" />
                       </div>
                    </div>
                    
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lembur Per Jam (Rp)</label>
                       <div className="relative">
                          <input 
                            type="number"
                            disabled={!isEditingOvertime}
                            value={p.bonus}
                            onChange={(e) => handleUpdatePositionBonus(p.name, parseInt(e.target.value) || 0)}
                            className="w-full bg-white border-2 border-slate-100 py-5 pr-5 pl-14 rounded-3xl text-xl font-black text-indigo-600 outline-none focus:border-[#FFC000] transition-all shadow-inner disabled:opacity-50 disabled:bg-slate-50/50"
                          />
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs pointer-events-none">Rp</span>
                       </div>
                    </div>
                    
                    <p className="text-[8px] font-bold text-slate-400 uppercase italic tracking-tighter">
                      Nominal ini akan dikalikan dengan total jam kerja/lembur yang terdeteksi di sistem.
                    </p>
                    
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                 </div>
               ))}
               
               {positions.length === 0 && (
                 <div className="col-span-full py-24 text-center opacity-30 bg-white border-2 border-dashed border-slate-200 rounded-[48px]">
                    <Icons.Database className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Belum Ada Jabatan Terdaftar</p>
                    <p className="text-[9px] font-bold mt-2">Tambahkan jabatan di menu Divisi & Struktur terlebih dahulu.</p>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-16">
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tight">Manajemen Divisi & Jabatan Perusahaan</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Daftarkan divisi dan jabatan yang ada di perusahaan Anda.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
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
                             {(divisions as string[]).map((d, idx) => (
                               <div key={d} className={`p-5 rounded-2xl border border-slate-100 group shadow-sm flex items-center justify-between ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
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
                          <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Daftar Jabatan ({(positions as PositionConfig[]).length})</h3>
                          <div className="space-y-3">
                             {(positions as PositionConfig[]).map((p, idx) => (
                               <div key={p.name} className={`p-5 rounded-2xl border border-slate-100 group shadow-sm flex items-center justify-between ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                                  <span className="text-[11px] font-black text-black uppercase tracking-widest">{p.name}</span>
                                  <button 
                                    onClick={() => handleRemovePosition(p.name)} 
                                    disabled={isSaving}
                                    className="text-rose-400 hover:text-rose-600 transition-all p-2 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    <Icons.Trash className="w-4 h-4" />
                                  </button>
                               </div>
                             ))}
                             {(positions as PositionConfig[]).length === 0 && (
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
