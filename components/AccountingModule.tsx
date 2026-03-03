
import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from '../constants.tsx';
import { Account, JournalEntry, JournalItem, FixedAsset, PurchaseRecord, SaleRecord } from '../types.ts';
import { supabase } from '../App';

interface AccountingModuleProps {
  company: string;
  onClose: () => void;
}

type AccountingTab = 'JURNAL' | 'BUKU BESAR' | 'PEMBELIAN' | 'PENJUALAN' | 'AKTIVA TETAP' | 'HPP' | 'LAPORAN';

const DEFAULT_ACCOUNTS: Omit<Account, 'id' | 'company'>[] = [
  { code: '1-1000', name: 'Kas', category: 'Asset', normalBalance: 'Debit' },
  { code: '1-1100', name: 'Bank', category: 'Asset', normalBalance: 'Debit' },
  { code: '1-1200', name: 'Piutang Usaha', category: 'Asset', normalBalance: 'Debit' },
  { code: '1-1300', name: 'Persediaan Barang Jadi', category: 'Asset', normalBalance: 'Debit' },
  { code: '1-1400', name: 'Persediaan Bahan Baku', category: 'Asset', normalBalance: 'Debit' },
  { code: '1-2000', name: 'Aset Tetap', category: 'Asset', normalBalance: 'Debit' },
  { code: '1-2100', name: 'Akumulasi Penyusutan', category: 'Asset', normalBalance: 'Credit' },
  { code: '2-1000', name: 'Hutang Usaha', category: 'Liability', normalBalance: 'Credit' },
  { code: '3-1000', name: 'Modal', category: 'Equity', normalBalance: 'Credit' },
  { code: '4-1000', name: 'Penjualan', category: 'Revenue', normalBalance: 'Credit' },
  { code: '5-1000', name: 'Harga Pokok Penjualan', category: 'Expense', normalBalance: 'Debit' },
  { code: '6-1000', name: 'Beban Gaji', category: 'Expense', normalBalance: 'Debit' },
  { code: '6-2000', name: 'Beban Sewa', category: 'Expense', normalBalance: 'Debit' },
  { code: '6-3000', name: 'Beban Penyusutan', category: 'Expense', normalBalance: 'Debit' },
];

export const AccountingModule: React.FC<AccountingModuleProps> = ({ company, onClose }) => {
  const [activeTab, setActiveTab] = useState<AccountingTab>('JURNAL');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAccountingData();
  }, [company]);

  const fetchAccountingData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Accounts
      const { data: accountsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `accounting_accounts_${company}`)
        .maybeSingle();

      if (accountsData?.value) {
        setAccounts(accountsData.value);
      } else {
        // Initialize default accounts if none exist
        const initialAccounts = DEFAULT_ACCOUNTS.map((a, i) => ({
          ...a,
          id: `acc-${Date.now()}-${i}`,
          company
        })) as Account[];
        setAccounts(initialAccounts);
        await supabase.from('settings').upsert({
          key: `accounting_accounts_${company}`,
          value: initialAccounts
        });
      }

      // 2. Fetch Journal Entries
      const { data: journalData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `accounting_journal_${company}`)
        .maybeSingle();
      if (journalData?.value) setJournalEntries(journalData.value);

      // 3. Fetch Purchases
      const { data: purchaseData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `accounting_purchases_${company}`)
        .maybeSingle();
      if (purchaseData?.value) setPurchases(purchaseData.value);

      // 4. Fetch Sales
      const { data: salesData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `accounting_sales_${company}`)
        .maybeSingle();
      if (salesData?.value) setSales(salesData.value);

      // 5. Fetch Fixed Assets
      const { data: assetData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `accounting_assets_${company}`)
        .maybeSingle();
      if (assetData?.value) setFixedAssets(assetData.value);

    } catch (e) {
      console.error("Error fetching accounting data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const saveJournal = async (newEntries: JournalEntry[]) => {
    try {
      await supabase.from('settings').upsert({
        key: `accounting_journal_${company}`,
        value: newEntries
      });
      setJournalEntries(newEntries);
    } catch (e) {
      alert("Gagal menyimpan jurnal");
    }
  };

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    items: [
      { id: '1', accountId: '', accountName: '', debit: 0, credit: 0 },
      { id: '2', accountId: '', accountName: '', debit: 0, credit: 0 }
    ]
  });

  const savePurchases = async (newPurchases: PurchaseRecord[]) => {
    try {
      await supabase.from('settings').upsert({ key: `accounting_purchases_${company}`, value: newPurchases });
      setPurchases(newPurchases);
    } catch (e) {}
  };

  const saveSales = async (newSales: SaleRecord[]) => {
    try {
      await supabase.from('settings').upsert({ key: `accounting_sales_${company}`, value: newSales });
      setSales(newSales);
    } catch (e) {}
  };

  const saveAssets = async (newAssets: FixedAsset[]) => {
    try {
      await supabase.from('settings').upsert({ key: `accounting_assets_${company}`, value: newAssets });
      setFixedAssets(newAssets);
    } catch (e) {}
  };

  const [hppParams, setHppParams] = useState({
    persediaanAwal: 0,
    persediaanAkhir: 0,
    biayaTenagaKerja: 0,
    biayaOverhead: 0
  });

  const [activeReportTab, setActiveReportTab] = useState<'WORKSHEET' | 'BALANCE' | 'PROFIT_LOSS'>('WORKSHEET');

  const handleAddAsset = async (asset: Omit<FixedAsset, 'id' | 'company'>) => {
    const assetId = `asset-${Date.now()}`;
    const newAsset: FixedAsset = { ...asset, id: assetId, company };
    const updatedAssets = [...fixedAssets, newAsset];
    await saveAssets(updatedAssets);

    // Auto Journal: Debit Fixed Asset, Credit Bank
    const assetAcc = accounts.find(a => a.name === 'Aset Tetap') || accounts[0];
    const bankAcc = accounts.find(a => a.name === 'Bank') || accounts[0];

    const entry: JournalEntry = {
      id: `je-asset-${Date.now()}`,
      date: asset.purchaseDate,
      description: `PEROLEHAN ASET: ${asset.name}`,
      reference: assetId,
      company,
      type: 'Adjustment',
      items: [
        { id: '1', accountId: assetAcc.id, accountName: assetAcc.name, debit: asset.purchasePrice, credit: 0 },
        { id: '2', accountId: bankAcc.id, accountName: bankAcc.name, debit: 0, credit: asset.purchasePrice }
      ]
    };
    await saveJournal([entry, ...journalEntries]);
  };

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState<Partial<FixedAsset>>({
    purchaseDate: new Date().toISOString().split('T')[0],
    name: '',
    category: 'Peralatan',
    purchasePrice: 0,
    salvageValue: 0,
    usefulLifeYears: 4,
    depreciationMethod: 'Straight Line'
  });

  const handleAddSale = async (sale: Omit<SaleRecord, 'id' | 'company'>) => {
    const saleId = `sale-${Date.now()}`;
    const newSale: SaleRecord = { ...sale, id: saleId, company };
    const updatedSales = [newSale, ...sales];
    await saveSales(updatedSales);

    // Auto Journal: Debit Cash/Bank/AR, Credit Revenue
    const bankAcc = accounts.find(a => a.name === 'Bank') || accounts[0];
    const arAcc = accounts.find(a => a.name.includes('Piutang')) || accounts[0];
    const revenueAcc = accounts.find(a => a.category === 'Revenue') || accounts[0];

    const entry: JournalEntry = {
      id: `je-sale-${Date.now()}`,
      date: sale.date,
      description: `PENJUALAN KEPADA ${sale.customerName}`,
      reference: saleId,
      company,
      type: 'Sale',
      items: [
        { id: '1', accountId: sale.status === 'Paid' ? bankAcc.id : arAcc.id, accountName: sale.status === 'Paid' ? bankAcc.name : arAcc.name, debit: sale.totalAmount, credit: 0 },
        { id: '2', accountId: revenueAcc.id, accountName: revenueAcc.name, debit: 0, credit: sale.totalAmount }
      ]
    };
    await saveJournal([entry, ...journalEntries]);
  };

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [newSale, setNewSale] = useState<Partial<SaleRecord>>({
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    items: [{ description: '', qty: 1, unitPrice: 0, total: 0 }],
    status: 'Paid',
    totalAmount: 0
  });

  const handleAddPurchase = async (purchase: Omit<PurchaseRecord, 'id' | 'company'>) => {
    const purchaseId = `pur-${Date.now()}`;
    const newPurchase: PurchaseRecord = { ...purchase, id: purchaseId, company };
    const updatedPurchases = [newPurchase, ...purchases];
    await savePurchases(updatedPurchases);

    // Auto Journal: Debit Inventory/Expense, Credit Cash/Bank/AP
    const rawMaterialAcc = accounts.find(a => a.name.includes('Bahan Baku')) || accounts[0];
    const bankAcc = accounts.find(a => a.name === 'Bank') || accounts[0];
    const apAcc = accounts.find(a => a.name.includes('Hutang')) || accounts[0];

    const entry: JournalEntry = {
      id: `je-pur-${Date.now()}`,
      date: purchase.date,
      description: `PEMBELIAN DARI ${purchase.supplierName}`,
      reference: purchaseId,
      company,
      type: 'Purchase',
      items: [
        { id: '1', accountId: rawMaterialAcc.id, accountName: rawMaterialAcc.name, debit: purchase.totalAmount, credit: 0 },
        { id: '2', accountId: purchase.status === 'Paid' ? bankAcc.id : apAcc.id, accountName: purchase.status === 'Paid' ? bankAcc.name : apAcc.name, debit: 0, credit: purchase.totalAmount }
      ]
    };
    await saveJournal([entry, ...journalEntries]);
  };

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [newPurchase, setNewPurchase] = useState<Partial<PurchaseRecord>>({
    date: new Date().toISOString().split('T')[0],
    supplierName: '',
    items: [{ description: '', qty: 1, unitPrice: 0, total: 0 }],
    status: 'Paid',
    totalAmount: 0
  });

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebit = newEntry.items?.reduce((s, i) => s + i.debit, 0) || 0;
    const totalCredit = newEntry.items?.reduce((s, i) => s + i.credit, 0) || 0;

    if (totalDebit !== totalCredit) {
      alert("Debit dan Kredit harus seimbang!");
      return;
    }

    const entry: JournalEntry = {
      id: `je-${Date.now()}`,
      date: newEntry.date!,
      description: newEntry.description!,
      items: newEntry.items!.map(item => ({
        ...item,
        accountName: accounts.find(a => a.id === item.accountId)?.name || ''
      })),
      company,
      type: 'General'
    };

    const updatedJournal = [entry, ...journalEntries];
    await saveJournal(updatedJournal);
    setIsJournalModalOpen(false);
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      description: '',
      items: [
        { id: '1', accountId: '', accountName: '', debit: 0, credit: 0 },
        { id: '2', accountId: '', accountName: '', debit: 0, credit: 0 }
      ]
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-white rounded-[48px] p-8 sm:p-12 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div className="bg-[#0f172a] p-5 rounded-3xl text-[#FFC000] shadow-xl">
              <Icons.Database className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">AKUNTANSI & KEUANGAN</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3">Sistem Pencatatan Ganda (Double Entry)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-slate-50 rounded-full transition-colors">
            <Icons.ArrowLeft className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-[#f1f5f9] p-1.5 rounded-2xl border border-slate-100 shadow-inner gap-1 mb-12">
          {(['JURNAL', 'BUKU BESAR', 'PEMBELIAN', 'PENJUALAN', 'AKTIVA TETAP', 'HPP', 'LAPORAN'] as AccountingTab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Sub-module Content */}
        <div className="min-h-[500px]">
          {activeTab === 'JURNAL' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">JURNAL UMUM</h3>
                <button
                  onClick={() => setIsJournalModalOpen(true)}
                  className="bg-[#0f172a] text-[#FFC000] px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Icons.Plus className="w-4 h-4" /> TAMBAH ENTRI
                </button>
              </div>

              <div className="bg-[#f8fafc] rounded-[32px] border border-slate-100 overflow-hidden shadow-inner">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-6">TANGGAL</th>
                      <th className="px-8 py-6">KETERANGAN / AKUN</th>
                      <th className="px-8 py-6 text-right">DEBIT</th>
                      <th className="px-8 py-6 text-right">KREDIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {journalEntries.map(entry => (
                      <React.Fragment key={entry.id}>
                        <tr className="bg-slate-50/50">
                          <td className="px-8 py-4 text-[10px] font-black text-slate-900">{entry.date}</td>
                          <td colSpan={3} className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">{entry.description}</td>
                        </tr>
                        {entry.items.map(item => (
                          <tr key={item.id} className="hover:bg-white transition-colors">
                            <td className="px-8 py-3"></td>
                            <td className={`px-8 py-3 text-[11px] font-bold uppercase ${item.credit > 0 ? 'pl-16 text-slate-500' : 'text-slate-800'}`}>
                              {item.accountName}
                            </td>
                            <td className="px-8 py-3 text-right text-[11px] font-black tabular-nums">
                              {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                            </td>
                            <td className="px-8 py-3 text-right text-[11px] font-black tabular-nums">
                              {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    {journalEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                          <Icons.Database className="w-12 h-12" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em]">BELUM ADA DATA JURNAL</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'BUKU BESAR' && (
            <div className="space-y-10">
              {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(acc => {
                const ledgerItems = journalEntries.flatMap(entry =>
                  entry.items.filter(item => item.accountId === acc.id).map(item => ({
                    date: entry.date,
                    description: entry.description,
                    debit: item.debit,
                    credit: item.credit
                  }))
                ).sort((a, b) => a.date.localeCompare(b.date));

                if (ledgerItems.length === 0) return null;

                let balance = 0;
                return (
                  <div key={acc.id} className="space-y-4">
                    <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2">
                      <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">{acc.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.code}</p>
                    </div>
                    <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400">
                          <tr>
                            <th className="px-6 py-4">TANGGAL</th>
                            <th className="px-6 py-4">KETERANGAN</th>
                            <th className="px-6 py-4 text-right">DEBIT</th>
                            <th className="px-6 py-4 text-right">KREDIT</th>
                            <th className="px-6 py-4 text-right">SALDO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {ledgerItems.map((item, idx) => {
                            if (acc.normalBalance === 'Debit') {
                              balance += (item.debit - item.credit);
                            } else {
                              balance += (item.credit - item.debit);
                            }
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 text-[10px] font-bold text-slate-500">{item.date}</td>
                                <td className="px-6 py-3 text-[10px] font-bold text-slate-800 uppercase">{item.description}</td>
                                <td className="px-6 py-3 text-right text-[10px] font-black tabular-nums">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</td>
                                <td className="px-6 py-3 text-right text-[10px] font-black tabular-nums">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</td>
                                <td className="px-6 py-3 text-right text-[10px] font-black tabular-nums text-indigo-600">{formatCurrency(balance)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {journalEntries.length === 0 && (
                <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                  <Icons.Database className="w-12 h-12" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">BELUM ADA TRANSAKSI DI BUKU BESAR</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'PEMBELIAN' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">TRANSAKSI PEMBELIAN</h3>
                <button
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="bg-[#0f172a] text-[#FFC000] px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Icons.Plus className="w-4 h-4" /> CATAT PEMBELIAN
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm"><Icons.Download className="w-7 h-7" /></div>
                  <div><p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Total Pembelian</p><p className="text-xl font-black text-indigo-900">{formatCurrency(purchases.reduce((s, p) => s + p.totalAmount, 0))}</p></div>
                </div>
                <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm"><Icons.CheckCircle className="w-7 h-7" /></div>
                  <div><p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Lunas</p><p className="text-xl font-black text-emerald-900">{purchases.filter(p => p.status === 'Paid').length} Transaksi</p></div>
                </div>
                <div className="bg-rose-50 p-8 rounded-[40px] border border-rose-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm"><Icons.AlertCircle className="w-7 h-7" /></div>
                  <div><p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Hutang (Unpaid)</p><p className="text-xl font-black text-rose-900">{purchases.filter(p => p.status === 'Unpaid').length} Transaksi</p></div>
                </div>
              </div>

              <div className="bg-[#f8fafc] rounded-[32px] border border-slate-100 overflow-hidden shadow-inner">
                <table className="w-full text-left">
                  <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-6">TANGGAL</th>
                      <th className="px-8 py-6">SUPPLIER</th>
                      <th className="px-8 py-6">ITEM</th>
                      <th className="px-8 py-6 text-right">TOTAL</th>
                      <th className="px-8 py-6 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {purchases.map(p => (
                      <tr key={p.id} className="hover:bg-white transition-colors">
                        <td className="px-8 py-5 text-[11px] font-bold text-slate-500">{p.date}</td>
                        <td className="px-8 py-5 text-[11px] font-black text-slate-900 uppercase">{p.supplierName}</td>
                        <td className="px-8 py-5 text-[11px] font-medium text-slate-500 max-w-xs truncate">
                          {p.items.map(i => i.description).join(', ')}
                        </td>
                        <td className="px-8 py-5 text-right text-[12px] font-black tabular-nums">{formatCurrency(p.totalAmount)}</td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${p.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {purchases.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                          <Icons.Database className="w-12 h-12" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em]">BELUM ADA DATA PEMBELIAN</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'PENJUALAN' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">TRANSAKSI PENJUALAN</h3>
                <button
                  onClick={() => setIsSaleModalOpen(true)}
                  className="bg-[#0f172a] text-[#FFC000] px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Icons.Plus className="w-4 h-4" /> CATAT PENJUALAN
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm"><Icons.TrendingUp className="w-7 h-7" /></div>
                  <div><p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Penjualan</p><p className="text-xl font-black text-emerald-900">{formatCurrency(sales.reduce((s, sl) => s + sl.totalAmount, 0))}</p></div>
                </div>
                <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm"><Icons.CheckCircle className="w-7 h-7" /></div>
                  <div><p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Lunas</p><p className="text-xl font-black text-indigo-900">{sales.filter(s => s.status === 'Paid').length} Transaksi</p></div>
                </div>
                <div className="bg-amber-50 p-8 rounded-[40px] border border-amber-100 flex items-center gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm"><Icons.AlertCircle className="w-7 h-7" /></div>
                  <div><p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Piutang (Unpaid)</p><p className="text-xl font-black text-amber-900">{sales.filter(s => s.status === 'Unpaid').length} Transaksi</p></div>
                </div>
              </div>

              <div className="bg-[#f8fafc] rounded-[32px] border border-slate-100 overflow-hidden shadow-inner">
                <table className="w-full text-left">
                  <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-6">TANGGAL</th>
                      <th className="px-8 py-6">CUSTOMER</th>
                      <th className="px-8 py-6">ITEM</th>
                      <th className="px-8 py-6 text-right">TOTAL</th>
                      <th className="px-8 py-6 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {sales.map(s => (
                      <tr key={s.id} className="hover:bg-white transition-colors">
                        <td className="px-8 py-5 text-[11px] font-bold text-slate-500">{s.date}</td>
                        <td className="px-8 py-5 text-[11px] font-black text-slate-900 uppercase">{s.customerName}</td>
                        <td className="px-8 py-5 text-[11px] font-medium text-slate-500 max-w-xs truncate">
                          {s.items.map(i => i.description).join(', ')}
                        </td>
                        <td className="px-8 py-5 text-right text-[12px] font-black tabular-nums">{formatCurrency(s.totalAmount)}</td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${s.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                          <Icons.Database className="w-12 h-12" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em]">BELUM ADA DATA PENJUALAN</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'AKTIVA TETAP' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">DAFTAR AKTIVA TETAP</h3>
                <button
                  onClick={() => setIsAssetModalOpen(true)}
                  className="bg-[#0f172a] text-[#FFC000] px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Icons.Plus className="w-4 h-4" /> TAMBAH AKTIVA
                </button>
              </div>

              <div className="bg-[#f8fafc] rounded-[32px] border border-slate-100 overflow-hidden shadow-inner">
                <table className="w-full text-left">
                  <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-6">NAMA ASET</th>
                      <th className="px-8 py-6">TGL BELI</th>
                      <th className="px-8 py-6 text-right">HARGA PEROLEHAN</th>
                      <th className="px-8 py-6 text-center">MASA MANFAAT</th>
                      <th className="px-8 py-6 text-right">PENYUSUTAN/BLN</th>
                      <th className="px-8 py-6 text-right">NILAI BUKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {fixedAssets.map(asset => {
                      const monthlyDep = (asset.purchasePrice - asset.salvageValue) / (asset.usefulLifeYears * 12);
                      const purchaseDate = new Date(asset.purchaseDate);
                      const now = new Date();
                      const monthsPassed = Math.max(0, (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()));
                      const totalAccDep = Math.min(asset.purchasePrice - asset.salvageValue, monthsPassed * monthlyDep);
                      const bookValue = asset.purchasePrice - totalAccDep;

                      return (
                        <tr key={asset.id} className="hover:bg-white transition-colors">
                          <td className="px-8 py-5">
                            <p className="text-[11px] font-black text-slate-900 uppercase">{asset.name}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{asset.category}</p>
                          </td>
                          <td className="px-8 py-5 text-[10px] font-bold text-slate-500">{asset.purchaseDate}</td>
                          <td className="px-8 py-5 text-right text-[11px] font-black tabular-nums">{formatCurrency(asset.purchasePrice)}</td>
                          <td className="px-8 py-5 text-center text-[10px] font-bold text-slate-700">{asset.usefulLifeYears} TAHUN</td>
                          <td className="px-8 py-5 text-right text-[11px] font-black text-rose-500 tabular-nums">{formatCurrency(monthlyDep)}</td>
                          <td className="px-8 py-5 text-right text-[11px] font-black text-indigo-600 tabular-nums">{formatCurrency(bookValue)}</td>
                        </tr>
                      );
                    })}
                    {fixedAssets.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                          <Icons.Database className="w-12 h-12" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em]">BELUM ADA DATA AKTIVA TETAP</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'HPP' && (
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="text-center space-y-2 mb-10">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Kalkulator Harga Pokok Penjualan (HPP)</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gunakan alat ini untuk menghitung biaya pokok barang yang dijual selama periode tertentu.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6 bg-slate-50 p-10 rounded-[40px] border border-slate-100 shadow-inner">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3 mb-6">Input Data</h4>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Persediaan Awal</label>
                    <input type="number" value={hppParams.persediaanAwal || ''} onChange={e => setHppParams({...hppParams, persediaanAwal: parseInt(e.target.value) || 0})} className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl text-[12px] font-black outline-none focus:border-[#FFC000]" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Total Pembelian (Otomatis)</label>
                    <div className="w-full bg-slate-200/50 border-2 border-slate-200 p-4 rounded-2xl text-[12px] font-black text-slate-600">
                      {formatCurrency(purchases.reduce((s, p) => s + p.totalAmount, 0))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Biaya Tenaga Kerja Langsung</label>
                    <input type="number" value={hppParams.biayaTenagaKerja || ''} onChange={e => setHppParams({...hppParams, biayaTenagaKerja: parseInt(e.target.value) || 0})} className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl text-[12px] font-black outline-none focus:border-[#FFC000]" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Biaya Overhead Pabrik</label>
                    <input type="number" value={hppParams.biayaOverhead || ''} onChange={e => setHppParams({...hppParams, biayaOverhead: parseInt(e.target.value) || 0})} className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl text-[12px] font-black outline-none focus:border-[#FFC000]" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Persediaan Akhir</label>
                    <input type="number" value={hppParams.persediaanAkhir || ''} onChange={e => setHppParams({...hppParams, persediaanAkhir: parseInt(e.target.value) || 0})} className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl text-[12px] font-black outline-none focus:border-[#FFC000]" />
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl flex flex-col justify-between">
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-3 mb-6">Ringkasan Kalkulasi</h4>

                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <span>Persediaan Awal</span>
                      <span className="text-white">{formatCurrency(hppParams.persediaanAwal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <span>(+) Pembelian Bersih</span>
                      <span className="text-white">{formatCurrency(purchases.reduce((s, p) => s + p.totalAmount, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <span>(+) Tenaga Kerja & Overhead</span>
                      <span className="text-white">{formatCurrency(hppParams.biayaTenagaKerja + hppParams.biayaOverhead)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400 border-t border-white/10 pt-4">
                      <span>Tersedia untuk Dijual</span>
                      <span className="text-white font-black">{formatCurrency(hppParams.persediaanAwal + purchases.reduce((s, p) => s + p.totalAmount, 0) + hppParams.biayaTenagaKerja + hppParams.biayaOverhead)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-rose-400">
                      <span>(-) Persediaan Akhir</span>
                      <span className="font-black">({formatCurrency(hppParams.persediaanAkhir)})</span>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t-4 border-[#FFC000]">
                    <p className="text-[10px] font-black text-[#FFC000] uppercase tracking-[0.3em] mb-2">HARGA POKOK PENJUALAN (HPP)</p>
                    <p className="text-4xl font-black tabular-nums tracking-tighter">
                      {formatCurrency(
                        hppParams.persediaanAwal +
                        purchases.reduce((s, p) => s + p.totalAmount, 0) +
                        hppParams.biayaTenagaKerja +
                        hppParams.biayaOverhead -
                        hppParams.persediaanAkhir
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'LAPORAN' && (
            <div className="space-y-8">
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit mx-auto gap-1">
                {(['WORKSHEET', 'PROFIT_LOSS', 'BALANCE'] as const).map(rt => (
                  <button
                    key={rt}
                    onClick={() => setActiveReportTab(rt)}
                    className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeReportTab === rt ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {rt === 'WORKSHEET' ? 'NERACA LAJUR' : rt === 'PROFIT_LOSS' ? 'LABA RUGI' : 'NERACA'}
                  </button>
                ))}
              </div>

              {activeReportTab === 'WORKSHEET' && (
                <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                      <thead className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                        <tr>
                          <th rowSpan={2} className="px-4 py-6 border-r border-white/10">KODE</th>
                          <th rowSpan={2} className="px-4 py-6 border-r border-white/10">NAMA AKUN</th>
                          <th colSpan={2} className="px-4 py-3 text-center border-b border-white/10 border-r border-white/10">NERACA SALDO</th>
                          <th colSpan={2} className="px-4 py-3 text-center border-b border-white/10 border-r border-white/10">LABA RUGI</th>
                          <th colSpan={2} className="px-4 py-3 text-center border-b border-white/10">NERACA AKHIR</th>
                        </tr>
                        <tr>
                          <th className="px-4 py-3 text-right border-r border-white/10">DEBIT</th>
                          <th className="px-4 py-3 text-right border-r border-white/10">KREDIT</th>
                          <th className="px-4 py-3 text-right border-r border-white/10">DEBIT</th>
                          <th className="px-4 py-3 text-right border-r border-white/10">KREDIT</th>
                          <th className="px-4 py-3 text-right border-r border-white/10">DEBIT</th>
                          <th className="px-4 py-3 text-right">KREDIT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(acc => {
                          const debitTotal = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.debit, 0);
                          const creditTotal = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.credit, 0);

                          let balance = 0;
                          let debitBal = 0;
                          let creditBal = 0;

                          if (acc.normalBalance === 'Debit') {
                            balance = debitTotal - creditTotal;
                            debitBal = balance > 0 ? balance : 0;
                            creditBal = balance < 0 ? Math.abs(balance) : 0;
                          } else {
                            balance = creditTotal - debitTotal;
                            creditBal = balance > 0 ? balance : 0;
                            debitBal = balance < 0 ? Math.abs(balance) : 0;
                          }

                          const isPL = acc.category === 'Revenue' || acc.category === 'Expense';

                          return (
                            <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-4 text-[10px] font-bold text-slate-400 border-r border-slate-50">{acc.code}</td>
                              <td className="px-4 py-4 text-[10px] font-black text-slate-900 uppercase border-r border-slate-50">{acc.name}</td>
                              <td className="px-4 py-4 text-right text-[10px] font-black tabular-nums border-r border-slate-50">{debitBal > 0 ? formatCurrency(debitBal) : '-'}</td>
                              <td className="px-4 py-4 text-right text-[10px] font-black tabular-nums border-r border-slate-50">{creditBal > 0 ? formatCurrency(creditBal) : '-'}</td>
                              <td className="px-4 py-4 text-right text-[10px] font-black tabular-nums border-r border-slate-50">{isPL && debitBal > 0 ? formatCurrency(debitBal) : '-'}</td>
                              <td className="px-4 py-4 text-right text-[10px] font-black tabular-nums border-r border-slate-50">{isPL && creditBal > 0 ? formatCurrency(creditBal) : '-'}</td>
                              <td className="px-4 py-4 text-right text-[10px] font-black tabular-nums border-r border-slate-50">{!isPL && debitBal > 0 ? formatCurrency(debitBal) : '-'}</td>
                              <td className="px-4 py-4 text-right text-[10px] font-black tabular-nums">{!isPL && creditBal > 0 ? formatCurrency(creditBal) : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeReportTab === 'PROFIT_LOSS' && (
                <div className="max-w-2xl mx-auto bg-white p-12 rounded-[48px] border border-slate-100 shadow-xl">
                  <div className="text-center mb-10 border-b border-slate-100 pb-8">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">LAPORAN LABA RUGI</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{company}</p>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">PENDAPATAN</p>
                      {accounts.filter(a => a.category === 'Revenue').map(acc => {
                        const bal = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + (i.credit - i.debit), 0);
                        return (
                          <div key={acc.id} className="flex justify-between items-center text-sm font-bold text-slate-700">
                            <span>{acc.name}</span>
                            <span>{formatCurrency(bal)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-3 pt-6 border-t border-slate-50">
                      <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">BEBAN & BIAYA</p>
                      {accounts.filter(a => a.category === 'Expense').map(acc => {
                        const bal = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + (i.debit - i.credit), 0);
                        return (
                          <div key={acc.id} className="flex justify-between items-center text-sm font-bold text-slate-700">
                            <span>{acc.name}</span>
                            <span>({formatCurrency(bal)})</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-8 border-t-4 border-slate-900 flex justify-between items-center">
                      <p className="text-lg font-black text-slate-900 uppercase tracking-tighter">LABA (RUGI) BERSIH</p>
                      <p className="text-2xl font-black text-indigo-600 tabular-nums">
                        {(() => {
                          const rev = journalEntries.flatMap(e => e.items.filter(i => accounts.find(a => a.id === i.accountId)?.category === 'Revenue')).reduce((s, i) => s + (i.credit - i.debit), 0);
                          const exp = journalEntries.flatMap(e => e.items.filter(i => accounts.find(a => a.id === i.accountId)?.category === 'Expense')).reduce((s, i) => s + (i.debit - i.credit), 0);
                          return formatCurrency(rev - exp);
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {activeReportTab === 'BALANCE' && (
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-lg">
                    <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest border-b border-slate-50 pb-4 mb-6">AKTIVA (ASSETS)</h4>
                    <div className="space-y-4">
                      {accounts.filter(a => a.category === 'Asset').map(acc => {
                        const d = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.debit, 0);
                        const c = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.credit, 0);
                        const bal = acc.normalBalance === 'Debit' ? d - c : c - d;
                        if (bal === 0) return null;
                        return (
                          <div key={acc.id} className="flex justify-between items-center text-[12px] font-bold text-slate-700 uppercase">
                            <span>{acc.name}</span>
                            <span className="tabular-nums">{formatCurrency(bal)}</span>
                          </div>
                        );
                      })}
                      <div className="pt-6 border-t border-slate-900 flex justify-between items-center font-black text-slate-900 uppercase">
                        <span>TOTAL AKTIVA</span>
                        <span className="text-indigo-600 tabular-nums">
                          {(() => {
                            let total = 0;
                            accounts.filter(a => a.category === 'Asset').forEach(acc => {
                              const d = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.debit, 0);
                              const c = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.credit, 0);
                              total += (acc.normalBalance === 'Debit' ? d - c : c - d);
                            });
                            return formatCurrency(total);
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-lg">
                    <h4 className="text-[11px] font-black text-rose-600 uppercase tracking-widest border-b border-slate-50 pb-4 mb-6">PASIVA (LIABILITY & EQUITY)</h4>
                    <div className="space-y-4">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">KEWAJIBAN</p>
                      {accounts.filter(a => a.category === 'Liability').map(acc => {
                        const d = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.debit, 0);
                        const c = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.credit, 0);
                        const bal = acc.normalBalance === 'Credit' ? c - d : d - c;
                        return (
                          <div key={acc.id} className="flex justify-between items-center text-[12px] font-bold text-slate-700 uppercase">
                            <span>{acc.name}</span>
                            <span className="tabular-nums">{formatCurrency(bal)}</span>
                          </div>
                        );
                      })}
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest pt-4">EKUITAS</p>
                      {accounts.filter(a => a.category === 'Equity').map(acc => {
                        const d = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.debit, 0);
                        const c = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.credit, 0);
                        const bal = acc.normalBalance === 'Credit' ? c - d : d - c;
                        return (
                          <div key={acc.id} className="flex justify-between items-center text-[12px] font-bold text-slate-700 uppercase">
                            <span>{acc.name}</span>
                            <span className="tabular-nums">{formatCurrency(bal)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between items-center text-[12px] font-bold text-emerald-600 uppercase italic">
                        <span>Laba Berjalan (PL)</span>
                        <span className="tabular-nums">
                          {(() => {
                            const rev = journalEntries.flatMap(e => e.items.filter(i => accounts.find(a => a.id === i.accountId)?.category === 'Revenue')).reduce((s, i) => s + (i.credit - i.debit), 0);
                            const exp = journalEntries.flatMap(e => e.items.filter(i => accounts.find(a => a.id === i.accountId)?.category === 'Expense')).reduce((s, i) => s + (i.debit - i.credit), 0);
                            return formatCurrency(rev - exp);
                          })()}
                        </span>
                      </div>
                      <div className="pt-6 border-t border-slate-900 flex justify-between items-center font-black text-slate-900 uppercase">
                        <span>TOTAL PASIVA</span>
                        <span className="text-rose-600 tabular-nums">
                          {(() => {
                            let total = 0;
                            accounts.filter(a => a.category === 'Liability' || a.category === 'Equity').forEach(acc => {
                              const d = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.debit, 0);
                              const c = journalEntries.flatMap(e => e.items.filter(i => i.accountId === acc.id)).reduce((s, i) => s + i.credit, 0);
                              total += (acc.normalBalance === 'Credit' ? c - d : d - c);
                            });
                            const rev = journalEntries.flatMap(e => e.items.filter(i => accounts.find(a => a.id === i.accountId)?.category === 'Revenue')).reduce((s, i) => s + (i.credit - i.debit), 0);
                            const exp = journalEntries.flatMap(e => e.items.filter(i => accounts.find(a => a.id === i.accountId)?.category === 'Expense')).reduce((s, i) => s + (i.debit - i.credit), 0);
                            return formatCurrency(total + (rev - exp));
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Asset Modal */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
             <div className="p-8 sm:p-10 border-b bg-slate-900 text-[#FFC000] flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tight">TAMBAH AKTIVA TETAP</h2>
                <button onClick={() => setIsAssetModalOpen(false)} className="text-4xl leading-none font-black opacity-40 hover:opacity-100">&times;</button>
             </div>

             <form onSubmit={(e) => {
               e.preventDefault();
               handleAddAsset(newAsset as any);
               setIsAssetModalOpen(false);
               setNewAsset({
                  purchaseDate: new Date().toISOString().split('T')[0],
                  name: '',
                  category: 'Peralatan',
                  purchasePrice: 0,
                  salvageValue: 0,
                  usefulLifeYears: 4,
                  depreciationMethod: 'Straight Line'
               });
             }} className="p-8 sm:p-12 overflow-y-auto space-y-6 flex-grow custom-scrollbar bg-white">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Aset</label>
                   <input required type="text" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tgl Perolehan</label>
                      <input required type="date" value={newAsset.purchaseDate} onChange={e => setNewAsset({...newAsset, purchaseDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                      <input required type="text" value={newAsset.category} onChange={e => setNewAsset({...newAsset, category: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Perolehan</label>
                      <input required type="number" value={newAsset.purchasePrice || ''} onChange={e => setNewAsset({...newAsset, purchasePrice: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Masa Manfaat (Tahun)</label>
                      <input required type="number" value={newAsset.usefulLifeYears || ''} onChange={e => setNewAsset({...newAsset, usefulLifeYears: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nilai Residu (Opsional)</label>
                   <input type="number" value={newAsset.salvageValue || ''} onChange={e => setNewAsset({...newAsset, salvageValue: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                </div>

                <button type="submit" className="w-full bg-slate-900 text-[#FFC000] py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">SIMPAN ASET</button>
             </form>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
             <div className="p-8 sm:p-10 border-b bg-indigo-600 text-white flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tight">CATAT PENJUALAN BARU</h2>
                <button onClick={() => setIsSaleModalOpen(false)} className="text-4xl leading-none font-black opacity-40 hover:opacity-100">&times;</button>
             </div>

             <form onSubmit={(e) => {
               e.preventDefault();
               const total = newSale.items!.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
               handleAddSale({
                 date: newSale.date!,
                 customerName: newSale.customerName!,
                 items: newSale.items!,
                 status: newSale.status!,
                 totalAmount: total
               });
               setIsSaleModalOpen(false);
               setNewSale({
                  date: new Date().toISOString().split('T')[0],
                  customerName: '',
                  items: [{ description: '', qty: 1, unitPrice: 0, total: 0 }],
                  status: 'Paid'
               });
             }} className="p-8 sm:p-12 overflow-y-auto space-y-6 flex-grow custom-scrollbar bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input required type="date" value={newSale.date} onChange={e => setNewSale({...newSale, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-indigo-600" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer</label>
                    <input required type="text" placeholder="Nama Pelanggan" value={newSale.customerName} onChange={e => setNewSale({...newSale, customerName: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-indigo-600" />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produk / Jasa yang Dijual</label>
                  {newSale.items?.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-6">
                        <input required placeholder="Deskripsi" value={item.description} onChange={e => {
                          const updated = [...newSale.items!];
                          updated[idx].description = e.target.value.toUpperCase();
                          setNewSale({...newSale, items: updated});
                        }} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-indigo-600" />
                      </div>
                      <div className="col-span-2">
                        <input required type="number" placeholder="Qty" value={item.qty} onChange={e => {
                          const updated = [...newSale.items!];
                          updated[idx].qty = parseInt(e.target.value) || 0;
                          setNewSale({...newSale, items: updated});
                        }} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-indigo-600 text-center" />
                      </div>
                      <div className="col-span-4">
                        <input required type="number" placeholder="Harga Jual" value={item.unitPrice} onChange={e => {
                          const updated = [...newSale.items!];
                          updated[idx].unitPrice = parseInt(e.target.value) || 0;
                          setNewSale({...newSale, items: updated});
                        }} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-indigo-600 text-right" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewSale({...newSale, items: [...(newSale.items || []), { description: '', qty: 1, unitPrice: 0, total: 0 }]})} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">+ TAMBAH BARIS</button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Pembayaran</label>
                  <select value={newSale.status} onChange={e => setNewSale({...newSale, status: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-indigo-600">
                    <option value="Paid">LUNAS (CASH/BANK)</option>
                    <option value="Unpaid">BELUM BAYAR (PIUTANG)</option>
                  </select>
                </div>

                <div className="bg-slate-900 rounded-3xl p-8 flex justify-between items-center text-white">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Tagihan</p>
                  <p className="text-2xl font-black text-emerald-400 tracking-tighter tabular-nums">
                    {formatCurrency(newSale.items?.reduce((s, i) => s + (i.qty * i.unitPrice), 0) || 0)}
                  </p>
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">SIMPAN PENJUALAN</button>
             </form>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
             <div className="p-8 sm:p-10 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tight">CATAT PEMBELIAN BARU</h2>
                <button onClick={() => setIsPurchaseModalOpen(false)} className="text-4xl leading-none font-black opacity-40 hover:opacity-100">&times;</button>
             </div>

             <form onSubmit={(e) => {
               e.preventDefault();
               const total = newPurchase.items!.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
               handleAddPurchase({
                 date: newPurchase.date!,
                 supplierName: newPurchase.supplierName!,
                 items: newPurchase.items!,
                 status: newPurchase.status!,
                 totalAmount: total
               });
               setIsPurchaseModalOpen(false);
               setNewPurchase({
                  date: new Date().toISOString().split('T')[0],
                  supplierName: '',
                  items: [{ description: '', qty: 1, unitPrice: 0, total: 0 }],
                  status: 'Paid'
               });
             }} className="p-8 sm:p-12 overflow-y-auto space-y-6 flex-grow custom-scrollbar bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input required type="date" value={newPurchase.date} onChange={e => setNewPurchase({...newPurchase, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier</label>
                    <input required type="text" placeholder="Nama Toko / PT" value={newPurchase.supplierName} onChange={e => setNewPurchase({...newPurchase, supplierName: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Barang / Jasa</label>
                  {newPurchase.items?.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-6">
                        <input required placeholder="Deskripsi" value={item.description} onChange={e => {
                          const updated = [...newPurchase.items!];
                          updated[idx].description = e.target.value.toUpperCase();
                          setNewPurchase({...newPurchase, items: updated});
                        }} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]" />
                      </div>
                      <div className="col-span-2">
                        <input required type="number" placeholder="Qty" value={item.qty} onChange={e => {
                          const updated = [...newPurchase.items!];
                          updated[idx].qty = parseInt(e.target.value) || 0;
                          setNewPurchase({...newPurchase, items: updated});
                        }} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000] text-center" />
                      </div>
                      <div className="col-span-4">
                        <input required type="number" placeholder="Harga Satuan" value={item.unitPrice} onChange={e => {
                          const updated = [...newPurchase.items!];
                          updated[idx].unitPrice = parseInt(e.target.value) || 0;
                          setNewPurchase({...newPurchase, items: updated});
                        }} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000] text-right" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewPurchase({...newPurchase, items: [...(newPurchase.items || []), { description: '', qty: 1, unitPrice: 0, total: 0 }]})} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">+ TAMBAH ITEM</button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Pembayaran</label>
                  <select value={newPurchase.status} onChange={e => setNewPurchase({...newPurchase, status: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]">
                    <option value="Paid">LUNAS (CASH/BANK)</option>
                    <option value="Unpaid">BELUM BAYAR (HUTANG)</option>
                  </select>
                </div>

                <div className="bg-slate-900 rounded-3xl p-8 flex justify-between items-center text-white">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Bayar</p>
                  <p className="text-2xl font-black text-[#FFC000] tracking-tighter tabular-nums">
                    {formatCurrency(newPurchase.items?.reduce((s, i) => s + (i.qty * i.unitPrice), 0) || 0)}
                  </p>
                </div>

                <button type="submit" className="w-full bg-slate-900 text-[#FFC000] py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">SIMPAN PEMBELIAN</button>
             </form>
          </div>
        </div>
      )}

      {/* Journal Modal */}
      {isJournalModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
             <div className="p-8 sm:p-10 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tight">TAMBAH JURNAL UMUM</h2>
                <button onClick={() => setIsJournalModalOpen(false)} className="text-4xl leading-none font-black opacity-40 hover:opacity-100">&times;</button>
             </div>

             <form onSubmit={handleAddJournal} className="p-8 sm:p-12 overflow-y-auto space-y-8 flex-grow custom-scrollbar bg-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input required type="date" value={newEntry.date} onChange={e => setNewEntry({...newEntry, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                    <input required type="text" placeholder="Contoh: Setoran Modal Awal" value={newEntry.description} onChange={e => setNewEntry({...newEntry, description: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000]" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Jurnal</label>
                    <button
                      type="button"
                      onClick={() => setNewEntry({...newEntry, items: [...(newEntry.items || []), { id: Date.now().toString(), accountId: '', accountName: '', debit: 0, credit: 0 }]})}
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                    >
                      + TAMBAH BARIS
                    </button>
                  </div>

                  {newEntry.items?.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-6">
                        <select
                          required
                          value={item.accountId}
                          onChange={e => {
                            const updatedItems = [...newEntry.items!];
                            updatedItems[idx].accountId = e.target.value;
                            setNewEntry({...newEntry, items: updatedItems});
                          }}
                          className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000]"
                        >
                          <option value="">PILIH AKUN</option>
                          {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="Debit"
                          value={item.debit || ''}
                          onChange={e => {
                            const updatedItems = [...newEntry.items!];
                            updatedItems[idx].debit = parseInt(e.target.value) || 0;
                            if (updatedItems[idx].debit > 0) updatedItems[idx].credit = 0;
                            setNewEntry({...newEntry, items: updatedItems});
                          }}
                          className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000] text-right"
                        />
                      </div>
                      <div className="col-span-3 flex gap-2 items-center">
                        <input
                          type="number"
                          placeholder="Kredit"
                          value={item.credit || ''}
                          onChange={e => {
                            const updatedItems = [...newEntry.items!];
                            updatedItems[idx].credit = parseInt(e.target.value) || 0;
                            if (updatedItems[idx].credit > 0) updatedItems[idx].debit = 0;
                            setNewEntry({...newEntry, items: updatedItems});
                          }}
                          className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-[11px] font-black outline-none focus:border-[#FFC000] text-right"
                        />
                        {newEntry.items!.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setNewEntry({...newEntry, items: newEntry.items!.filter(i => i.id !== item.id)})}
                            className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                          >
                            <Icons.Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 rounded-3xl p-8 flex justify-between items-center text-white">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Debit / Kredit</p>
                    <p className="text-xl font-black text-[#FFC000] tracking-tighter tabular-nums">
                      {formatCurrency(newEntry.items?.reduce((s, i) => s + i.debit, 0) || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Balance</p>
                    {(() => {
                      const d = newEntry.items?.reduce((s, i) => s + i.debit, 0) || 0;
                      const c = newEntry.items?.reduce((s, i) => s + i.credit, 0) || 0;
                      return d === c && d > 0 ? (
                        <span className="text-emerald-400 font-black text-[10px] uppercase tracking-widest">SEIMBANG (BALANCED)</span>
                      ) : (
                        <span className="text-rose-400 font-black text-[10px] uppercase tracking-widest">TIDAK SEIMBANG</span>
                      );
                    })()}
                  </div>
                </div>

                <button type="submit" className="w-full bg-slate-900 text-[#FFC000] py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">SIMPAN JURNAL</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingModule;
