
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { domToJpeg } from 'modern-screenshot';
import { Icons } from '../constants';
import { Quotation, QuotationItem } from '../types';
import { supabase } from '../services/supabaseClient';
import { useConfirmation } from '../contexts/ConfirmationContext';

interface QuotationModuleProps {
  company: string;
  onClose: () => void;
}

const COMPANY_DATA: Record<string, any> = {
  'Majova': {
    logo: "https://lh3.googleusercontent.com/d/1pjtSR-r2YJMexgm3hl6jtANdjbVn2FZD",
    logoYellow: "https://lh3.googleusercontent.com/d/1pjtSR-r2YJMexgm3hl6jtANdjbVn2FZD",
    name: "MAJOVA ID",
    address: "Jln Ciomas harapan Kp Neglasari RT 01/12 No 4, Ciomas, Kab Bogor, Jawa Barat 16610",
    phone: "+62 811-1743-005",
    email: "kontakmajova@gmail.com",
  },
  'Visibel': {
    logo: "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA",
    logoYellow: "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA",
    name: "VISIBEL ID",
    address: "Jln Ciomas harapan Kp Neglasari RT 01/12 No 4, Ciomas, Kab Bogor, Jawa Barat 16610",
    phone: "+62 811-1743-005",
    email: "kontakvisibel@gmail.com",
  },
  'Seller Space': {
    logo: "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w",
    name: "SELLER SPACE",
    address: "Jl. Terusan Soreang - Cipatik No.21, Pamekaran, Kec. Soreang, Kabupaten Bandung, Jawa Barat 40912",
    phone: "+62 811-1743-005",
    email: "sellerspace@gmail.com",
  }
};

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

// Yellow Visibel Logo from screenshot
const VISIBEL_YELLOW_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA"; // Using same for now, but I'll try to find a yellow one or use a filter

export const QuotationModule: React.FC<QuotationModuleProps> = ({ company, onClose }) => {
  const { confirm } = useConfirmation();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [dynamicCompanyData, setDynamicCompanyData] = useState<any>(null);

  const currentCompanyData = useMemo(() => {
    if (dynamicCompanyData) return dynamicCompanyData;
    const key = Object.keys(COMPANY_DATA).find(k => k.toLowerCase() === (company || '').toLowerCase());
    return COMPANY_DATA[key || (company.toLowerCase().includes('visibel') ? 'Visibel' : 'Majova')];
  }, [company, dynamicCompanyData]);

  const getTodayDMY = () => {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  };

  const [quotation, setQuotation] = useState<Quotation>({
    quotationNumber: `QTN-${new Date().getTime()}`,
    date: getTodayDMY(),
    validUntil: 'Berlaku selama 14 Hari',
    recipientName: 'MATAHARI DEPARTEMENT STORE',
    recipientAddress: 'Di Tempat',
    items: [
      { 
        id: '1', 
        service: 'LIVE STREAM MANAGEMENT', 
        facilities: '• 4.300 Jam Live Stream (Mixed for TikTok & Shopee)\n• Free Request Schedule\n• Free Request Camera or iPhone\n• Free Request Set Up Live Stream\n• Free Design Live Stream\n• 1 Host and 1 Operator\n• Report Daily\n• Account Management',
        rate: 516000000,
        qty: 1,
        amount: 400000000
      }
    ],
    additionalNotes: '• Live Stream Rp 150.000/Jam,\n• Added Host Rp 100.000/Jam,\n• Short Video Rp 250.000/Video,\n• Ads Management Fee 10% from Ads Revenue with Maximum Fee Management Rp 10.000.000/Month\n• Disarankan investasi ads di setiap platform',
    paymentTerms: 'Semua transaksi di transfer ke BANK BLUBYBCA 001190000168 An Muhammad Mahardhika Dibillah',
    company: company,
    subTotal: 400000000,
    total: 400000000,
    signatureName: 'MUHAMMAD MAHARDHIKA DIBILLAH'
  });

  const quotationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const { data: compDetails } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `company_details_${company}`)
          .maybeSingle();
        
        if (compDetails && compDetails.value) {
          const val = compDetails.value;
          setDynamicCompanyData({
            name: val.name || company,
            address: val.address || '',
            phone: val.phone || '',
            email: val.email || '',
            logo: val.logo || (company.toLowerCase().includes('seller') ? COMPANY_DATA['Seller Space'].logo : (company.toLowerCase().includes('visibel') ? COMPANY_DATA['Visibel'].logo : COMPANY_DATA['Majova'].logo))
          });
        }

        const { data: clientsData } = await supabase
          .from('clients')
          .select('*')
          .eq('company', company);
        if (clientsData) setClients(clientsData);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, [company]);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const handlePrint = async () => {
    if (!quotationRef.current || isSaving) return;
    setIsSaving(true);
    
    try {
      const element = quotationRef.current;
      
      const dataUrl = await domToJpeg(element, {
        quality: 0.8,
        scale: 2,
        backgroundColor: '#ffffff'
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Quotation_${quotation.recipientName}_${new Date().getTime()}.jpg`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Gagal men-download JPG");
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    const newItem: QuotationItem = {
      id: Math.random().toString(36).substr(2, 9),
      service: '',
      facilities: '',
      rate: 0,
      qty: 1,
      amount: 0
    };
    setQuotation({ ...quotation, items: [...quotation.items, newItem] });
  };

  const removeItem = (id: string) => {
    const newItems = quotation.items.filter(item => item.id !== id);
    setQuotation({ ...quotation, items: newItems });
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
    const newItems = quotation.items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'rate' || field === 'qty') {
          // In this specific design, amount might not be rate * qty if rate is "crossed out"
          // But usually it is. Let's keep it flexible.
        }
        return updated;
      }
      return item;
    });
    setQuotation({ ...quotation, items: newItems });
  };

  useEffect(() => {
    const subTotal = quotation.items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    setQuotation(prev => ({ ...prev, subTotal, total: subTotal }));
  }, [quotation.items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Editor Section */}
      <div className="w-full lg:w-1/3 space-y-6">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
            <div className="w-2 h-8 bg-[#FFC000] rounded-full"></div>
            Informasi Quotation
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nama Penerima</label>
              <div className="relative">
                <input 
                  type="text" 
                  list="clients-list"
                  value={quotation.recipientName}
                  onChange={(e) => {
                    const client = clients.find(c => c.namaPic === e.target.value || c.namaBrand === e.target.value);
                    setQuotation({ 
                      ...quotation, 
                      recipientName: e.target.value,
                      recipientAddress: client ? client.alamat : quotation.recipientAddress
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#FFC000] transition-all"
                  placeholder="NAMA CLIENT / BRAND"
                />
                <datalist id="clients-list">
                  {clients.map(c => (
                    <option key={c.id} value={c.namaBrand || c.namaPic} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Alamat / Lokasi</label>
              <textarea 
                value={quotation.recipientAddress}
                onChange={(e) => setQuotation({ ...quotation, recipientAddress: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#FFC000] transition-all h-24 resize-none"
                placeholder="ALAMAT PENERIMA"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Tanggal</label>
                <input 
                  type="text" 
                  value={quotation.date}
                  onChange={(e) => setQuotation({ ...quotation, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#FFC000] transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Berlaku Sampai</label>
                <input 
                  type="text" 
                  value={quotation.validUntil}
                  onChange={(e) => setQuotation({ ...quotation, validUntil: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#FFC000] transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
              Layanan & Harga
            </h3>
            <button 
              onClick={addItem}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
            >
              <Icons.Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {quotation.items.map((item, index) => (
              <div key={item.id} className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 relative group">
                <button 
                  onClick={() => removeItem(item.id)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                >
                  <Icons.Trash className="w-4 h-4" />
                </button>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Layanan</label>
                    <input 
                      type="text" 
                      value={item.service}
                      onChange={(e) => updateItem(item.id, 'service', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                      placeholder="Contoh: LIVE STREAM MANAGEMENT"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Fasilitas (Gunakan • untuk list)</label>
                    <textarea 
                      value={item.facilities}
                      onChange={(e) => updateItem(item.id, 'facilities', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none h-32 resize-none"
                      placeholder="• Fasilitas 1\n• Fasilitas 2"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Amount</label>
                    <input 
                      type="number" 
                      value={item.amount}
                      onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
            <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
            Tambahan & Ketentuan
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Informasi Tambahan</label>
              <textarea 
                value={quotation.additionalNotes}
                onChange={(e) => setQuotation({ ...quotation, additionalNotes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#FFC000] transition-all h-32 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Syarat Pembayaran</label>
              <textarea 
                value={quotation.paymentTerms}
                onChange={(e) => setQuotation({ ...quotation, paymentTerms: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-[#FFC000] transition-all h-24 resize-none"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handlePrint}
          disabled={isSaving}
          className="w-full bg-black text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Icons.Download className="w-5 h-5" />} 
          {isSaving ? 'GENERATING...' : 'DOWNLOAD QUOTATION PNG'}
        </button>
      </div>

      {/* Preview Section */}
      <div className="w-full lg:w-2/3 bg-slate-100 p-4 sm:p-10 rounded-[48px] overflow-auto flex justify-center items-start">
        <div 
          ref={quotationRef}
          className="bg-[#ffffff] w-[210mm] min-h-[297mm] flex flex-col relative text-[#0f172a] mx-auto shrink-0 overflow-hidden"
          style={{ 
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
        >
          {/* Header with Gradient */}
          <div className="relative h-[180px] w-full bg-[#000000] flex items-center px-12 overflow-hidden">
            {/* Gradient Overlay */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-1/2 opacity-40"
              style={{ background: 'linear-gradient(to left, rgba(109, 40, 217, 1), rgba(109, 40, 217, 0))' }}
            ></div>
            <div 
              className="absolute right-0 top-0 bottom-0 w-1/3 opacity-30"
              style={{ background: 'linear-gradient(to left, rgba(219, 39, 119, 1), rgba(219, 39, 119, 0))' }}
            ></div>
            
            <div className="relative z-10 flex justify-between w-full items-center">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <img 
                     src={getReliableDriveUrl(currentCompanyData.logo)} 
                     alt="Logo" 
                     className="h-10 w-auto" 
                     referrerPolicy="no-referrer"
                   />
                </div>
                <div className="text-[rgba(255,255,255,0.8)] text-[11px] font-medium leading-relaxed max-w-[400px]">
                  <p>{currentCompanyData.address}</p>
                  <p>{currentCompanyData.phone}</p>
                  <p>{currentCompanyData.email}</p>
                </div>
              </div>
              <div className="text-white text-right">
                <h1 className="text-4xl font-black tracking-tight uppercase">Quotation</h1>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-16 flex-grow flex flex-col">
            <div className="flex justify-between items-start mb-16">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#64748b]">Kepada,</p>
                <p className="text-xl font-black uppercase tracking-tight">{quotation.recipientName}</p>
                <p className="text-sm font-bold text-[#475569]">{quotation.recipientAddress}</p>
              </div>
              <div className="text-right space-y-2">
                <div>
                  <p className="text-sm font-medium text-[#64748b] inline-block mr-2">Tanggal:</p>
                  <p className="text-sm font-bold inline-block">{quotation.date}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#64748b] inline-block mr-2">Berlaku Sampai:</p>
                  <p className="text-sm font-bold inline-block">{quotation.validUntil}</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="mb-12">
              <table 
                className="w-full border-collapse rounded-2xl overflow-hidden border border-[#f1f5f9]"
                style={{ boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
              >
                <thead>
                  <tr className="bg-[#000000] text-[#ffffff]">
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center w-12">No</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-left w-48">Service</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-left whitespace-nowrap">Service Facilities</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-[#f1f5f9] last:border-0">
                      <td className="py-8 px-4 text-center text-xs font-black align-top">{idx + 1}</td>
                      <td className="py-8 px-4 text-xs font-black uppercase tracking-tight align-top w-48">{item.service}</td>
                      <td className="py-8 px-4 text-[10px] font-medium text-[#475569] leading-relaxed align-top">
                        {item.facilities.split('\n').map((line, i) => (
                          <p key={i} className="mb-1">{line}</p>
                        ))}
                      </td>
                      <td className="py-8 px-4 text-right text-xs font-black align-top whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Additional Section */}
            <div className="mb-16">
              <h4 className="text-sm font-black uppercase tracking-widest mb-4">Additional</h4>
              <div className="text-[10px] font-bold text-[#475569] space-y-2 leading-relaxed">
                {quotation.additionalNotes.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>

            {/* Terms & Signature */}
            <div className="mt-auto flex justify-between items-end">
              <div className="max-w-[400px]">
                <h4 className="text-[10px] font-black uppercase tracking-widest mb-4">Syarat & Ketentuan Pembayaran</h4>
                <p className="text-[10px] font-bold text-[#64748b] leading-relaxed">
                  {quotation.paymentTerms}
                </p>
              </div>

              <div className="text-center flex flex-col items-center min-w-[200px]">
                <p className="text-xs font-black uppercase tracking-widest mb-4">Hormat Kami,</p>
                <div className="relative flex flex-col items-center">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1jWL_jFNgYzihLR4esxMXmi99gJyTb9J5" 
                    alt="Signature" 
                    className="h-24 w-auto mb-[-20px] relative z-10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="w-48 h-[2px] bg-[#000000] mx-auto"></div>
                  <p className="text-xs font-black uppercase mt-4 tracking-tight">{quotation.signatureName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
