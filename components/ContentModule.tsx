import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, ContentPlan } from '../types';
import { Icons, LIVE_BRANDS as INITIAL_BRANDS } from '../constants';
import { supabase } from '../App';

interface ContentModuleProps {
  employees: Employee[];
  plans: ContentPlan[];
  setPlans: React.Dispatch<React.SetStateAction<ContentPlan[]>>;
  searchQuery?: string;
  userRole?: string;
  currentEmployee?: Employee | null;
}

const PILLAR_OPTIONS = ['Educational', 'Entertainment', 'Sales/Promo', 'Engagement', 'Behind the Scene', 'Inspirational'];

const ContentModule: React.FC<ContentModuleProps> = ({ employees, plans, setPlans, searchQuery = '', userRole = 'employee', currentEmployee = null }) => {
  const isCreator = useMemo(() => {
    const jabatan = (currentEmployee?.jabatan || '').toLowerCase();
    return jabatan.includes('content creator') || jabatan.includes('creator') || jabatan.includes('lead content');
  }, [currentEmployee]);

  const hasFullAccess = userRole === 'admin' || userRole === 'super' || isCreator;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ContentPlan | null>(null);
  const [dbStatus, setDbStatus] = useState<'sync' | 'local'>('sync');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isManagingTemplate, setIsManagingTemplate] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const contentFileInputRef = useRef<HTMLInputElement>(null);

  const [isManagingBrands, setIsManagingBrands] = useState(false);
  const [isSavingBrands, setIsSavingBrands] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  const [brands, setBrands] = useState<any[]>(() => {
    const saved = localStorage.getItem('content_brands_config');
    if (saved) return JSON.parse(saved);
    return INITIAL_BRANDS.map(b => ({ name: b.name, target: 0, quotaDeadline: '' }));
  });

  useEffect(() => {
    fetchCloudConfigs();
  }, []);

  const fetchCloudConfigs = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) return;

      const contentBrands = data.find(s => s.key === 'content_brands_config')?.value;
      if (contentBrands) {
        setBrands(contentBrands);
        localStorage.setItem('content_brands_config', JSON.stringify(contentBrands));
      }
    } catch (err) {
      console.warn("Gagal memuat config cloud content.");
    }
  };

  const saveConfigToCloud = async (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
    try {
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    } catch (err) {
      console.error("Gagal sinkronisasi cloud content:", err);
    }
  };

  const persistBrandsUpdate = async (updatedBrands: any[]) => {
    setIsSavingBrands(true);
    try {
      await saveConfigToCloud('content_brands_config', updatedBrands);
      setBrands(updatedBrands);
    } catch (err: any) {
      console.error("Gagal sinkronisasi Content brands:", err);
    } finally {
      setIsSavingBrands(false);
    }
  };

  const addBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) return;
    if (brands.some((b: any) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Brand sudah ada!");
      return;
    }
    const updatedBrands = [...brands, { name: trimmed.toUpperCase(), target: 0, quotaDeadline: '' }];
    await persistBrandsUpdate(updatedBrands);
    setNewBrandName('');
  };

  const removeBrand = async (name: string) => {
    if (!confirm(`Hapus brand "${name}" secara permanen?`)) return;
    const updatedBrands = brands.filter((b: any) => b.name !== name);
    await persistBrandsUpdate(updatedBrands);
  };

  const updateBrandField = async (name: string, field: string, value: any) => {
    const updatedBrands = brands.map(b => b.name === name ? { ...b, [field]: value } : b);
    setBrands(updatedBrands);
    await saveConfigToCloud('content_brands_config', updatedBrands);
  };

  const creatorList = useMemo(() => {
    return employees.filter(e => {
      const jabatan = (e.jabatan || '').toLowerCase();
      return jabatan.includes('content creator') || jabatan.includes('creator') || jabatan.includes('lead content');
    });
  }, [employees]);

  const getCreatorName = (id: string) => employees.find(e => e.id === id)?.nama || 'Unknown';

  const findCreatorIdByName = (name: string) => {
    const search = String(name || '').trim().toLowerCase();
    if (!search) return '';
    const match = creatorList.find(e => e.nama.toLowerCase() === search || e.nama.toLowerCase().includes(search));
    return match ? match.id : '';
  };

  const [formData, setFormData] = useState<Omit<ContentPlan, 'id'>>({
    title: '',
    brand: brands[0]?.name || '',
    platform: 'TikTok',
    creatorId: '',
    deadline: '',
    status: 'Selesai',
    notes: '',
    postingDate: new Date().toISOString().split('T')[0],
    linkReference: '',
    contentPillar: PILLAR_OPTIONS[0],
    captionHashtag: '',
    linkPostingan: '',
    likes: 0,
    comments: 0,
    views: 0,
    saves: 0,
    shares: 0,
    screenshotBase64: ''
  });

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const brandStats = useMemo(() => {
    return brands.map(brand => {
      const doneThisMonth = plans.filter(p => {
        if (!p.postingDate || p.brand !== brand.name) return false;
        const pDate = new Date(p.postingDate);
        return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
      }).length;
      const remaining = Math.max(0, (brand.target || 0) - doneThisMonth);
      const progress = brand.target > 0 ? (doneThisMonth / brand.target) * 100 : 0;
      return { ...brand, done: doneThisMonth, remaining, progress: Math.min(100, progress) };
    });
  }, [brands, plans, currentMonth, currentYear]);

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchesSearch = (p.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand = selectedBrandFilter === 'ALL' || p.brand === selectedBrandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [plans, searchQuery, selectedBrandFilter]);

  const handleOpenModal = (plan?: ContentPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({ 
        ...plan,
        deadline: plan.deadline || '',
        likes: plan.likes || 0,
        comments: plan.comments || 0,
        views: plan.views || 0,
        saves: plan.saves || 0,
        shares: plan.shares || 0,
        postingDate: plan.postingDate || new Date().toISOString().split('T')[0],
        captionHashtag: plan.captionHashtag || '',
        linkPostingan: plan.linkPostingan || '',
        brand: plan.brand || brands[0]?.name || '',
        creatorId: plan.creatorId || (isCreator ? currentEmployee?.id || '' : '')
      });
    } else {
      setEditingPlan(null);
      setFormData({
        title: '',
        brand: brands[0]?.name || '',
        platform: 'TikTok',
        creatorId: isCreator ? currentEmployee?.id || '' : '',
        deadline: '',
        status: 'Selesai',
        notes: '',
        postingDate: new Date().toISOString().split('T')[0],
        linkReference: '',
        contentPillar: PILLAR_OPTIONS[0],
        captionHashtag: '',
        linkPostingan: '',
        likes: 0,
        comments: 0,
        views: 0,
        saves: 0,
        shares: 0,
        screenshotBase64: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasFullAccess) return;
    const finalTitle = `${formData.brand} - ${formData.postingDate || 'No Date'}`;
    const reportId = editingPlan?.id || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const dataToSave = { ...formData, title: finalTitle, id: reportId, status: 'Selesai' as const };
    
    try {
      const { error } = await supabase.from('content_plans').upsert(dataToSave);
      if (error) throw error;
      
      setPlans(prev => {
        const idx = prev.findIndex(p => p.id === reportId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = dataToSave as ContentPlan;
          return updated;
        }
        return [dataToSave as ContentPlan, ...prev];
      });
      setIsModalOpen(false);
      setDbStatus('sync');
    } catch (err: any) {
      alert("Gagal menyimpan ke database.");
      setDbStatus('local');
    }
  };

  const handleDelete = async (planId?: string) => {
    if (!planId || !hasFullAccess) return;
    if (!confirm('Hapus laporan konten ini secara permanen?')) return;
    try {
      const { error } = await supabase.from('content_plans').delete().eq('id', planId);
      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== planId));
    } catch (err: any) {
      alert("Gagal menghapus data.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const compressed = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension to keep it reasonable
          const MAX_DIM = 1200;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = (height / width) * MAX_DIM;
              width = MAX_DIM;
            } else {
              width = (width / height) * MAX_DIM;
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          // Iterative quality reduction to hit under 250kb
          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // While size is > 250KB (approx via string length check)
          while (dataUrl.length * 0.75 > 250000 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        };
      });
      setFormData(prev => ({ ...prev, screenshotBase64: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const handleExportExcel = () => {
    if (plans.length === 0) {
      alert("Tidak ada data laporan untuk diekspor.");
      return;
    }
    const dataToExport = plans.map(p => ({
      'BRAND': p.brand,
      'PLATFORM': p.platform,
      'TANGGAL POSTING': p.postingDate,
      'CREATOR': getCreatorName(p.creatorId || ''),
      'PILLAR': p.contentPillar,
      'LINK POSTINGAN': p.linkPostingan,
      'VIEWS': p.views,
      'LIKES': p.likes,
      'COMMENTS': p.comments,
      'SAVES': p.saves,
      'SHARES': p.shares,
      'ENGAGEMENT RATE': calculateEngagementRate(p)
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Konten");
    XLSX.writeFile(workbook, `Report_Konten_Visibel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingExcel(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const newReports = jsonData.map((row: any) => {
          const brand = String(row['BRAND'] || '').toUpperCase();
          const postingDate = row['TANGGAL POSTING'] ? (row['TANGGAL POSTING'] instanceof Date ? row['TANGGAL POSTING'].toISOString().split('T')[0] : String(row['TANGGAL POSTING'])) : new Date().toISOString().split('T')[0];
          
          return {
            id: `${Date.now()}${Math.floor(Math.random() * 10000)}`,
            title: `${brand} - ${postingDate}`,
            brand: brand,
            platform: String(row['PLATFORM'] || 'TikTok'),
            postingDate: postingDate,
            creatorId: findCreatorIdByName(row['CREATOR']),
            contentPillar: String(row['PILLAR'] || 'Entertainment'),
            linkPostingan: String(row['LINK POSTINGAN'] || ''),
            views: Number(row['VIEWS'] || 0),
            likes: Number(row['LIKES'] || 0),
            comments: Number(row['COMMENTS'] || 0),
            saves: Number(row['SAVES'] || 0),
            shares: Number(row['SHARES'] || 0),
            status: 'Selesai'
          };
        });

        if (newReports.length > 0) {
          const { error } = await supabase.from('content_plans').upsert(newReports);
          if (error) throw error;
          alert(`Berhasil mengimpor ${newReports.length} laporan konten!`);
          const { data: updated } = await supabase.from('content_plans').select('*').order('postingDate', { ascending: false });
          if (updated) setPlans(updated);
          setIsManagingTemplate(false);
        }
      } catch (err: any) {
        alert("Gagal mengimpor: " + err.message);
      } finally {
        setIsProcessingExcel(false);
        if (contentFileInputRef.current) contentFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const calculateEngagementRate = (plan: ContentPlan) => {
    const views = plan.views || 0;
    if (views === 0) return '0%';
    const interactions = (plan.likes || 0) + (plan.comments || 0) + (plan.saves || 0) + (plan.shares || 0);
    const er = (interactions / views) * 100;
    return er.toFixed(2) + '%';
  };

  const CUSTOM_LINK_ICON = "https://lh3.googleusercontent.com/d/14IIco4Et4SqH7g1Qo9KqvsNMdPBabpzF";

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-12 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in duration-200" />
          <button className="absolute top-8 right-8 text-white"><Icons.Plus className="w-10 h-10 rotate-45" /></button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-[28px] text-cyan-400 shadow-xl shadow-cyan-500/10 shrink-0">
              <Icons.Video className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-slate-900 text-2xl sm:text-3xl tracking-tighter leading-none uppercase">Content Hub</h2>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Production & Performance</p>
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'sync' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
              </div>
            </div>
          </div>
          
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
             <select 
                value={selectedBrandFilter} 
                onChange={(e) => setSelectedBrandFilter(e.target.value)} 
                className="bg-slate-50 border border-slate-200 text-slate-900 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest px-6 py-4 rounded-xl sm:rounded-2xl outline-none focus:ring-2 focus:ring-cyan-400/20"
              >
                <option value="ALL">SEMUA BRAND</option>
                {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
             </select>
             {hasFullAccess && (
               <button 
                onClick={() => handleOpenModal()} 
                className="bg-slate-900 hover:bg-black text-[#FFC000] py-4 px-8 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95"
               >
                 <Icons.Plus className="w-4 h-4" /> BUAT REPORT
               </button>
             )}
          </div>
        </div>

        {hasFullAccess && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-6">
            <button 
              onClick={() => { setIsManagingTemplate(!isManagingTemplate); setIsManagingBrands(false); }} 
              className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${isManagingTemplate ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}
            >
              TEMPLATE
            </button>
            <button 
              onClick={() => { setIsManagingBrands(!isManagingBrands); setIsManagingTemplate(false); }} 
              className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${isManagingBrands ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}
            >
              QUOTA
            </button>
          </div>
        )}
      </div>

      {isManagingTemplate && hasFullAccess && (
        <div className="bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] shadow-xl border-4 border-slate-900/5 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 animate-in slide-in-from-top-4 duration-300">
           <div className="bg-emerald-50/50 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-emerald-100 space-y-6 flex flex-col items-center text-center group hover:bg-emerald-50 transition-colors">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Icons.Download className="w-6 h-6 sm:w-8 sm:h-8" /></div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">EKSPOR DATA LAPORAN</h3>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 leading-relaxed">Unduh seluruh riwayat performa konten ke Excel.</p>
              </div>
              <button onClick={handleExportExcel} className="w-full bg-emerald-600 text-white py-4 rounded-xl sm:rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all">MULAI EKSPOR</button>
           </div>
           <div className="bg-blue-50/50 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-blue-100 space-y-6 flex flex-col items-center text-center group hover:bg-blue-50 transition-colors">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 text-[#FFC000] rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Icons.Upload className="w-6 h-6 sm:w-8 sm:h-8" /></div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">IMPOR DATA LAPORAN</h3>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 leading-relaxed">Unggah laporan masal (views, likes, dll) dari Excel.</p>
              </div>
              <input type="file" ref={contentFileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
              <button onClick={() => contentFileInputRef.current?.click()} disabled={isProcessingExcel} className="w-full bg-slate-900 text-white py-4 rounded-xl sm:rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all">
                {isProcessingExcel ? 'MEMPROSES...' : 'UNGGAH EXCEL'}
              </button>
           </div>
        </div>
      )}

      {isManagingBrands && hasFullAccess && (
        <div className="bg-slate-900 p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] text-white space-y-8 animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <h3 className="text-xl font-black tracking-tight uppercase">Brand Quota Management</h3>
            <div className="w-full sm:w-auto flex gap-3">
              <input 
                type="text" 
                value={newBrandName} 
                onChange={e => setNewBrandName(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addBrand()} 
                placeholder="NAMA BRAND..." 
                className="flex-grow sm:flex-none bg-white/10 border border-white/20 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-cyan-500" 
              />
              <button onClick={addBrand} disabled={isSavingBrands} className="bg-cyan-500 text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 active:scale-95 transition-all">
                {isSavingBrands ? '...' : 'TAMBAH'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((b: any) => (
              <div key={b.name} className="bg-white/5 p-6 rounded-[28px] border border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black tracking-widest uppercase">{b.name}</span>
                  <button onClick={() => removeBrand(b.name)} disabled={isSavingBrands} className="text-red-400 hover:text-red-500 p-1.5 bg-red-500/10 rounded-lg"><Icons.Trash className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Target Konten Bulanan</label>
                  <input 
                    type="number" 
                    value={b.target} 
                    onChange={e => updateBrandField(b.name, 'target', parseInt(e.target.value) || 0)} 
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-cyan-500 text-white font-bold" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {brandStats.map(bs => (
          <div key={bs.name} className="min-w-[240px] sm:min-w-[280px] bg-white p-6 rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-sm space-y-4 transition-all hover:shadow-md hover:-translate-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-black uppercase tracking-widest">{bs.name}</span>
              <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg ${bs.remaining === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {bs.remaining === 0 ? 'GOAL REACHED' : `${bs.remaining} REMAINING`}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black text-slate-900">{bs.done}<span className="text-xs text-slate-300 ml-1 font-bold">/ {bs.target}</span></p>
              <p className="text-[10px] font-black text-slate-500">{Math.round(bs.progress)}%</p>
            </div>
            <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${bs.progress}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-[32px] sm:rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 text-[10px] font-black text-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-6">BRAND & TANGGAL</th>
                <th className="px-6 py-6">CREATOR</th>
                <th className="px-4 py-6 text-center">LINK</th>
                <th className="px-6 py-6">PERFORMANCE</th>
                <th className="px-4 py-6 text-center">ER%</th>
                <th className="px-8 py-6 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPlans.map(plan => {
                const er = calculateEngagementRate(plan);
                const erValue = parseFloat(er);
                return (
                  <tr key={plan.id} className="hover:bg-slate-50/50 transition-all group text-slate-900">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div 
                          onClick={() => plan.screenshotBase64 && setZoomedImage(plan.screenshotBase64)} 
                          className={`w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 transition-all ${plan.screenshotBase64 ? 'cursor-zoom-in hover:scale-105 active:scale-95' : ''}`}
                        >
                          {plan.screenshotBase64 ? <img src={plan.screenshotBase64} className="w-full h-full object-cover rounded-xl shadow-sm" alt="" /> : <Icons.Image className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-xs uppercase tracking-tight">{plan.brand}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{plan.postingDate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{getCreatorName(plan.creatorId || '')}</p>
                      <p className="text-[8px] text-slate-400 uppercase font-bold mt-1 tracking-widest">{plan.contentPillar}</p>
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex justify-center">
                        {plan.linkPostingan ? (
                          <a href={plan.linkPostingan} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center hover:bg-cyan-50 hover:border-cyan-200 transition-all shadow-sm active:scale-90">
                            <img src={CUSTOM_LINK_ICON} className="w-5 h-5 object-contain" alt="link" />
                          </a>
                        ) : (
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center opacity-20 grayscale"><img src={CUSTOM_LINK_ICON} className="w-5 h-5 object-contain" alt="no link" /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex gap-4 py-1">
                        <div className="text-center min-w-[35px]"><p className="text-[10px] font-black text-slate-900">{formatNumber(plan.views)}</p><p className="text-[7px] text-slate-400 font-black uppercase">Views</p></div>
                        <div className="text-center min-w-[35px]"><p className="text-[10px] font-black text-slate-900">{formatNumber(plan.likes)}</p><p className="text-[7px] text-slate-400 font-black uppercase">Likes</p></div>
                        <div className="text-center min-w-[35px]"><p className="text-[10px] font-black text-slate-900">{formatNumber(plan.comments)}</p><p className="text-[7px] text-slate-400 font-black uppercase">Comm</p></div>
                        <div className="text-center min-w-[35px]"><p className="text-[10px] font-black text-slate-900">{formatNumber(plan.saves)}</p><p className="text-[7px] text-slate-400 font-black uppercase">Save</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex justify-center">
                        <div className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black tracking-tight ${erValue >= 5 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>{er}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {hasFullAccess && (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleOpenModal(plan)} className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all active:scale-90"><Icons.Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(plan.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"><Icons.Trash className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPlans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tidak ada laporan konten ditemukan</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] sm:rounded-[48px] shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
            <div className="p-6 sm:p-10 border-b bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">{editingPlan ? 'EDIT REPORT KONTEN' : 'BUAT REPORT KONTEN BARU'}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visibel ID Performance Hub</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-4xl leading-none opacity-40 hover:opacity-100 transition-all font-light">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 sm:p-10 overflow-y-auto flex-grow space-y-8 custom-scrollbar bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">BRAND</label>
                      <select required value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-5 py-3.5 text-xs font-bold text-black focus:ring-2 focus:ring-cyan-400/20 outline-none">
                        {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PLATFORM</label>
                      <select value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-5 py-3.5 text-xs font-bold text-black focus:ring-2 focus:ring-cyan-400/20 outline-none">
                        <option value="TikTok">TikTok</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Shopee">Shopee</option>
                        <option value="Youtube">Youtube</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CREATOR</label>
                    <select required value={formData.creatorId} onChange={e => setFormData({...formData, creatorId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-5 py-3.5 text-xs font-bold text-black focus:ring-2 focus:ring-cyan-400/20 outline-none">
                      <option value="">Pilih Creator...</option>
                      {creatorList.map(c => <option key={c.id} value={c.id}>{c.nama.toUpperCase()}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TANGGAL POSTING</label>
                      <input required type="date" value={formData.postingDate} onChange={e => setFormData({...formData, postingDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-5 py-3.5 text-xs font-bold text-black focus:ring-2 focus:ring-cyan-400/20 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CONTENT PILLAR</label>
                      <select value={formData.contentPillar} onChange={e => setFormData({...formData, contentPillar: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-5 py-3.5 text-xs font-bold text-black focus:ring-2 focus:ring-cyan-400/20 outline-none">
                        {PILLAR_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">LINK POSTINGAN</label>
                    <input type="url" value={formData.linkPostingan} onChange={e => setFormData({...formData, linkPostingan: e.target.value})} placeholder="https://..." className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-5 py-3.5 text-xs font-bold text-black focus:ring-2 focus:ring-cyan-400/20 outline-none" />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] border border-slate-100 space-y-6">
                   <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 pb-3">PERFORMA STATISTIK</h3>
                   <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">VIEWS</label>
                        <input type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-black outline-none focus:border-cyan-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">LIKES</label>
                        <input type="number" value={formData.likes} onChange={e => setFormData({...formData, likes: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-black outline-none focus:border-cyan-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">COMMENTS</label>
                        <input type="number" value={formData.comments} onChange={e => setFormData({...formData, comments: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-black outline-none focus:border-cyan-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SAVES</label>
                        <input type="number" value={formData.saves} onChange={e => setFormData({...formData, saves: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-black outline-none focus:border-cyan-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SHARES</label>
                        <input type="number" value={formData.shares} onChange={e => setFormData({...formData, shares: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-black outline-none focus:border-cyan-400" />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">SCREENSHOT</label>
                        <input type="file" ref={screenshotInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        <button type="button" onClick={() => screenshotInputRef.current?.click()} className={`h-[42px] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${formData.screenshotBase64 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-slate-200 hover:border-cyan-400 shadow-sm'}`}>
                          <Icons.Camera className="w-3.5 h-3.5" /> {formData.screenshotBase64 ? 'TERLAMPIR' : 'UPLOAD'}
                        </button>
                      </div>
                   </div>
                   {formData.screenshotBase64 && (
                     <div className="mt-4 relative group">
                        <img src={formData.screenshotBase64} className="w-full h-32 object-cover rounded-2xl border border-slate-200 shadow-sm" alt="Preview" />
                        <button type="button" onClick={() => setFormData({...formData, screenshotBase64: ''})} className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity active:scale-90">&times;</button>
                     </div>
                   )}
                </div>
              </div>
              
              <div className="pt-8 border-t flex flex-col sm:flex-row gap-4">
                <button type="submit" className="flex-1 bg-slate-900 text-[#FFC000] py-5 rounded-2xl sm:rounded-[28px] font-black text-sm uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all">SIMPAN LAPORAN</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 bg-white border border-slate-200 text-slate-400 py-5 rounded-2xl sm:rounded-[28px] font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all">BATAL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModule;