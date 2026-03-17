import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Icons } from '../constants';
import { flipService } from '../services/flipService';
import { supabase } from '../services/supabaseClient';
import { InvoiceModule } from './InvoiceModule';
import { getSalaryDetails } from '../utils/salaryCalculations';
import SalarySlipModal from './SalarySlipModal';
import SalarySlipContent from './SalarySlipContent';
import { parseFlexibleDate, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { jsPDF } from 'jspdf';
import { domToJpeg } from 'modern-screenshot';

interface FinancialModuleProps {
  company: string;
  employees: any[];
  attendanceRecords: any[];
  onClose: () => void;
  onRefresh?: () => void;
  weeklyHolidays?: Record<string, string[]>;
  positionRates?: any[];
}

const FinancialModule: React.FC<FinancialModuleProps> = ({ 
  company, 
  employees, 
  attendanceRecords, 
  onClose, 
  onRefresh,
  weeklyHolidays,
  positionRates = []
}) => {
  useEffect(() => {
    console.log("DEBUG: FinancialModule V2.2 (modern-screenshot) Loaded");
  }, []);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PAYROLL' | 'INVOICE' | 'QUOTATION'>('OVERVIEW');
  const [isProcessingPayroll, setIsProcessingPayroll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payrollEmployees, setPayrollEmployees] = useState<any[]>([]);
  const [localAttendance, setLocalAttendance] = useState<any[]>([]);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('id-ID', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showSlipModal, setShowSlipModal] = useState<{ employee: any } | null>(null);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [processingEmployeeData, setProcessingEmployeeData] = useState<any>(null);
  const hiddenSlipRef = useRef<HTMLDivElement>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', `attendance_settings_${company}`).maybeSingle();
      if (data && data.value) setSettings(data.value);
    };
    const fetchCompany = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', `company_details_${company}`).maybeSingle();
      if (data && data.value) setCompanyDetails(data.value);
    };
    fetchSettings();
    fetchCompany();
  }, [company]);

  useEffect(() => {
    const fetchLocalAttendance = async () => {
      const monthIdx = monthOptions.indexOf(selectedMonth);
      if (monthIdx === -1) return;

      const yearNum = parseInt(selectedYear);
      // Fetch a wide range to be safe (e.g. from 20th of prev month to 10th of next month)
      // Actually, just fetch the whole previous month and current month to be safe.
      const startDate = new Date(yearNum, monthIdx - 1, 1);
      const endDate = new Date(yearNum, monthIdx + 1, 0);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('company', company)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);
      
      if (!error && data) {
        setLocalAttendance(data);
      }
    };

    fetchLocalAttendance();
  }, [selectedMonth, selectedYear, company]);

  const monthOptions = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const yearOptions = ['2024', '2025', '2026'];

  const calculateTotalSalary = useCallback((config: any, hutang: number = 0, empId?: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 0;
    const details = getSalaryDetails(emp, config, localAttendance, selectedMonth, selectedYear, settings, weeklyHolidays, positionRates);
    return details.takeHomePay;
  }, [getSalaryDetails, localAttendance, selectedMonth, selectedYear, settings, employees, weeklyHolidays, positionRates]);

  useEffect(() => {
    if (isProcessingPayroll && employees.length > 0 && payrollEmployees.length > 0) {
      const updatedPayroll = payrollEmployees.map(pEmp => {
        const latest = employees.find(e => e.id === pEmp.id);
        if (latest) {
          // Sync all fields from latest employee data, but preserve status from draft
          const config = latest.salaryConfig || {};
          return {
            ...latest,
            status: pEmp.status || 'READY',
            calculatedTotal: calculateTotalSalary(config, latest.hutang, latest.id)
          };
        }
        return pEmp;
      });
      
      // Only update if there are actual changes to avoid infinite loops
      const hasChanges = JSON.stringify(updatedPayroll) !== JSON.stringify(payrollEmployees);
      if (hasChanges) {
        setPayrollEmployees(updatedPayroll);
        savePayrollDraft(updatedPayroll);
      }
    }
  }, [employees, isProcessingPayroll, payrollEmployees, selectedMonth, selectedYear, settings, localAttendance, calculateTotalSalary]);

  useEffect(() => {
    loadFinanceData();
    if (activeTab === 'PAYROLL') {
      fetchPayrollDraft();
    }
  }, [activeTab]);

  const fetchPayrollDraft = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `payroll_draft_${company}`)
        .single();
      
      if (data && data.value) {
        setPayrollEmployees(data.value.employees || []);
        setIsProcessingPayroll(true);
      }
    } catch (e) {
      // No draft found
    }
  };

  const savePayrollDraft = async (employees: any[]) => {
    try {
      await supabase.from('settings').upsert({
        key: `payroll_draft_${company}`,
        value: { employees, updatedAt: new Date().toISOString() }
      });
    } catch (e) {
      console.error("Failed to save draft:", e);
    }
  };

  const clearPayrollDraft = async () => {
    try {
      await supabase.from('settings').delete().eq('key', `payroll_draft_${company}`);
      setPayrollEmployees([]);
      setIsProcessingPayroll(false);
    } catch (e) {
      console.error("Failed to clear draft:", e);
    }
  };

  const loadFinanceData = async () => {
    setIsLoading(true);
    try {
      const bal = await flipService.getBalance();
      setBalance(bal);
      
      const { data } = await supabase
        .from('flip_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      setTransactions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const startPayrollProcess = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company', company)
        .is('deleted_at', null)
        .is('resigned_at', null);
      
      if (error) throw error;

      // Filter employees who have bank info and salary config
      const validEmployees = (data || []).map(emp => {
        const config = emp.salaryConfig || {};
        const totalSalary = calculateTotalSalary(config, emp.hutang, emp.id);
        
        return {
          ...emp,
          calculatedTotal: totalSalary,
          status: 'READY' // READY, PENDING, SUCCESS, FAILED
        };
      }).filter(emp => emp.calculatedTotal > 0 && emp.bank && emp.noRekening);

      setPayrollEmployees(validEmployees);
      setIsProcessingPayroll(true);
      setCurrentPage(1);
      await savePayrollDraft(validEmployees);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert("Gagal memuat data karyawan: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDisburse = async () => {
    const targetEmployees = payrollEmployees.filter(emp => selectedIds.includes(emp.id));
    
    if (targetEmployees.length === 0) {
      alert("Silakan pilih minimal satu karyawan untuk diproses pembayarannya.");
      return;
    }

    const totalNeeded = targetEmployees.reduce((acc, curr) => acc + curr.calculatedTotal, 0);
    if (balance < totalNeeded) {
      alert(`Saldo Flip tidak mencukupi. Dibutuhkan ${formatCurrency(totalNeeded)}, saldo saat ini ${formatCurrency(balance)}.`);
      return;
    }

    if (!confirm(`Konfirmasi pembayaran gaji untuk ${targetEmployees.length} karyawan terpilih dengan total ${formatCurrency(totalNeeded)}?`)) return;

    setIsDisbursing(true);
    const updatedEmployees = [...payrollEmployees];

    for (let i = 0; i < updatedEmployees.length; i++) {
      const emp = updatedEmployees[i];
      if (!selectedIds.includes(emp.id)) continue;

      try {
        updatedEmployees[i].status = 'SENDING';
        setPayrollEmployees([...updatedEmployees]);

        const result = await flipService.disburse({
          amount: emp.calculatedTotal,
          bank_code: emp.bank.toLowerCase(),
          account_number: emp.noRekening,
          remark: `Payroll ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })} - ${company}`
        });

        if (result && (result.status === 'SUCCESS' || result.status === 'PENDING')) {
          updatedEmployees[i].status = 'SUCCESS';
        } else {
          updatedEmployees[i].status = 'FAILED';
        }
        await savePayrollDraft(updatedEmployees);
      } catch (e) {
        console.error(e);
        updatedEmployees[i].status = 'FAILED';
        await savePayrollDraft(updatedEmployees);
      }
      setPayrollEmployees([...updatedEmployees]);
    }

    setIsDisbursing(false);
    alert("Proses payroll selesai!");
    await clearPayrollDraft();
    loadFinanceData();
    setSelectedIds([]);
  };

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return payrollEmployees;
    const q = searchQuery.toLowerCase();
    return payrollEmployees.filter(emp => 
      emp.nama.toLowerCase().includes(q) || 
      emp.jabatan.toLowerCase().includes(q) ||
      emp.idKaryawan?.toLowerCase().includes(q)
    );
  }, [payrollEmployees, searchQuery]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const handleSendAllEmails = async () => {
    console.log("DEBUG: Starting handleSendAllEmails");
    console.log("DEBUG: Company prop:", company);
    console.log("DEBUG: Selected Month/Year:", selectedMonth, selectedYear);
    console.log("DEBUG: Total payrollEmployees available:", payrollEmployees.length);
    console.log("DEBUG: Selected IDs:", selectedIds);
    const targetEmployees = payrollEmployees.filter(emp => selectedIds.includes(emp.id));
    console.log("DEBUG: Target employees count:", targetEmployees.length);
    console.log("DEBUG: Supabase client exists:", !!supabase);
    
    if (targetEmployees.length === 0) {
      alert("Silakan pilih minimal satu karyawan untuk dikirim slip gajinya.");
      return;
    }

    console.log("DEBUG: Proceeding without confirm (to avoid iframe issues)");
    setIsSendingEmails(true);
    
    let successCount = 0;
    let errorCount = 0;

    const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
    const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";
    const slipLogo = companyDetails?.logo || ((company || '').toLowerCase() === 'seller space' ? SELLER_SPACE_LOGO : VISIBEL_LOGO);

    try {
      for (const emp of targetEmployees) {
        console.log(`DEBUG: Processing employee: ${emp.nama} (${emp.id})`);
        try {
          const config = emp.salaryConfig || {};
          const details = getSalaryDetails(emp, config, localAttendance, selectedMonth, selectedYear, settings, weeklyHolidays, positionRates);

          const slipData = {
            employee: emp,
            data: { 
              month: selectedMonth, 
              year: selectedYear, 
              gapok: details.gapok, 
              lembur: details.lembur, 
              bonus: details.bonus, 
              thr: details.thr, 
              workingDays: details.workingDays, 
              bpjstk: details.bpjstk, 
              pph21: details.pph21, 
              potonganHutang: details.potonganHutang, 
              potonganLain: details.potonganLain 
            },
            totalTunjanganOps: details.tunjanganOps,
            totalPendapatan: details.totalPendapatan,
            totalPotongan: details.totalPotongan,
            takeHomePay: details.takeHomePay,
            sisaHutang: Math.max(0, (emp.hutang || 0) - details.potonganHutang),
            attendanceResults: details.summary,
            cutoffStart: details.cutoffStart,
            cutoffEnd: details.cutoffEnd,
            slipLogo,
            isBPJSTKActive: details.bpjstk > 0,
            potonganAbsensi: details.potonganAbsensi
          };

          // Set data for hidden rendering
          setProcessingEmployeeData(slipData);
          
          // Wait for render and assets to load - reduced from 2000ms to 800ms for better performance
          await new Promise(resolve => setTimeout(resolve, 800)); 

          // Capture image and PDF
          let jpegBase64 = '';
          let pdfBase64 = '';
          let captureSuccess = false;
          try {
            const target = hiddenSlipRef.current;
            if (target) {
              console.log(`DEBUG: Capturing slip for ${emp.nama} with modern-screenshot...`);
              
              const dataUrl = await domToJpeg(target, {
                quality: 0.8,
                scale: 2,
                width: 794,
                height: 1122,
                backgroundColor: '#ffffff',
                features: {
                  // Disable some features if they cause issues, but usually default is fine
                }
              });
              
              jpegBase64 = dataUrl;
              
              // Generate PDF
              const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [794, 1122]
              });
              
              pdf.addImage(jpegBase64, 'JPEG', 0, 0, 794, 1122);
              const pdfOutput = pdf.output('datauristring');
              pdfBase64 = pdfOutput.includes(',') ? pdfOutput.split(',')[1] : pdfOutput;
              
              captureSuccess = true;
              console.log("DEBUG: modern-screenshot captured and PDF generated for", emp.nama);
            } else {
              console.warn("DEBUG: hiddenSlipRef.current is null!");
              (window as any).lastEmailError = "Internal Error: Slip container not found.";
            }
          } catch (captureError: any) {
            console.error("DEBUG: Capture failed:", captureError);
            const errorMsg = captureError.message || captureError.toString();
            (window as any).lastEmailError = `Capture Error (${emp.nama}): ${errorMsg}`;
          }

          if (!captureSuccess) {
            console.error(`DEBUG: Skipping email for ${emp.nama} due to capture failure`);
            if (!(window as any).lastEmailError) (window as any).lastEmailError = "Gagal membuat file PDF slip gaji (Canvas Error).";
            errorCount++;
            continue;
          }

          // 1. Send to Inbox (Broadcasts)
          console.log("DEBUG: Inserting into broadcasts...");
          const newBroadcast = {
            title: `SLIP GAJI ${selectedMonth.toUpperCase()} ${selectedYear}`,
            message: `Halo ${emp.nama}, slip gaji Anda untuk periode ${selectedMonth} ${selectedYear} telah tersedia. Silakan download gambar di bawah sebagai arsip.`,
            company: company,
            targetEmployeeIds: [emp.id],
            sentAt: new Date().toISOString(),
            imageBase64: jpegBase64
          };
          const { error: bcError } = await supabase.from('broadcasts').insert([newBroadcast]);
          if (bcError) {
            console.error("DEBUG: Broadcast insert error:", bcError);
            throw bcError;
          }

          // 2. Send to Email (via Resend API)
          if (emp.email && emp.email.includes('@')) {
            console.log(`DEBUG: Sending email to ${emp.email}...`);
            
            const emailHtml = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; line-height: 1.6;">
                <p style="margin-bottom: 20px;">Halo ${emp.nama}</p>
                <p style="margin-bottom: 20px;">Berikut kita lampirkan gaji bulan ${selectedMonth} ${selectedYear} dengan nominal take home pay senilai <strong>Rp ${details.takeHomePay.toLocaleString('id-ID')}</strong></p>
                
                <p style="margin-bottom: 20px;">Terimakasih atas kerjasamanya dalam membantu Visibel. Kita berharap kerjasama kita selalu berjalan terus.</p>
                
                <p style="margin-top: 40px; font-weight: bold;">HR Visibel</p>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
                  <p style="font-size: 11px; color: #94a3b8; margin: 0;">Email ini dikirim secara otomatis oleh sistem Finance ${company}.</p>
                </div>
              </div>
            `;

            const emailRes = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: emp.email,
                subject: `SLIP GAJI ${selectedMonth.toUpperCase()} ${selectedYear} - ${emp.nama}`,
                html: emailHtml,
                from: "admin@visibel.agency",
                replyTo: companyDetails?.email || "admin@visibel.agency",
                attachments: [
                  {
                    filename: `slip-gaji-${emp.nama.toLowerCase().replace(/\s+/g, '-')}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                  }
                ]
              })
            });

            if (emailRes.ok) {
              console.log(`DEBUG: Email sent successfully to ${emp.email}`);
              successCount++;
            } else {
              let errorMsg = "Gagal mengirim email";
              try {
                const contentType = emailRes.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  const err = await emailRes.json();
                  errorMsg = err.error || err.message || JSON.stringify(err);
                } else {
                  const text = await emailRes.text();
                  errorMsg = text.substring(0, 100);
                }
              } catch (e) {
                errorMsg = `HTTP Error ${emailRes.status}`;
              }
              console.error(`DEBUG: Email API error for ${emp.email}:`, errorMsg);
              // Store the first error to show in the final alert
              if (!(window as any).lastEmailError) (window as any).lastEmailError = errorMsg;
              errorCount++;
            }
          } else {
            console.warn(`DEBUG: Employee ${emp.nama} has no valid email: ${emp.email}`);
            errorCount++;
          }
        } catch (innerError: any) {
          console.error(`DEBUG: Error processing employee ${emp.nama}:`, innerError);
          alert(`Error processing ${emp.nama}: ${innerError.message || JSON.stringify(innerError)}`);
          errorCount++;
        }
      }
      
      let finalMsg = `Proses selesai. Berhasil: ${successCount}, Gagal/Lewati: ${errorCount}. Slip juga telah dikirim ke Inbox aplikasi.`;
      if (errorCount > 0 && (window as any).lastEmailError) {
        finalMsg += `\n\nError Terakhir: ${(window as any).lastEmailError}`;
        delete (window as any).lastEmailError;
      }
      alert(finalMsg);
      setSelectedIds([]); 
    } catch (e: any) {
      console.error("DEBUG: Global error in handleSendAllEmails:", e);
      alert("Gagal memproses pengiriman slip: " + e.message);
    } finally {
      setIsSendingEmails(false);
      setProcessingEmployeeData(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === payrollEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(payrollEmployees.map(emp => emp.id));
    }
  };

  const toggleSelectEmployee = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Container dashed untuk layout visual sesuai screenshot */}
      <div className="border-2 border-dashed border-rose-100 rounded-[48px] p-2 sm:p-4">
        <div className="bg-white rounded-[40px] sm:rounded-[48px] p-8 sm:p-12 shadow-sm border border-slate-50 relative overflow-hidden">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-16">
            <div className="flex items-center gap-6">
              <div className="bg-[#0f172a] p-5 rounded-3xl text-[#FFC000] shadow-xl">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              </div>
              <div>
                <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tight leading-none">FINANCE HUB</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3">Flip for Business Integrated</p>
              </div>
            </div>
            
            {/* Saldo Flip Card - Sesuai Screenshot di pojok kanan */}
            <div className="bg-[#0f172a] p-6 pr-20 rounded-[32px] text-white shadow-2xl relative group overflow-hidden min-w-[280px]">
               <div className="relative z-10">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">SALDO FLIP (READY)</p>
                  <p className="text-3xl font-black text-[#FFC000] tracking-tighter tabular-nums">Rp {balance.toLocaleString('id-ID')}</p>
               </div>
               <button 
                  onClick={loadFinanceData} 
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-90"
                  title="Refresh Saldo"
               >
                  <svg className={`w-5 h-5 text-white ${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
               </button>
               <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12 pointer-events-none">
                  <Icons.Sparkles className="w-24 h-24" />
               </div>
            </div>
          </div>

          <div className="flex bg-[#f1f5f9] p-1.5 rounded-2xl border border-slate-100 shadow-inner w-fit mb-12">
            {['OVERVIEW', 'PAYROLL', 'INVOICE', 'QUOTATION'].map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === 'OVERVIEW' && (
            <div className="space-y-12">
               {/* Transaksi Terakhir Section */}
               <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest ml-2">TRANSAKSI TERAKHIR</h3>
                  <div className="bg-[#f8fafc] rounded-[40px] border border-slate-100 overflow-hidden shadow-inner">
                     <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                           <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                              <tr>
                                 <th className="px-10 py-6">PENERIMA</th>
                                 <th className="px-6 py-6">NOMINAL</th>
                                 <th className="px-6 py-6">STATUS</th>
                                 <th className="px-10 py-6 text-right">TANGGAL</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100/50">
                              {transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-white transition-colors group">
                                   <td className="px-10 py-5">
                                      <p className="text-[11px] font-black text-slate-900 uppercase">{tx.recipient_name}</p>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{tx.recipient_bank} • {tx.recipient_account}</p>
                                   </td>
                                   <td className="px-6 py-5">
                                      <p className="text-[12px] font-black text-slate-800">{formatCurrency(tx.amount)}</p>
                                   </td>
                                   <td className="px-6 py-5">
                                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${
                                        tx.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        tx.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                        'bg-rose-50 text-rose-600 border-rose-100'
                                      }`}>
                                         {tx.status}
                                      </span>
                                   </td>
                                   <td className="px-10 py-5 text-right">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                                   </td>
                                </tr>
                              ))}
                              {transactions.length === 0 && (
                                <tr>
                                   <td colSpan={4} className="py-24 text-center">
                                      <div className="flex flex-col items-center gap-4 opacity-10">
                                         <Icons.Database className="w-14 h-14" />
                                         <p className="text-[11px] font-black uppercase tracking-[0.4em]">BELUM ADA TRANSAKSI</p>
                                      </div>
                                   </td>
                                </tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>

               {/* Menu Cepat Section - Sesuai Screenshot */}
               <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest ml-2">MENU CEPAT</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <button className="bg-white p-8 rounded-[36px] border border-slate-100 shadow-sm flex items-center gap-6 hover:border-[#FFC000] hover:shadow-xl transition-all group text-left">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                           <Icons.Plus className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">TOP UP SALDO</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">TAMBAH DANA KE FLIP</p>
                        </div>
                     </button>
                     <button className="bg-white p-8 rounded-[36px] border border-slate-100 shadow-sm flex items-center gap-6 hover:border-emerald-400 hover:shadow-xl transition-all group text-left">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                           <Icons.Download className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">TERIMA PEMBAYARAN</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">BUAT VA / QRIS BARU</p>
                        </div>
                     </button>
                  </div>
               </div>

               {/* Info Section */}
               <div className="bg-[#FFFBEB] p-10 rounded-[48px] border border-amber-100/50 flex flex-col sm:flex-row items-center gap-8">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                     <Icons.Info className="w-7 h-7" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-2">Informasi Operasional & Biaya</p>
                     <p className="text-xs text-amber-900/60 font-medium leading-relaxed uppercase tracking-tighter">
                        Biaya admin Flip for Business lebih murah Rp 2.500 - 3.500 per transaksi dibandingkan RTGS bank konvensional. 
                        Pastikan saldo deposit mencukupi sebelum menjalankan payroll massal ke rekening karyawan.
                     </p>
                  </div>
               </div>
            </div>
          )}
          
          {activeTab === 'PAYROLL' && (
            <div className="animate-in fade-in duration-500">
               {!isProcessingPayroll ? (
                 <div className="py-32 text-center">
                    <div className="max-w-md mx-auto space-y-8">
                       <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500 shadow-inner">
                          <Icons.Users className="w-10 h-10" />
                       </div>
                       <div className="space-y-2">
                         <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Otomasi Gaji (Bulk Disbursement)</h3>
                         <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                           Fitur ini memungkinkan Anda mengirim gaji ke seluruh karyawan sekaligus. Data bank diambil otomatis dari Database Karyawan.
                         </p>
                       </div>
                       <button 
                        onClick={startPayrollProcess}
                        disabled={isLoading}
                        className="bg-slate-900 text-[#FFC000] px-12 py-5 rounded-[22px] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all border border-white/10 disabled:opacity-50"
                       >
                         {isLoading ? 'MEMUAT...' : 'MULAI PROSES PAYROLL'}
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                       <div className="space-y-2">
                          <h3 className="text-2xl font-black text-[#0f172a] uppercase tracking-tight">Review Payroll</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Silakan periksa kembali daftar penerima dan nominal sebelum eksekusi.</p>
                          
                          <div className="flex gap-2 mt-4">
                             <select 
                               value={selectedMonth} 
                               onChange={(e) => setSelectedMonth(e.target.value)}
                               className="bg-slate-100/50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-[#FFC000]"
                             >
                               {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                             </select>
                             <select 
                               value={selectedYear} 
                               onChange={(e) => setSelectedYear(e.target.value)}
                               className="bg-slate-100/50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-[#FFC000]"
                             >
                               {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                             </select>
                             <div className="relative">
                                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                <input 
                                  type="text"
                                  placeholder="CARI KARYAWAN..."
                                  value={searchQuery}
                                  onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                  }}
                                  className="bg-slate-100/50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-[#FFC000] w-48"
                                />
                             </div>
                          </div>
                       </div>
                       <div className="flex flex-wrap gap-3">
                          <button 
                            onClick={handleSendAllEmails}
                            disabled={isSendingEmails || payrollEmployees.length === 0}
                            className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            <Icons.Mail className="w-4 h-4" />
                            {isSendingEmails ? 'MENGIRIM...' : selectedIds.length > 0 ? `KIRIM (${selectedIds.length}) SLIP` : 'KIRIM SLIP'}
                          </button>
                          <button 
                            onClick={clearPayrollDraft}
                            className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                          >
                            BATAL
                          </button>
                          <button 
                            onClick={handleBulkDisburse}
                            disabled={isDisbursing || payrollEmployees.length === 0}
                            className="px-10 py-4 bg-[#0f172a] text-[#FFC000] rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                          >
                            {isDisbursing ? 'MEMPROSES...' : selectedIds.length > 0 ? `BAYAR ${selectedIds.length} KARYAWAN` : `BAYAR ${payrollEmployees.length} KARYAWAN`}
                          </button>
                       </div>
                    </div>

                    <div className="bg-[#f8fafc] rounded-[40px] border border-slate-100 overflow-hidden shadow-inner">
                       <table className="w-full text-left">
                          <thead className="bg-[#f1f5f9]/50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                             <tr>
                                 <th className="px-6 py-6 text-center">
                                    <input 
                                      type="checkbox" 
                                      checked={selectedIds.length === payrollEmployees.length && payrollEmployees.length > 0}
                                      onChange={toggleSelectAll}
                                      className="w-4 h-4 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                 </th>
                                 <th className="px-6 py-6">KARYAWAN</th>
                                <th className="px-6 py-6">REKENING</th>
                                <th className="px-6 py-6">NOMINAL (THP)</th>
                                <th className="px-6 py-6 text-center">SLIP</th>
                                <th className="px-10 py-6 text-right">STATUS</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/50 bg-white">
                             {paginatedEmployees.map((emp, idx) => (
                               <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(emp.id) ? 'bg-indigo-50/30' : ''}`}>
                                   <td className="px-6 py-5 text-center">
                                      <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(emp.id)}
                                        onChange={() => toggleSelectEmployee(emp.id)}
                                        className="w-4 h-4 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                   </td>
                                  <td className="px-10 py-5">
                                     <p className="text-[11px] font-black text-slate-900 uppercase">{emp.nama}</p>
                                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{emp.jabatan}</p>
                                  </td>
                                  <td className="px-6 py-5">
                                     <p className="text-[11px] font-black text-slate-700 uppercase">{emp.bank}</p>
                                     <p className="text-[10px] text-slate-500 font-mono tracking-tighter">{emp.noRekening}</p>
                                  </td>
                                  <td className="px-6 py-5">
                                     <p className="text-[12px] font-black text-slate-900">{formatCurrency(emp.calculatedTotal)}</p>
                                  </td>
                                  <td className="px-6 py-5 text-center">
                                     <button 
                                       onClick={() => {
                                         setShowSlipModal({ employee: emp });
                                       }}
                                       className="p-2 bg-slate-100 hover:bg-[#FFC000] hover:text-black rounded-lg transition-all text-slate-400"
                                     >
                                       <Icons.FileText className="w-4 h-4" />
                                     </button>
                                  </td>
                                  <td className="px-10 py-5 text-right">
                                     <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${
                                       emp.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                       emp.status === 'SENDING' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 animate-pulse' : 
                                       emp.status === 'FAILED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                       'bg-slate-50 text-slate-400 border-slate-100'
                                     }`}>
                                        {emp.status}
                                     </span>
                                  </td>
                               </tr>
                             ))}
                             {payrollEmployees.length === 0 && (
                               <tr>
                                  <td colSpan={6} className="py-24 text-center">
                                     <div className="flex flex-col items-center gap-4 opacity-10">
                                        <Icons.Users className="w-14 h-14" />
                                        <p className="text-[11px] font-black uppercase tracking-[0.4em]">TIDAK ADA DATA KARYAWAN VALID</p>
                                     </div>
                                  </td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-10 py-6 bg-white border-t border-slate-100 rounded-b-[40px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Halaman {currentPage} dari {totalPages} ({filteredEmployees.length} Karyawan)
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-all"
                          >
                            <Icons.ArrowLeft className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-all rotate-180"
                          >
                            <Icons.ArrowLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'INVOICE' && (
            <div className="animate-in fade-in duration-500">
               <InvoiceModule company={company} onClose={onClose} forceTab="invoice" />
            </div>
          )}

          {activeTab === 'QUOTATION' && (
            <div className="animate-in fade-in duration-500">
               <InvoiceModule company={company} onClose={onClose} forceTab="quotation" />
            </div>
          )}
        </div>
      </div>
      {showSlipModal && (
        <SalarySlipModal 
          employee={showSlipModal.employee}
          attendanceRecords={localAttendance}
          userRole="owner"
          onClose={() => setShowSlipModal(null)}
          onUpdate={() => {
            if (onRefresh) onRefresh();
            startPayrollProcess();
          }}
          positionRates={positionRates}
          initialMonth={selectedMonth}
          initialYear={selectedYear}
          weeklyHolidays={weeklyHolidays}
        />
      )}

      {/* Hidden slip for bulk processing */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: '-9999px', 
        width: '794px', 
        height: '1122px', 
        pointerEvents: 'none', 
        zIndex: -1000,
        background: 'white',
        overflow: 'hidden'
      }}>
        <div ref={hiddenSlipRef} style={{ width: '794px', height: '1122px' }}>
          {processingEmployeeData && (
            <SalarySlipContent {...processingEmployeeData} />
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialModule;