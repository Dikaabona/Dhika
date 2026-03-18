
import React, { useState, useMemo } from 'react';
import { AdvertisingRecord, UserRole } from '../types';
import { Icons, ADS_BRANDS } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AdvertisingModuleProps {
  records: AdvertisingRecord[];
  userRole: UserRole;
  company: string;
  onRefresh: () => void;
  onClose: () => void;
}

export const AdvertisingModule: React.FC<AdvertisingModuleProps> = ({
  records,
  userRole,
  company,
  onRefresh,
  onClose,
}) => {
  const [view, setView] = useState<'performance' | 'brands'>('performance');
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [minGMV, setMinGMV] = useState<number | ''>('');
  const [minROI, setMinROI] = useState<number | ''>('');
  const [minPurchase, setMinPurchase] = useState<number | ''>('');
  const [isAdding, setIsAdding] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newRecord, setNewRecord] = useState<Partial<AdvertisingRecord>>({
    date: new Date().toISOString().split('T')[0],
    brand: '',
    grossRevenue: 0,
    cost: 0,
    purchase: 0,
  });

  // Fetch brands from settings
  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `advertising_brands_${company}`)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data && data.value) {
        setBrands(data.value);
        if (data.value.length > 0 && !newRecord.brand) {
          setNewRecord(prev => ({ ...prev, brand: data.value[0].name }));
        }
      } else {
        // Use default from constants if none in DB
        setBrands(ADS_BRANDS);
        if (ADS_BRANDS.length > 0) {
          setNewRecord(prev => ({ ...prev, brand: ADS_BRANDS[0].name }));
        }
      }
    } catch (err) {
      console.error("Error fetching brands:", err);
      setBrands(ADS_BRANDS);
    }
  };

  React.useEffect(() => {
    fetchBrands();
  }, [company]);

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return;
    
    const colors = ['bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-indigo-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const updatedBrands = [...brands, { name: newBrandName.trim().toUpperCase(), color: randomColor }];
    
    try {
      const { error } = await supabase.from('settings').upsert({
        key: `advertising_brands_${company}`,
        value: updatedBrands,
        company
      });
      
      if (error) throw error;
      
      setBrands(updatedBrands);
      setNewBrandName('');
      setIsAddingBrand(false);
    } catch (err: any) {
      alert("Gagal menambah brand: " + err.message);
    }
  };

  const handleDeleteBrand = async (brandName: string) => {
    if (!confirm(`Hapus brand ${brandName}? Data performa yang sudah ada tidak akan terhapus, tapi brand ini tidak akan muncul lagi di pilihan.`)) return;
    
    const updatedBrands = brands.filter(b => b.name !== brandName);
    
    try {
      const { error } = await supabase.from('settings').upsert({
        key: `advertising_brands_${company}`,
        value: updatedBrands,
        company
      });
      
      if (error) throw error;
      
      setBrands(updatedBrands);
    } catch (err: any) {
      alert("Gagal menghapus brand: " + err.message);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesSearch = rec.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (rec.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand = brandFilter === 'ALL' || rec.brand === brandFilter;
      const matchesDate = (!dateFilter.start || rec.date >= dateFilter.start) && 
                         (!dateFilter.end || rec.date <= dateFilter.end);
      const matchesGMV = minGMV === '' || rec.grossRevenue >= minGMV;
      const matchesPurchase = minPurchase === '' || rec.purchase >= minPurchase;
      const roi = rec.cost > 0 ? rec.grossRevenue / rec.cost : 0;
      const matchesROI = minROI === '' || roi >= minROI;

      return matchesSearch && matchesBrand && matchesDate && matchesGMV && matchesPurchase && matchesROI;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, searchQuery, brandFilter, dateFilter, minGMV, minROI, minPurchase]);

  const handleSave = async () => {
    if (!newRecord.date || !newRecord.brand) return alert("Tanggal dan Brand wajib diisi.");
    
    try {
      const payload = {
        ...newRecord,
        company,
      };
      
      const { error } = await supabase.from('advertising_records').upsert(payload);
      if (error) throw error;
      
      setIsAdding(false);
      onRefresh();
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        brand: brands[0]?.name || '',
        grossRevenue: 0,
        cost: 0,
        purchase: 0,
      });
    } catch (err: any) {
      alert("Gagal menyimpan data: " + err.message);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
      {/* Header */}
      <div className="bg-white px-8 py-6 flex items-center justify-between border-b border-slate-100 relative z-10">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-[28px] font-black text-slate-900 uppercase tracking-tighter">Ecommerce Ads</h2>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <Icons.X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {/* Sub-menu / Tabs */}
      <div className="px-8 flex gap-8 border-b border-slate-100 bg-white">
        <button 
          onClick={() => setView('performance')} 
          className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative ${view === 'performance' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          Performance
          {view === 'performance' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setView('brands')} 
          className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative ${view === 'brands' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          Brands
          {view === 'brands' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
      </div>

      {view === 'performance' ? (
        <>
          {/* Toolbar */}
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search notes or brand..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>

          {/* Numeric Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input 
                type="number" 
                placeholder="Min GMV" 
                value={minGMV === 0 ? 0 : (minGMV || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setMinGMV('');
                  else {
                    const num = parseFloat(val);
                    setMinGMV(isNaN(num) ? '' : num);
                  }
                }}
                className="w-28 pl-3 pr-2 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
              />
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Min ROI" 
                value={minROI === 0 ? 0 : (minROI || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setMinROI('');
                  else {
                    const num = parseFloat(val);
                    setMinROI(isNaN(num) ? '' : num);
                  }
                }}
                className="w-24 pl-3 pr-2 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
              />
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Min Purc" 
                value={minPurchase === 0 ? 0 : (minPurchase || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setMinPurchase('');
                  else {
                    const num = parseFloat(val);
                    setMinPurchase(isNaN(num) ? '' : num);
                  }
                }}
                className="w-24 pl-3 pr-2 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
              />
            </div>
          </div>

          {/* Brand Filter */}
          <div className="relative">
            <select 
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
            >
              <option value="ALL">ALL BRANDS</option>
              {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <Icons.ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          <input 
            type="date" 
            value={dateFilter.start}
            onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
            className="px-3 py-2 text-xs font-bold outline-none bg-transparent"
          />
          <span className="text-slate-300">→</span>
          <input 
            type="date" 
            value={dateFilter.end}
            onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
            className="px-3 py-2 text-xs font-bold outline-none bg-transparent"
          />
        </div>

        {/* Add Button */}
        {(userRole === 'owner' || userRole === 'super' || userRole === 'admin') && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-[#0F172A] text-[#FFC000] px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Icons.Plus className="w-4 h-4" />
            ADD DATA
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-white">
        {[
          { label: 'TOTAL GMV', value: formatCurrency(filteredRecords.reduce((acc, r) => acc + r.grossRevenue, 0)), color: 'text-emerald-600' },
          { label: 'TOTAL COST', value: formatCurrency(filteredRecords.reduce((acc, r) => acc + r.cost, 0)), color: 'text-rose-600' },
          { label: 'AVG ROI', value: (filteredRecords.reduce((acc, r) => acc + (r.cost > 0 ? r.grossRevenue / r.cost : 0), 0) / (filteredRecords.length || 1)).toFixed(2), color: 'text-blue-600' },
          { label: 'PURCHASE', value: filteredRecords.reduce((acc, r) => acc + r.purchase, 0), color: 'text-slate-900' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="min-w-[800px]">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Brand</th>
                <th className="px-6 py-4 text-right">Gross Revenue</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">CPO</th>
                <th className="px-6 py-4 text-right">ROI</th>
                <th className="px-6 py-4 text-right">Purchase</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec) => {
                const cpo = rec.purchase > 0 ? rec.cost / rec.purchase : 0;
                const roi = rec.cost > 0 ? rec.grossRevenue / rec.cost : 0;
                return (
                  <tr key={rec.id} className="group bg-white hover:bg-slate-50 transition-all cursor-pointer border border-slate-100 rounded-2xl shadow-sm">
                    <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{new Date(rec.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(rec.date).toLocaleDateString('id-ID', { weekday: 'long' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-100">
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                        {rec.brand}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-100 text-right">
                      <span className="text-sm font-black text-emerald-600">{formatCurrency(rec.grossRevenue)}</span>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-100 text-right">
                      <span className="text-sm font-black text-rose-500">{formatCurrency(rec.cost)}</span>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-100 text-right">
                      <span className="text-sm font-black text-slate-700">{formatCurrency(cpo)}</span>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-100 text-right">
                      <div className={`inline-block px-3 py-1 rounded-lg font-black text-xs ${roi >= 3 ? 'bg-emerald-100 text-emerald-700' : roi >= 1.5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {roi.toFixed(2)}x
                      </div>
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-100 text-right">
                      <span className="text-sm font-black text-slate-900">{rec.purchase}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Icons.Layers className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">No records found</p>
            </div>
          )}
        </div>
      </div>
    </>
  ) : (
    <div className="flex-1 p-8 bg-slate-50 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ads Brands Management</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">List of brands using advertising services</p>
              </div>
              {(userRole === 'owner' || userRole === 'super' || userRole === 'superadmin' || userRole === 'admin') && (
                <button 
                  onClick={() => setIsAddingBrand(true)}
                  className="bg-slate-900 text-[#FFC000] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <Icons.Plus className="w-4 h-4" />
                  ADD BRAND
                </button>
              )}
            </div>

            {isAddingBrand && (
              <div className="mb-8 p-6 bg-white rounded-[32px] border-2 border-slate-900 shadow-xl animate-in slide-in-from-top-4 duration-300">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">New Brand Name</p>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="ENTER BRAND NAME..."
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-slate-900 uppercase"
                    autoFocus
                  />
                  <button 
                    onClick={() => setIsAddingBrand(false)}
                    className="px-6 py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddBrand}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    Save Brand
                  </button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {brands.map((brand) => (
                <div key={brand.name} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${brand.color} flex items-center justify-center font-black text-xs text-white`}>
                      {brand.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-tight">{brand.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Client</p>
                    </div>
                  </div>
                  {(userRole === 'owner' || userRole === 'super' || userRole === 'superadmin' || userRole === 'admin') && (
                    <button 
                      onClick={() => handleDeleteBrand(brand.name)}
                      className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Icons.Trash className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {brands.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                  <Icons.Layers className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No brands registered yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900 p-8">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Add Performance Data</h3>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Input daily advertising metrics</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                  <input 
                    type="date" 
                    value={newRecord.date}
                    onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</label>
                  <select 
                    value={newRecord.brand}
                    onChange={(e) => setNewRecord({...newRecord, brand: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Revenue (GMV)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rp</span>
                  <input 
                    type="number" 
                    value={newRecord.grossRevenue ?? 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      setNewRecord({...newRecord, grossRevenue: isNaN(num) ? 0 : num});
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ad Cost</label>
                  <input 
                    type="number" 
                    value={newRecord.cost ?? 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      setNewRecord({...newRecord, cost: isNaN(num) ? 0 : num});
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase</label>
                  <input 
                    type="number" 
                    value={newRecord.purchase ?? 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      setNewRecord({...newRecord, purchase: isNaN(num) ? 0 : num});
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Save Performance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
