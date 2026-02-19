
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icons } from '../constants.tsx';
import { Invoice, InvoiceItem } from '../types.ts';
import { supabase } from '../App.tsx';

interface InvoiceModuleProps {
  company: string;
  onClose: () => void;
}

const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";

export const InvoiceModule: React.FC<InvoiceModuleProps> = ({ company, onClose }) => {
  const [sequence, setSequence] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);

  const getInvoiceNumber = (seq: number) => {
    const now = new Date();
    const year2Digit = now.getFullYear().toString().slice(-2);
    return `INV-VSB/${now.getDate()}/${now.getMonth() + 1}/${year2Digit}/${String(seq).padStart(3, '0')}`;
  };

  const getTodayDMY = () => {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  };

  const [invoice, setInvoice] = useState<Invoice>({
    invoiceNumber: getInvoiceNumber(1),
    date: getTodayDMY(),
    recipientName: '',
    recipientAddress: '',
    items: [
      { id: '1', description: '7 FOTO PRODUK (Rp 35.000/Foto) & 1 SHORT VIDEO (Rp 150.000/Video)', qty: 1, price: 395000 }
    ],
    bankName: 'BLU BY BCA',
    bankBranch: 'KCU Bogor',
    bankSwiftCode: 'BBLUIDJA',
    accountName: 'Muhammad Mahardhika Dibillah',
    accountNumber: '0011900000168',
    paymentReference: 'INV-VSB/26/II/001',
    company: company,
    subTotal: 395000,
    taxRate: 0,
    total: 395000
  });

  const invoiceRef = useRef<HTMLDivElement>(null);

  // Fetch latest sequence, draft and clients from Supabase
  useEffect(() => {
    const initInvoice = async () => {
      setIsLoading(true);
      try {
        // Get clients
        const { data: clientsData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `clients_${company}`)
          .maybeSingle();
        
        if (clientsData && Array.isArray(clientsData.value)) {
          setClients(clientsData.value);
        }

        // Get the latest sequence from settings
        const { data: seqData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `invoice_sequence_${company}`)
          .maybeSingle();
        
        const currentSeq = seqData?.value || 1;
        setSequence(currentSeq);

        // Get the latest draft/last invoice from history to populate fields
        const { data: historyData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `invoice_history_${company}`)
          .maybeSingle();

        const history = historyData?.value && Array.isArray(historyData.value) ? historyData.value : [];
        const lastInvoice = history.length > 0 ? history[history.length - 1] : null;

        if (lastInvoice) {
          setInvoice({
            ...lastInvoice,
            id: undefined, // Don't reuse ID
            invoiceNumber: getInvoiceNumber(currentSeq),
            date: getTodayDMY(),
          });
        } else {
          setInvoice(prev => ({
            ...prev,
            invoiceNumber: getInvoiceNumber(currentSeq)
          }));
        }
      } catch (err) {
        console.error("Error initializing invoice:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initInvoice();
  }, [company]);

  const formatLongDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return dateStr;
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const calculateTotals = (items: InvoiceItem[], taxRate: number) => {
    const subTotal = items.reduce((acc, item) => acc + (item.qty * item.price), 0);
    const taxAmount = subTotal * (taxRate / 100);
    return { subTotal, total: subTotal - taxAmount };
  };

  const handleAddItem = () => {
    const newItems = [...invoice.items, { id: Date.now().toString(), description: '', qty: 1, price: 0 }];
    const { subTotal, total } = calculateTotals(newItems, invoice.taxRate);
    setInvoice({ ...invoice, items: newItems, subTotal, total });
  };

  const handleRemoveItem = (id: string) => {
    const newItems = invoice.items.filter(item => item.id !== id);
    const { subTotal, total } = calculateTotals(newItems, invoice.taxRate);
    setInvoice({ ...invoice, items: newItems, subTotal, total });
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    const newItems = invoice.items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    const { subTotal, total } = calculateTotals(newItems, invoice.taxRate);
    setInvoice({ ...invoice, items: newItems, subTotal, total });
  };

  const handleTaxChange = (rate: number) => {
    const { subTotal, total } = calculateTotals(invoice.items, rate);
    setInvoice({ ...invoice, taxRate: rate, subTotal, total });
  };

  const handleRecipientChange = (brandName: string) => {
    const selectedClient = clients.find(c => c.namaBrand === brandName);
    if (selectedClient) {
      setInvoice({
        ...invoice,
        recipientName: selectedClient.namaBrand,
        recipientAddress: selectedClient.alamat
      });
    } else {
      setInvoice({
        ...invoice,
        recipientName: brandName,
        recipientAddress: ''
      });
    }
  };

  const handlePrint = async () => {
    if (!invoiceRef.current || isSaving) return;
    setIsSaving(true);
    
    try {
      // 1. Save invoice to history in settings table (since invoices table doesn't exist)
      try {
        const { data: historyData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `invoice_history_${company}`)
          .maybeSingle();
        
        const history = historyData?.value && Array.isArray(historyData.value) ? historyData.value : [];
        const newHistory = [...history, { ...invoice, created_at: new Date().toISOString() }].slice(-100); // Keep last 100

        await supabase.from('settings').upsert({
          key: `invoice_history_${company}`,
          value: newHistory
        }, { onConflict: 'key' });
      } catch (historyErr) {
        console.error("Error saving to history:", historyErr);
      }
      
      // 2. Update sequence in cloud
      const nextSeq = sequence + 1;
      const { error: seqError } = await supabase
        .from('settings')
        .upsert({ 
          key: `invoice_sequence_${company}`, 
          value: nextSeq 
        }, { onConflict: 'key' });
      
      if (seqError) throw seqError;

      // 3. Send Inbox Notification to Owner & Super Admin
      try {
        const { data: admins } = await supabase
          .from('employees')
          .select('id')
          .eq('company', company)
          .in('role', ['owner', 'super']);
        
        if (admins && admins.length > 0) {
          const adminIds = admins.map(a => a.id);
          await supabase.from('broadcasts').insert([{
            title: 'INVOICE BARU DITERBITKAN',
            message: `Invoice ${invoice.invoiceNumber} untuk ${invoice.recipientName} senilai ${formatCurrency(invoice.total)} telah berhasil diterbitkan.`,
            company: company,
            targetEmployeeIds: adminIds,
            sentAt: new Date().toISOString()
          }]);
        }
      } catch (notifErr) {
        console.error("Gagal mengirim notifikasi inbox:", notifErr);
      }

      // 4. Generate PNG
      const element = invoiceRef.current;
      if (!element) return;

      try {
        // @ts-ignore
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: -window.scrollY,
          windowWidth: element.clientWidth,
          backgroundColor: '#ffffff'
        });

        const image = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.href = image;
        link.download = `Invoice_${invoice.invoiceNumber}.png`;
        link.click();
      } catch (imgErr) {
        console.error("Gagal generate PNG:", imgErr);
        alert("Gagal mengunduh PNG. Silakan coba lagi.");
      }

      // 4. Update local state for next invoice
      setSequence(nextSeq);
      setInvoice(prev => ({
        ...prev,
        invoiceNumber: getInvoiceNumber(nextSeq),
        date: getTodayDMY()
      }));

      alert("Invoice berhasil disimpan dan diunduh!");
    } catch (err: any) {
      console.error("Error saving invoice:", err);
      alert("Gagal menyimpan invoice ke cloud: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('Rp', 'Rp');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      {/* Form Section */}
      <div className="w-full lg:w-1/3 space-y-6 bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 overflow-y-auto max-h-[85vh] no-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">BUAT INVOICE</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <Icons.ArrowLeft className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">NOMOR INVOICE</label>
            <input 
              type="text" 
              value={invoice.invoiceNumber}
              onChange={(e) => setInvoice({ ...invoice, invoiceNumber: e.target.value })}
              className="w-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl px-6 py-4 text-lg font-black outline-none focus:border-[#FFC000] transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">TANGGAL</label>
            <input 
              type="text" 
              value={invoice.date}
              onChange={(e) => setInvoice({ ...invoice, date: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-lg font-black outline-none focus:border-[#FFC000] transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">KEPADA (CLIENT)</label>
              <select 
                value={invoice.recipientName}
                onChange={(e) => handleRecipientChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-[14px] font-black outline-none focus:border-[#FFC000] transition-colors cursor-pointer"
              >
                <option value="">PILIH CLIENT</option>
                {clients.map(client => (
                  <option key={client.id} value={client.namaBrand}>{client.namaBrand} ({client.namaPic})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">ALAMAT</label>
              <textarea 
                value={invoice.recipientAddress}
                onChange={(e) => setInvoice({ ...invoice, recipientAddress: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-[14px] font-black outline-none focus:border-[#FFC000] transition-colors min-h-[100px]"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ITEM LAYANAN</label>
              <button onClick={handleAddItem} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700">
                <Icons.Plus className="w-3 h-3" /> TAMBAH ITEM
              </button>
            </div>
            {invoice.items.map((item, index) => (
              <div key={item.id} className="p-4 bg-slate-50 rounded-3xl mb-4 space-y-3 border border-slate-100 relative">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black text-slate-300 uppercase">ITEM #{index + 1}</span>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-rose-500 hover:text-rose-600">
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
                <input 
                  type="text" 
                  placeholder="Keterangan"
                  value={item.description}
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="number" 
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                  />
                  <input 
                    type="number" 
                    placeholder="Harga"
                    value={item.price}
                    onChange={(e) => handleItemChange(item.id, 'price', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">PAJAK (%)</label>
            <input 
              type="number" 
              placeholder="0"
              value={invoice.taxRate}
              onChange={(e) => handleTaxChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#FFC000] transition-colors"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Pembayaran</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Bank</label>
                <input 
                  type="text" 
                  value={invoice.bankName}
                  onChange={(e) => setInvoice({ ...invoice, bankName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cabang</label>
                <input 
                  type="text" 
                  value={invoice.bankBranch}
                  onChange={(e) => setInvoice({ ...invoice, bankBranch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Swift Code</label>
                <input 
                  type="text" 
                  value={invoice.bankSwiftCode}
                  onChange={(e) => setInvoice({ ...invoice, bankSwiftCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Akun</label>
                <input 
                  type="text" 
                  value={invoice.accountName}
                  onChange={(e) => setInvoice({ ...invoice, accountName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nomor Akun</label>
                <input 
                  type="text" 
                  value={invoice.accountNumber}
                  onChange={(e) => setInvoice({ ...invoice, accountNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Referensi</label>
                <input 
                  type="text" 
                  value={invoice.paymentReference}
                  onChange={(e) => setInvoice({ ...invoice, paymentReference: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handlePrint}
          disabled={isSaving}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 mt-8 disabled:opacity-50"
        >
          {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Icons.Download className="w-4 h-4" />} 
          {isSaving ? 'SAVING...' : 'DOWNLOAD PNG'}
        </button>
      </div>

      {/* Preview Section */}
      <div className="w-full lg:w-2/3 bg-slate-200 p-4 sm:p-10 rounded-[48px] overflow-auto flex justify-center items-start">
        <div 
          ref={invoiceRef}
          className="bg-white w-[210mm] shadow-2xl min-h-[297mm] p-12 flex flex-col relative text-slate-900 mx-auto shrink-0"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-12">
            <img src={VISIBEL_LOGO} alt="Visibel Logo" className="h-16 w-auto" />
            <div className="text-right max-w-[300px]">
              <h1 className="text-2xl font-black mb-2 tracking-tight">VISIBEL ID</h1>
              <p className="text-[10px] leading-relaxed font-medium text-slate-600">
                Alamat : Jalan Ciomas Harapan Kp neglasari RT 01/12 No 4, Ciomas, Kab Bogor, Jawa Barat 16610<br />
                Email : kontakvisibel@gmail.com<br />
                NPWP : 73.263.744.2-404.000
              </p>
            </div>
          </div>

          {/* Recipient & Invoice Info */}
          <div className="flex justify-between items-end mb-12">
            <div className="space-y-1 max-w-[300px]">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">KEPADA</h3>
              <p className="text-sm font-bold uppercase">{invoice.recipientName}</p>
              <p className="text-[10px] font-bold uppercase text-slate-500 leading-relaxed">{invoice.recipientAddress}</p>
            </div>
            <div className="bg-[#FFF3E0] p-6 rounded-none min-w-[250px] text-right">
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-1">INVOICE</h2>
              <p className="text-lg font-black tracking-tight mb-1">{invoice.invoiceNumber}</p>
              <p className="text-xs font-bold text-slate-600">{formatLongDate(invoice.date)}</p>
            </div>
          </div>

          {/* Table */}
          <div className="flex-grow">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FFFF00]">
                  <th className="text-left py-3 px-4 text-sm font-black uppercase tracking-widest border-r border-white/20">KETERANGAN</th>
                  <th className="text-center py-3 px-4 text-sm font-black uppercase tracking-widest border-r border-white/20">QTY</th>
                  <th className="text-right py-3 px-4 text-sm font-black uppercase tracking-widest border-r border-white/20">HARGA (Rp)</th>
                  <th className="text-right py-3 px-4 text-sm font-black uppercase tracking-widest">JUMLAH (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="py-4 px-4 text-[11px] font-bold uppercase leading-relaxed max-w-[300px] border-r border-slate-100">{item.description}</td>
                    <td className="py-4 px-4 text-center text-sm font-black border-r border-slate-100">{item.qty}</td>
                    <td className="py-4 px-4 text-right text-sm font-bold border-r border-slate-100">{formatCurrency(item.price).replace('Rp', '')}</td>
                    <td className="py-4 px-4 text-right text-sm font-black">{formatCurrency(item.qty * item.price).replace('Rp', '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-[400px]">
                <div className="flex justify-between items-center bg-slate-100 py-2 px-4 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest">SUB TOTAL</span>
                  <span className="text-sm font-black">{formatCurrency(invoice.subTotal)}</span>
                </div>
                {invoice.taxRate > 0 && (
                  <div className="flex justify-between items-center bg-slate-50 py-2 px-4 mb-1 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest">PAJAK ({invoice.taxRate}%)</span>
                    <span className="text-sm font-black text-rose-600">-{formatCurrency(invoice.subTotal * (invoice.taxRate / 100))}</span>
                  </div>
                )}
                <div className="flex justify-between items-center bg-[#FFFF00] py-3 px-4">
                  <span className="text-sm font-black uppercase tracking-widest">TOTAL</span>
                  <span className="text-lg font-black">{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="mt-12 flex justify-between items-end">
            <div className="bg-[#FFF3E0] p-6 rounded-none min-w-[350px]">
              <h4 className="text-sm font-black uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Detail Pembayaran</h4>
              <div className="space-y-2 text-[11px] font-bold">
                <div className="flex">
                  <span className="w-32">Nama Bank</span>
                  <span className="mr-2">:</span>
                  <span>{invoice.bankName}</span>
                </div>
                <div className="flex">
                  <span className="w-32">Cabang Bank</span>
                  <span className="mr-2">:</span>
                  <span>{invoice.bankBranch}</span>
                </div>
                <div className="flex">
                  <span className="w-32">Bank/Swift Code</span>
                  <span className="mr-2">:</span>
                  <span>{invoice.bankSwiftCode}</span>
                </div>
                <div className="flex">
                  <span className="w-32">Nama Akun</span>
                  <span className="mr-2">:</span>
                  <span>{invoice.accountName}</span>
                </div>
                <div className="flex">
                  <span className="w-32">Nomor Akun</span>
                  <span className="mr-2">:</span>
                  <span>{invoice.accountNumber}</span>
                </div>
                <div className="flex">
                  <span className="w-32">Referensi Pembayaran</span>
                  <span className="mr-2">:</span>
                  <span>{invoice.paymentReference}</span>
                </div>
              </div>
            </div>

            <div className="text-center pr-8 flex flex-col items-center">
              <p className="text-sm font-bold mb-2">Hormat Kami,</p>
              <div className="relative flex flex-col items-center">
                <img 
                  src="https://lh3.googleusercontent.com/d/1jWL_jFNgYzihLR4esxMXmi99gJyTb9J5" 
                  alt="Signature" 
                  className="h-24 w-auto mb-[-20px] relative z-10"
                  referrerPolicy="no-referrer"
                />
                <div className="w-48 h-px bg-slate-900 mx-auto"></div>
                <p className="text-sm font-black uppercase mt-2 underline">Muhammad Mahardhika D</p>
              </div>
            </div>
          </div>

          {/* Bottom Yellow Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#FFFF00]"></div>
        </div>
      </div>
    </div>
  );
};
