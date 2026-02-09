
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, ContentPlan } from '../types';
import { Icons, LIVE_BRANDS as INITIAL_BRANDS } from '../constants';
import { supabase } from '../App';
import { generateGoogleCalendarUrl } from '../utils/dateUtils';

interface ContentModuleProps {
  employees: Employee[];
  plans: ContentPlan[];
  setPlans: React.Dispatch<React.SetStateAction<ContentPlan[]>>;
  searchQuery?: string;
  userRole?: string;
  currentEmployee?: Employee | null;
  company: string;
}

const PILLAR_OPTIONS = ['Educational', 'Entertainment', 'Sales/Promo', 'Engagement', 'Behind the Scene', 'Inspirational'];

const ContentModule: React.FC<ContentModuleProps> = ({ employees, plans, setPlans, searchQuery: globalSearch = '', userRole = 'employee', currentEmployee = null, company }) => {
  const isCreator = useMemo(() => {
    const jabatan = (currentEmployee?.jabatan || '').toLowerCase();
    return jabatan.includes('content creator') || jabatan.includes('creator') || jabatan.includes('lead content');
  }, [currentEmployee]);

  const hasFullAccess = userRole === 'admin' || userRole === 'super' || userRole === 'owner' || isCreator;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ContentPlan | null>(null);
  const [dbStatus, setDbStatus] = useState<'sync' | 'local'>('sync');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const contentFileInputRef = useRef<HTMLInputElement>(null);

  const [isManagingBrands, setIsManagingBrands] = useState(false);
  const [isSavingBrands, setIsSavingBrands] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  const [brands, setBrands] = useState<any[]>(() => {
    const saved = localStorage.getItem('content_brands_config');
    if (saved) return JSON.parse(saved);
    return INITIAL_BRANDS.map(b => ({ name: b.name, target: 0, quotaDeadline: '', jamUpload: '19:00' }));
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
      const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Gagal sinkronisasi cloud content:", err);
      return false;
    }
  };

  const persistBrandsUpdate = async (updatedBrands: any[]) => {
    setIsSavingBrands(true);
    const success = await saveConfigToCloud('content_brands_config', updatedBrands);
    if (success) {
      setBrands(updatedBrands);
    } else {
      alert("Gagal menyimpan ke cloud. Coba lagi.");
    }
    setIsSavingBrands(false);
  };

  const addBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) return;
    if (brands.some((b: any) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Brand sudah ada!");
      return;
    }
    const updatedBrands = [...brands, { name: trimmed.toUpperCase(), target: 0, quotaDeadline: '', jamUpload: '19:00' }];
    await persistBrandsUpdate(updatedBrands);
    setNewBrandName('');
  };

  const removeBrand = async (name: string) => {
    if (!confirm(`Hapus brand "${name}" secara permanen?`)) return;
    const updatedBrands = brands.filter((b: any) => b.name !== name);
    await persistBrandsUpdate(updatedBrands);
  };

  const updateBrandLocal = (name: string, field: string, value: any) => {
    const updatedBrands = brands.map(b => b.name === name ? { ...b, [field]: value } : b);
    setBrands(updatedBrands);
  };

  const handleSaveSpecificBrand = async (name: string) => {
    setIsSavingBrands(true);
    const success = await saveConfigToCloud('content_brands_config', brands);
    if (success) {
      alert(`Config brand ${name} berhasil disimpan!`);
    } else {
      alert("Gagal menyimpan perubahan.");
    }
    setIsSavingBrands(false);
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
    company: company,
    platform: 'TikTok',
    creatorId: '',
    deadline: '',
    status: 'Selesai',
    notes: '',
    postingDate: new Date().toISOString().split('T')[0],
    jamUpload: '19:00',
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
    const finalSearch = (localSearch || globalSearch).toLowerCase();
    return plans.filter(p => {
      const matchesSearch = (p.brand || '').toLowerCase().includes(finalSearch) || (p.title || '').toLowerCase().includes(finalSearch);
      const matchesBrand = selectedBrandFilter === 'ALL' || p.brand === selectedBrandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [plans, globalSearch, localSearch, selectedBrandFilter]);

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
        jamUpload: plan.jamUpload || '19:00',
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
        company: company,
        platform: 'TikTok',
        creatorId: isCreator ? currentEmployee?.id || '' : '',
        deadline: '',
        status: 'Selesai',
        notes: '',
        postingDate: new Date().toISOString().split('T')[0],
        jamUpload: '19:00',
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
    const reportId = editingPlan?.id || `REP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // FIX: Destructure to remove jamUpload from DB payload while keeping it in memory
    const { jamUpload, ...formDataRest } = formData;

    const dataToSave = { 
      ...formDataRest, 
      title: finalTitle, 
      id: reportId, 
      status: 'Selesai' as const,
      likes: Number(formData.likes || 0),
      comments: Number(formData.comments || 0),
      views: Number(formData.views || 0),
      saves: Number(formData.saves || 0),
      shares: Number(formData.shares || 0),
      // Optional: append jamUpload to notes if you don't want to lose the info
      notes: `${formData.notes || ''}${jamUpload ? ` [Time: ${jamUpload}]` : ''}`.trim()
    };

    try {
      const { error } = await supabase.from('content_plans').upsert(dataToSave);
      
      if (error) {
        console.error("Supabase Error Detail:", error);
        throw error;
      }
      
      // Update state with the FULL data (including jamUpload for local display)
      const fullDataForState: ContentPlan = { ...dataToSave, jamUpload };
      
      setPlans(prev => {
        const idx = prev.findIndex(p => p.id === reportId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = fullDataForState;
          return updated;
        }
        return [fullDataForState, ...prev];
      });
      setIsModalOpen(false);
      setDbStatus('sync');
    } catch (err: any) {
      alert("Gagal menyimpan ke database: " + (err.message || "Kesalahan tidak diketahui"));
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
      alert("Gagal menghapus data: " + err.message);
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
          
          const MAX_DIM = 1000;
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
          
          let quality = 0.7;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          while (dataUrl.length * 0.75 > 100000 && quality > 0.1) {
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
      'JAM UPLOAD': p.jamUpload || '-',
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

  const handleDownloadTemplate = () => {
    const template = [
      {
        'COMPANY': company,
        'BRAND': 'BRAND CONTOH',
        'PLATFORM': 'TikTok',
        'TANGGAL POSTING': '2024-03-01',
        'JAM UPLOAD': '19:00',
        'CREATOR': 'NAMA CREATOR',
        'PILLAR': 'Entertainment',
        'LINK POSTINGAN': 'https://...',
        'VIEWS': 1000,
        'LIKES': 100,
        'COMMENTS': 10,
        'SAVES': 5,
        'SHARES': 2
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Laporan Konten");
    XLSX.writeFile(wb, `Template_Report_Konten_${company}.xlsx`);
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
        
        const rawParsedReports = jsonData.map((row: any) => {
          const brand = String(row['BRAND'] || '').toUpperCase().trim();
          if (!brand) return null;

          const postingDate = row['TANGGAL POSTING'] 
            ? (row['TANGGAL POSTING'] instanceof Date ? row['TANGGAL POSTING'].toISOString().split('T')[0] : String(row['TANGGAL POSTING'])) 
            : new Date().toISOString().split('T')[0];
          
          const jamUpload = String(row['JAM UPLOAD'] || '19:00');
          const platform = String(row['PLATFORM'] || 'TikTok');
          const link = String(row['LINK POSTINGAN'] || '').trim();
          
          // Deterministic Key for Deduplication and Mapping
          const externalKey = `${brand}_${postingDate}_${platform}`;

          return {
            externalKey,
            title: `${brand} - ${postingDate}`,
            brand: brand,
            company: String(row['COMPANY'] || company),
            platform: platform,
            postingDate: postingDate,
            jamUpload: jamUpload,
            creatorId: findCreatorIdByName(row['CREATOR']),
            contentPillar: String(row['PILLAR'] || 'Entertainment'),
            linkPostingan: link,
            views: Number(row['VIEWS'] || 0),
            likes: Number(row['LIKES'] || 0),
            comments: Number(row['COMMENTS'] || 0),
            saves: Number(row['SAVES'] || 0),
            shares: Number(row['SHARES'] || 0),
            status: 'Selesai'
          };
        }).filter(r => r !== null);

        if (rawParsedReports.length > 0) {
          // 1. Internal Deduplication (pilih yang view-nya paling banyak jika ada duplikat dalam 1 file)
          const fileDeduper = new Map<string, any>();
          rawParsedReports.forEach(r => {
            const existing = fileDeduper.get(r!.externalKey);
            if (!existing || r!.views > existing.views) {
              fileDeduper.set(r!.externalKey, r);
            }
          });

          // 2. Map to database records (link to existing ID if match brand/date/platform)
          const existingInDbMap = new Map<string, string>(); // brand_date_platform -> id
          plans.forEach(p => {
            const key = `${p.brand}_${p.postingDate}_${p.platform}`;
            if (p.id) existingInDbMap.set(key, p.id);
          });

          const finalToUpsert: any[] = [];
          fileDeduper.forEach((report, key) => {
            const existingId = existingInDbMap.get(key);
            // FIX: Remove jamUpload before sending to Supabase
            const { jamUpload, externalKey, ...dbPayload } = report;
            finalToUpsert.push({
              ...dbPayload,
              id: existingId || `REP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              notes: `${dbPayload.notes || ''}${jamUpload ? ` [Time: ${jamUpload}]` : ''}`.trim()
            });
          });

          const { data: inserted, error } = await supabase.from('content_plans').upsert(finalToUpsert).select();
          if (error) throw error;
          
          alert(`Berhasil memproses ${inserted?.length} laporan konten!`);
          const { data: updated } = await supabase.from('content_plans').select('*').order('postingDate', { ascending: false });
          if (updated) setPlans(updated);
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

  const handleSyncBrandToCalendar = (bs: any) => {
    if (!bs.quotaDeadline) {
      alert("Harap atur Deadline Quota terlebih dahulu.");
      return;
    }
    const url = generateGoogleCalendarUrl({
      title: `DEADLINE KONTEN: ${bs.name}`,
      details: `Target: ${bs.target} konten.\nStatus saat ini: ${bs.done}/${bs.target}.\nSistem: HR.Visibel ID`,
      date: bs.quotaDeadline,
      timeSlot: bs.jamUpload || '19:00'
    });
    window.open(url, '_blank');
  };

  const handleSyncItemToCalendar = (plan: ContentPlan) => {
    const url = generateGoogleCalendarUrl({
      title: `POSTING: ${plan.brand} (${plan.platform})`,
      details: `Pillar: ${plan.contentPillar}\nCreator: ${getCreatorName(plan.creatorId || '')}\nSistem: HR.Visibel ID`,
      date: plan.postingDate || new Date().toISOString().split('T')[0],
      timeSlot: plan.jamUpload || '19:00'
    });
    window.open(url, '_blank');
  };

  const CUSTOM_LINK_ICON = "https://lh3.googleusercontent.com/d/14IIco4Et4SqH7g1Qo9KqvsNMdPBabpzF";

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-12 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in duration-200" />
          <button className="absolute top-8 right-8 text-white"><Icons.Plus className="w-10 h-10 rotate-45" /></button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white rounded-[32px] sm:rounded-[48px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 sm:px-12 py-8 sm:py-14 border-b flex flex-col items-start bg-white gap-6 sm:gap-10">
            <div className="flex flex-col gap-2 sm:gap-3">
              <h2 className="font-black text-slate-900 uppercase tracking-tight text-2xl sm:text-5xl">Content Hub</h2>
              <div className="flex items-center gap-3">
                <span className="inline-block bg-slate-100 text-slate-500 text-[8px] sm:text-[10px] font-black uppercase px-4 sm:px-6 py-2 sm:2.5 rounded-full tracking-[0.2em] self-start">Production & Performance</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full ${dbStatus === 'sync' ? 'bg-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-50 animate-pulse'}`}></div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 sm:gap-8 w-full">
              <div className="flex items-center bg-[#f1f5f9] p-1 sm:p-1.5 rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-inner w-full xl:max-w-[700px]">
                <div className="relative shrink-0">
                   <div className="bg-[#0f172a] text-white px-5 sm:px-8 py-3.5 sm:py-4.5 h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] text-[9px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2 sm:gap-3 cursor-pointer shadow-lg active:scale-95 transition-all">
                     <span className="truncate max-w-[80px] sm:max-w-none">{selectedBrandFilter === 'ALL' ? 'SEMUA' : selectedBrandFilter}</span>
                     <Icons.ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                     <select 
                      value={selectedBrandFilter} 
                      onChange={(e) => setSelectedBrandFilter(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                     >
                        <option value="ALL">SEMUA BRAND</option>
                        {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                     </select>
                   </div>
                </div>

                <div className="relative flex-grow bg-white h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] shadow-sm border border-slate-100 px-4 sm:px-7 flex items-center gap-3 sm:gap-4 min-w-0 ml-1 sm:ml-1.5">
                  <Icons.Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="CARI..." 
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="w-full text-[10px] sm:text-xs font-black text-slate-800 outline-none placeholder:text-slate-300 uppercase tracking-widest bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-4 items-center shrink-0 w-full xl:w-auto">
                {hasFullAccess && (
                  <>
                    <button onClick={handleDownloadTemplate} className="flex-1 sm:flex-none bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 sm:px-8 h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] flex items-center justify-center gap-2 sm:gap-3 font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 text-slate-500">
                      <Icons.Download className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> TEMPLATE
                    </button>
                    <button onClick={() => setIsManagingBrands(!isManagingBrands)} className={`flex-1 sm:flex-none px-4 sm:px-8 h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-sm border ${isManagingBrands ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                      QUOTA
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex-1 sm:flex-none bg-[#FFC000] hover:bg-black text-black hover:text-white px-5 sm:px-10 h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] flex items-center justify-center gap-2 sm:gap-3 font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-amber-100 active:scale-95">
                      <Icons.Plus className="w-4 h-4 sm:w-5 sm:h-5" /> TAMBAH
                    </button>
                    <input type="file" ref={contentFileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
                    <button onClick={() => contentFileInputRef.current?.click()} disabled={isProcessingExcel} className="flex-1 sm:flex-none bg-[#059669] hover:bg-[#047857] text-white px-4 sm:px-9 h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] flex items-center justify-center gap-2 sm:gap-3 font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-50">
                      <Icons.Upload className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> {isProcessingExcel ? '...' : 'UNGGAH'}
                    </button>
                    <button onClick={handleExportExcel} className="flex-1 sm:flex-none bg-[#0f172a] hover:bg-black text-white px-4 sm:px-9 h-[42px] sm:h-[56px] rounded-[22px] sm:rounded-[26px] flex items-center justify-center gap-2 sm:gap-3 font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95">
                      <Icons.Database className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> EKSPOR
                    </button>
                  </>
                )}
              </div>
            </div>
        </div>
      </div>

      {isManagingBrands && hasFullAccess && (
        <div className="bg-[#0f172a] p-8 sm:p-12 rounded-[48px] text-white shadow-2xl space-y-12 animate-in slide-in-from-top-4 duration-500 border border-white/5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
            <div className="flex flex-col">
              <h3 className="text-3xl font-black tracking-tight uppercase leading-none">BRAND QUOTA MANAGEMENT</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-3">Target Performance Hub</p>
            </div>
            <div className="w-full sm:w-auto flex bg-[#1e293b] p-2 rounded-[28px] border border-white/5 shadow-inner">
              <input 
                type="text" 
                value={newBrandName} 
                onChange={e => setNewBrandName(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addBrand()} 
                placeholder="NAMA BRAND..." 
                className="bg-transparent px-7 py-3.5 text-[11px] font-black uppercase outline-none flex-grow min-w-[160px] placeholder:text-slate-600" 
              />
              <button onClick={addBrand} disabled={isSavingBrands} className="bg-[#06b6d4] hover:bg-[#0891b2] text-white px-8 py-3.5 rounded-[22px] text-[11px] font-black uppercase transition-all shadow-lg active:scale-95 disabled:opacity-50">
                {isSavingBrands ? '...' : 'TAMBAH'}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {brands.map((b: any) => (
              <div key={b.name} className="bg-[#1e293b] p-8 rounded-[40px] border border-white/5 space-y-8 group hover:border-[#06b6d4]/30 transition-all shadow-xl flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <span className="text-sm font-black tracking-[0.1em] uppercase text-white">{b.name}</span>
                  <button 
                    onClick={() => removeBrand(b.name)} 
                    disabled={isSavingBrands} 
                    className="w-12 h-12 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl flex items-center justify-center transition-all group/trash active:scale-90"
                  >
                    <Icons.Trash className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-6 flex-grow">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">TARGET KONTEN BULANAN</label>
                    <input 
                      type="number" 
                      value={b.target} 
                      onChange={e => updateBrandLocal(b.name, 'target', parseInt(e.target.value) || 0)} 
                      className="w-full bg-[#0f172a] border border-white/5 rounded-3xl px-7 py-5 text-lg outline-none focus:border-[#06b6d4] text-white font-black shadow-inner" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">DEADLINE</label>
                      <input 
                        type="date" 
                        value={b.quotaDeadline || ''} 
                        onChange={e => updateBrandLocal(b.name, 'quotaDeadline', e.target.value)} 
                        className="w-full bg-[#0f172a] border border-white/5 rounded-2xl px-5 py-4.5 text-xs outline-none focus:border-[#06b6d4] text-white font-black shadow-inner" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">TIME</label>
                      <input 
                        type="time" 
                        value={b.jamUpload || '19:00'} 
                        onChange={e => updateBrandLocal(b.name, 'jamUpload', e.target.value)} 
                        className="w-full bg-[#0f172a] border border-white/5 rounded-2xl px-5 py-4.5 text-xs outline-none focus:border-[#06b6d4] text-white font-black shadow-inner" 
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleSaveSpecificBrand(b.name)}
                  disabled={isSavingBrands}
                  className="w-full bg-[#06b6d4] hover:bg-[#0891b2] text-white py-5 rounded-[22px] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg active:scale-[0.98] transition-all mt-4 shrink-0 disabled:opacity-50"
                >
                  {isSavingBrands ? 'MENYIMPAN...' : 'SIMPAN KONFIGURASI'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS CARDS - SLIDER */}
      <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar scroll-smooth snap-x">
        {brandStats.map(bs => (
          <div key={bs.name} className="min-w-[280px] sm:min-w-[320px] bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[36px] border border-slate-100 shadow-sm space-y-5 sm:space-y-6 transition-all hover:shadow-xl hover:-translate-y-1 relative group overflow-hidden snap-start shrink-0">
            <div className="flex justify-between items-center relative z-10">
              <span className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-widest">{bs.name}</span>
              <button 
                onClick={() => handleSyncBrandToCalendar(bs)}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-50 group-hover:bg-[#FFC000] text-slate-400 group-hover:text-black rounded-xl transition-all flex items-center justify-center shadow-inner"
                title="Sync Deadline to Calendar"
              >
                <Icons.Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
            <div className="flex justify-between items-end relative z-10">
              <div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">{bs.done}<span className="text-xs sm:text-sm text-slate-300 ml-2 font-bold tracking-normal">/ {bs.target}</span></p>
                <p className={`text-[8px] sm:text-[9px] font-black px-2.5 sm:px-3 py-1 sm:py-1.5 mt-2 rounded-lg inline-block shadow-sm ${bs.remaining === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                  {bs.remaining === 0 ? 'GOAL ACHIEVED' : `${bs.remaining} REMAINING`}
                </p>
              </div>
              <p className="text-[10px] sm:text-xs font-black text-slate-900 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-100">{Math.round(bs.progress)}%</p>
            </div>
            <div className="h-1.5 sm:h-2 bg-slate-50 rounded-full overflow-hidden shadow-inner relative z-10 border border-slate-100">
              <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${bs.progress}%` }}></div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50 relative z-10">
               <div className="flex flex-col gap-0.5 sm:gap-1">
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">DEADLINE</span>
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-700">{bs.quotaDeadline || '-'}</span>
               </div>
               <div className="flex flex-col text-right gap-0.5 sm:gap-1">
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">UPLOAD TIME</span>
                  <span className="text-[10px] sm:text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg self-end">{bs.jamUpload || '-'}</span>
               </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-opacity -translate-y-1/2 translate-x-1/2"></div>
          </div>
        ))}
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar scroll-smooth">
          <table className="w-full text-left min-w-[1000px] border-separate border-spacing-0">
            <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-10 py-7 border-b border-slate-100">BRAND & TANGGAL</th>
                <th className="px-8 py-7 border-b border-slate-100">CREATOR</th>
                <th className="px-6 py-7 text-center border-b border-slate-100">LINK</th>
                <th className="px-8 py-7 border-b border-slate-100">PERFORMANCE</th>
                <th className="px-6 py-7 text-center border-b border-slate-100">ER%</th>
                <th className="px-10 py-7 text-right border-b border-slate-100">AKSI</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredPlans.map(plan => {
                const er = calculateEngagementRate(plan);
                const erValue = parseFloat(er);
                return (
                  <tr key={plan.id} className="hover:bg-slate-50/70 transition-all duration-300 group border-b border-slate-50 last:border-0">
                    <td className="px-10 py-8 whitespace-nowrap">
                      <div className="flex items-center gap-5">
                        <div 
                          onClick={() => plan.screenshotBase64 && setZoomedImage(plan.screenshotBase64)} 
                          className={`w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 transition-all shadow-inner border-2 border-white ring-1 ring-slate-100 ${plan.screenshotBase64 ? 'cursor-zoom-in hover:scale-105 active:scale-95 group-hover:rotate-2' : ''}`}
                        >
                          {plan.screenshotBase64 ? <img src={plan.screenshotBase64} className="w-full h-full object-cover rounded-xl" alt="" /> : <Icons.Image className="w-6 h-6" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <p className="font-black text-slate-900 text-[14px] uppercase tracking-tight">{plan.brand}</p>
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 shadow-sm uppercase tracking-tighter">{plan.jamUpload || '-'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{plan.postingDate}</p>
                            <button 
                              onClick={() => handleSyncItemToCalendar(plan)}
                              className="p-1.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-300"
                              title="Set Reminder"
                            >
                              <Icons.Calendar className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight leading-none">{getCreatorName(plan.creatorId || '')}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-[0.1em]">{plan.contentPillar}</p>
                    </td>
                    <td className="px-6 py-8">
                      <div className="flex justify-center">
                        {plan.linkPostingan ? (
                          <a href={plan.linkPostingan} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm active:scale-90 group/link">
                            <img src={CUSTOM_LINK_ICON} className="w-5.5 h-5.5 object-contain group-hover:scale-110 transition-transform" alt="link" />
                          </a>
                        ) : (
                          <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center opacity-10 grayscale border border-dashed border-slate-200"><img src={CUSTOM_LINK_ICON} className="w-5.5 h-5.5 object-contain" alt="no link" /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex gap-5">
                        <div className="text-center min-w-[45px]"><p className="text-[12px] font-black text-slate-900">{formatNumber(plan.views)}</p><p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-tighter">Views</p></div>
                        <div className="text-center min-w-[45px]"><p className="text-[12px] font-black text-slate-900">{formatNumber(plan.likes)}</p><p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-tighter">Likes</p></div>
                        <div className="text-center min-w-[45px]"><p className="text-[12px] font-black text-slate-900">{formatNumber(plan.comments)}</p><p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-tighter">Comm</p></div>
                        <div className="text-center min-w-[45px]"><p className="text-[12px] font-black text-slate-900">{formatNumber(plan.saves)}</p><p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-tighter">Save</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-8">
                      <div className="flex justify-center">
                        <div className={`inline-block px-5 py-2 rounded-2xl text-[11px] font-black tracking-tight border shadow-sm transition-all ${erValue >= 5 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{er}</div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right whitespace-nowrap">
                      {hasFullAccess && (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-3">
                          <button onClick={() => handleOpenModal(plan)} className="p-3 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-2xl transition-all active:scale-90 bg-white shadow-sm hover:shadow-md"><Icons.Edit className="w-5 h-5" /></button>
                          <button onClick={() => handleDelete(plan.id)} className="p-3 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-2xl transition-all active:scale-90 bg-white shadow-sm hover:shadow-md"><Icons.Trash className="w-5 h-5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPlans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                      <Icons.Database className="w-14 h-14" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">Laporan Tidak Ditemukan</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] sm:rounded-[56px] shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border border-white/20">
            <div className="p-8 sm:p-12 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase leading-none">{editingPlan ? 'EDIT REPORT KONTEN' : 'BUAT REPORT KONTEN BARU'}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em] mt-3">Visibel ID Performance Hub</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-4xl leading-none transition-all font-light">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 sm:p-12 overflow-y-auto flex-grow space-y-10 custom-scrollbar bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-14">
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">BRAND</label>
                      <select required value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner">
                        {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UPLOAD TIME</label>
                      <input required type="time" value={formData.jamUpload} onChange={e => setFormData({...formData, jamUpload: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner" />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CREATOR</label>
                    <select required value={formData.creatorId} onChange={e => setFormData({...formData, creatorId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner">
                      <option value="">PILIH CREATOR...</option>
                      {creatorList.map(c => <option key={c.id} value={c.id}>{c.nama.toUpperCase()}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TANGGAL POSTING</label>
                      <input required type="date" value={formData.postingDate} onChange={e => setFormData({...formData, postingDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner" />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PLATFORM</label>
                      <select value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner">
                        <option value="TikTok">TikTok</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Shopee">Shopee</option>
                        <option value="Youtube">Youtube</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CONTENT PILLAR</label>
                    <select value={formData.contentPillar} onChange={e => setFormData({...formData, contentPillar: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner">
                      {PILLAR_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">LINK POSTINGAN</label>
                    <input type="url" value={formData.linkPostingan} onChange={e => setFormData({...formData, linkPostingan: e.target.value})} placeholder="https://..." className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4.5 text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-400/10 outline-none transition-all shadow-inner" />
                  </div>
                </div>

                <div className="bg-slate-50 p-8 sm:p-10 rounded-[40px] border border-slate-100 space-y-10 shadow-inner">
                   <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] border-b border-slate-200 pb-4">PERFORMA STATISTIK</h3>
                   <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">VIEWS</label>
                        <input type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-400/10 transition-all shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LIKES</label>
                        <input type="number" value={formData.likes} onChange={e => setFormData({...formData, likes: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-400/10 transition-all shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">COMMENTS</label>
                        <input type="number" value={formData.comments} onChange={e => setFormData({...formData, comments: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-400/10 transition-all shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SAVES</label>
                        <input type="number" value={formData.saves} onChange={e => setFormData({...formData, saves: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-400/10 transition-all shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SHARES</label>
                        <input type="number" value={formData.shares} onChange={e => setFormData({...formData, shares: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-400/10 transition-all shadow-sm" />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">SCREENSHOT</label>
                        <input type="file" ref={screenshotInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        <button type="button" onClick={() => screenshotInputRef.current?.click()} className={`h-[56px] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border shadow-sm ${formData.screenshotBase64 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-400'}`}>
                          <Icons.Camera className="w-4.5 h-4.5" /> {formData.screenshotBase64 ? 'TERLAMPIR' : 'UPLOAD'}
                        </button>
                      </div>
                   </div>
                   {formData.screenshotBase64 && (
                     <div className="mt-6 relative group">
                        <img src={formData.screenshotBase64} className="w-full h-44 object-cover rounded-[32px] border border-slate-200 shadow-md group-hover:brightness-90 transition-all" alt="Preview" />
                        <button type="button" onClick={() => setFormData({...formData, screenshotBase64: ''})} className="absolute top-4 right-4 bg-rose-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity active:scale-90">&times;</button>
                     </div>
                   )}
                </div>
              </div>
              
              <div className="pt-10 border-t flex flex-col sm:flex-row gap-5">
                <button type="submit" className="flex-1 bg-slate-900 text-[#FFC000] py-6 rounded-[32px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl active:scale-[0.98] transition-all hover:bg-black">SIMPAN LAPORAN</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-14 bg-white border border-slate-200 text-slate-400 py-6 rounded-[32px] font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all">BATAL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModule;
