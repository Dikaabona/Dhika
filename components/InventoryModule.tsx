import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';
import * as XLSX from 'xlsx';

interface InventoryModuleProps {
  company: string;
  userRole: string;
  onClose: () => void;
}

const InventoryModule: React.FC<InventoryModuleProps> = ({ company, userRole, onClose }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const isOwner = userRole === 'owner';

  const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    sku: '',
    category: 'Elektronik',
    stock: 0,
    minStock: 1,
    unit: 'Unit',
    price: 0,
    company: company
  });

  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.category));
    return ['Elektronik', 'Furnitur', 'Kendaraan', 'Perlengkapan', 'Lainnya', ...Array.from(set)].filter((v, i, a) => a.indexOf(v) === i);
  }, [items]);

  useEffect(() => {
    fetchInventory();
    if (isOwner) fetchCompanies();
  }, [company, isOwner]);

  const fetchCompanies = async () => {
    try {
      const { data } = await supabase.from('employees').select('company');
      const unique = Array.from(new Set((data || []).map((e: any) => e.company || 'Visibel'))).sort() as string[];
      setAllCompanies(unique);
    } catch (e) {}
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('inventory').select('*').order('name', { ascending: true });
      if (!isOwner) query = query.eq('company', company);
      
      const { data, error } = await query;
      if (error) throw error;

      const mappedData = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        stock: item.stock,
        minStock: item.min_stock,
        unit: item.unit,
        price: item.price,
        company: item.company,
        lastUpdated: item.last_updated
      }));

      setItems(mappedData);
    } catch (err) {
      console.warn("Gagal menarik data aset dari database.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (item?: InventoryItem) => {
    if (!isAdmin) return;
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        sku: '',
        category: 'Elektronik',
        stock: 0,
        minStock: 1,
        unit: 'Unit',
        price: 0,
        company: company
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { 
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        stock: formData.stock,
        min_stock: formData.minStock,
        unit: formData.unit,
        price: formData.price,
        company: formData.company,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('inventory')
        .upsert(editingItem ? { ...payload, id: editingItem.id } : payload);

      if (error) throw error;
      fetchInventory();
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus aset ini dari inventaris?')) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== id));
    } catch (err) {}
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  const handleExport = () => {
    const dataToExport = filteredItems.map(item => ({
      'KODE ASET': item.sku,
      'NAMA ASET': item.name,
      'KATEGORI': item.category,
      'COMPANY': item.company,
      'KUANTITAS': item.stock,
      'SATUAN': item.unit,
      'NILAI SATUAN': item.price,
      'TOTAL NILAI': item.stock * item.price
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, `Data_Aset_${company}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'KODE ASET': 'AST-001',
        'NAMA ASET': 'MacBook Pro M3',
        'KATEGORI': 'Elektronik',
        'COMPANY': company,
        'KUANTITAS': 1,
        'SATUAN': 'Unit',
        'NILAI SATUAN': 35000000,
        'MINIMUM STOCK': 1
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Aset");
    XLSX.writeFile(wb, `Template_Import_Aset_${company}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const newItemsRaw = jsonData.map((row: any) => ({
          sku: String(row['KODE ASET'] || '').trim().toUpperCase(),
          name: String(row['NAMA ASET'] || '').trim().toUpperCase(),
          category: String(row['KATEGORI'] || 'Lainnya'),
          company: String(row['COMPANY'] || company),
          stock: Number(row['KUANTITAS'] || 0),
          unit: String(row['SATUAN'] || 'Unit'),
          price: Number(row['NILAI SATUAN'] || 0),
          min_stock: Number(row['MINIMUM STOCK'] || 0),
          last_updated: new Date().toISOString()
        })).filter(i => i.name && i.sku);

        if (newItemsRaw.length > 0) {
          // Deduplicate internally within the batch to prevent ON CONFLICT issues
          const dedupedMap = new Map<string, any>();
          newItemsRaw.forEach(item => {
            dedupedMap.set(item.sku, item);
          });
          const finalItems = Array.from(dedupedMap.values());

          const { error } = await supabase.from('inventory').upsert(finalItems, { onConflict: 'sku' });
          if (error) throw error;
          alert(`Berhasil mengimpor ${finalItems.length} aset!`);
          fetchInventory();
        }
      } catch (err: any) {
        alert("Gagal impor: " + (err.message || "Pastikan format file benar."));
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700">
      {/* ... (UI code remains the same) */}
      <div className="bg-white rounded-[40px] sm:rounded-[48px] p-8 sm:p-12 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div className="bg-[#0f172a] p-5 rounded-3xl text-[#FFC000] shadow-xl">
               <Icons.Database className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">Aset & Inventaris</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3">Company Assets Management</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {isAdmin && (
              <>
                <button onClick={handleDownloadTemplate} className="bg-slate-50 hover:bg-slate-100 text-slate-500 px-6 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-2">
                  <Icons.Download className="w-4 h-4" /> TEMPLATE
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-6 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-2">
                  <Icons.Upload className="w-4 h-4" /> {isImporting ? 'PROSES...' : 'IMPORT'}
                </button>
              </>
            )}
            <button onClick={handleExport} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm">EXPORT EXCEL</button>
            {isAdmin && (
              <button onClick={() => handleOpenModal()} className="bg-[#0f172a] hover:bg-black text-[#FFC000] px-10 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                <Icons.Plus className="w-4 h-4" /> TAMBAH ASET
              </button>
            )}
          </div>
        </div>
        {/* ... (remaining component code) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
           <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 flex items-center gap-6">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm"><Icons.Database className="w-7 h-7" /></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Aset</p><p className="text-3xl font-black text-slate-900">{items.length}</p></div>
           </div>
           <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 flex items-center gap-6">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm"><Icons.Sparkles className="w-7 h-7" /></div>
              <div><p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Nilai Aset</p><p className="text-xl font-black text-emerald-900">Rp {items.reduce((s, i) => s + (i.stock * i.price), 0).toLocaleString('id-ID')}</p></div>
           </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
           <div className="relative flex-grow">
              <Icons.Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="text" 
                placeholder="Cari nama aset atau kode SKU..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 pl-16 pr-8 py-5 rounded-[28px] text-sm font-bold outline-none focus:border-[#FFC000] focus:bg-white transition-all text-black"
              />
           </div>
           <select 
            value={selectedCategory} 
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border-2 border-slate-100 px-10 py-5 rounded-[28px] text-sm font-black uppercase tracking-widest outline-none cursor-pointer text-black"
           >
              <option value="ALL">SEMUA KATEGORI</option>
              {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
           </select>
        </div>

        <div className="overflow-x-auto no-scrollbar">
           <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <tr>
                    <th className="px-10 py-6 rounded-tl-[32px]">KODE & NAMA ASET</th>
                    <th className="px-6 py-6">KATEGORI</th>
                    <th className="px-6 py-6">COMPANY</th>
                    <th className="px-6 py-6">KUANTITAS</th>
                    <th className="px-6 py-6">NILAI SATUAN</th>
                    <th className="px-10 py-6 text-right rounded-tr-[32px]">AKSI</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredItems.map(item => (
                   <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6">
                         <p className="text-[13px] font-black text-slate-900 uppercase">{item.name}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.sku}</p>
                      </td>
                      <td className="px-6 py-6">
                         <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-indigo-100">{item.category}</span>
                      </td>
                      <td className="px-6 py-6">
                         <span className="text-[11px] font-black text-slate-700 uppercase">{item.company}</span>
                      </td>
                      <td className="px-6 py-6">
                         <div className="flex flex-col">
                            <span className={`text-sm font-black ${item.stock <= item.minStock ? 'text-rose-500' : 'text-slate-900'}`}>{item.stock} {item.unit}</span>
                            {item.stock <= item.minStock && <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">LOW QTY</span>}
                         </div>
                      </td>
                      <td className="px-6 py-6">
                         <p className="text-sm font-black text-slate-700">Rp {item.price.toLocaleString('id-ID')}</p>
                      </td>
                      <td className="px-10 py-6 text-right">
                         {isAdmin && (
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => handleOpenModal(item)} className="p-3 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all"><Icons.Edit className="w-5 h-5" /></button>
                              <button onClick={() => handleDelete(item.id)} className="p-3 text-rose-500 hover:bg-rose-100 rounded-2xl transition-all"><Icons.Trash className="w-5 h-5" /></button>
                           </div>
                         )}
                      </td>
                   </tr>
                 ))}
                 {filteredItems.length === 0 && (
                   <tr>
                      <td colSpan={6} className="px-10 py-20 text-center text-slate-300 uppercase font-black tracking-widest">Aset tidak ditemukan</td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
             <div className="p-8 sm:p-10 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tight">{editingItem ? 'Edit Aset' : 'Tambah Aset Baru'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-4xl leading-none font-black opacity-40 hover:opacity-100">&times;</button>
             </div>
             
             <form onSubmit={handleSave} className="p-8 sm:p-12 overflow-y-auto space-y-6 flex-grow custom-scrollbar bg-white">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Aset</label>
                   <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black text-black outline-none focus:border-[#FFC000] text-black" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kode Aset / SKU</label>
                      <input required type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black text-black outline-none focus:border-[#FFC000] text-black" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                      <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none text-black">
                         <option value="Elektronik" className="text-black">Elektronik</option>
                         <option value="Furnitur" className="text-black">Furnitur</option>
                         <option value="Kendaraan" className="text-black">Kendaraan</option>
                         <option value="Perlengkapan" className="text-black">Perlengkapan</option>
                         <option value="Lainnya" className="text-black">Lainnya</option>
                      </select>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Company</label>
                   <select required value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000] text-black">
                      {!isOwner && <option value={company}>{company}</option>}
                      {isOwner && allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah Aset</label>
                      <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000] text-black" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batas Minimum</label>
                      <input required type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000] text-black" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Satuan</label>
                      <input required type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000] text-black" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nilai Aset Per Satuan (Rp)</label>
                   <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000] text-black" />
                </div>
                
                <button type="submit" className="w-full bg-slate-900 text-[#FFC000] py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all mt-6">Simpan Data Aset</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryModule;
