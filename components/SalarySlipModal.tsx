
import React, { useState, useRef } from 'react';
import { Employee, SalaryData } from '../types';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

interface SalarySlipModalProps {
  employee: Employee;
  onClose: () => void;
}

const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ employee, onClose }) => {
  const [data, setData] = useState<SalaryData>({
    month: new Date().toLocaleString('id-ID', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    gapok: 5000000,
    tunjanganMakan: 500000,
    tunjanganTransport: 300000,
    tunjanganKomunikasi: 200000,
    bpjstk: 150000,
    lembur: 0,
    bonus: 0,
  });

  const [isPreview, setIsPreview] = useState(false);
  const slipRef = useRef<HTMLDivElement>(null);

  const totalPendapatan = data.gapok + data.tunjanganMakan + data.tunjanganTransport + data.tunjanganKomunikasi + data.lembur + data.bonus;
  const totalPotongan = data.bpjstk;
  const takeHomePay = totalPendapatan - totalPotongan;

  // Function to format numbers as Indonesian currency style xx.xxx.xxx
  const formatCurrencyInput = (value: number) => {
    return value.toLocaleString('id-ID');
  };

  // Function to parse formatted string back to number
  const parseCurrencyInput = (value: string) => {
    return parseInt(value.replace(/\./g, '')) || 0;
  };

  const handleDownloadPDF = () => {
    if (!slipRef.current) return;
    
    const element = slipRef.current;
    const opt = {
      margin: 10,
      filename: `Slip_Gaji_${employee.nama}_${data.month}_${data.year}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    (window as any).html2pdf().set(opt).from(element).save();
  };

  const handleDownloadExcel = () => {
    const excelData = [{
      'Nama Karyawan': employee.nama,
      'Bulan': data.month,
      'Tahun': data.year,
      'Gaji Pokok': data.gapok,
      'Tunjangan Makan': data.tunjanganMakan,
      'Tunjangan Transport': data.tunjanganTransport,
      'Tunjangan Komunikasi': data.tunjanganKomunikasi,
      'Lembur': data.lembur,
      'Bonus': data.bonus,
      'Potongan BPJS': totalPotongan,
      'Total Diterima (THP)': takeHomePay
    }];

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Gaji");
    XLSX.writeFile(workbook, `Data_Gaji_${employee.nama}_${data.month}_${data.year}.xlsx`);
  };

  if (isPreview) {
    return (
      <div className="fixed inset-0 bg-white z-[60] p-4 md:p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto mb-20">
          <div ref={slipRef} className="border p-6 md:p-10 bg-white shadow-lg print:shadow-none">
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Slip Gaji Karyawan</h1>
                <p className="text-slate-600 font-bold">Visibel ID</p>
                <p className="text-[10px] text-slate-500 max-w-[250px] leading-relaxed">
                  Ciomas harapan kp neglasari RT 01/12 no 4, Ciomas, kab Bogor, Jawa barat 16610
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-blue-600">{data.month} {data.year}</p>
                <p className="text-xs text-slate-500 font-mono">ID: {new Date().getTime().toString().slice(-8)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 text-sm bg-slate-50 p-4 rounded-xl">
              <div className="space-y-1">
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Informasi Karyawan</p>
                <p className="font-bold text-slate-800">{employee.nama}</p>
                <p className="text-slate-600">No. KTP: <span className="font-medium">{employee.noKtp}</span></p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Pembayaran</p>
                <p className="font-bold text-slate-800">{employee.bank}</p>
                <p className="text-slate-600 font-mono">{employee.noRekening}</p>
                <p className="text-[10px] italic text-slate-400">A/N: {employee.namaDiRekening}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-1">Pendapatan (+)</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">Gaji Pokok</td>
                      <td className="py-2 text-right font-medium">Rp {data.gapok.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">Tunjangan Makan</td>
                      <td className="py-2 text-right font-medium">Rp {data.tunjanganMakan.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">Tunjangan Transportasi</td>
                      <td className="py-2 text-right font-medium">Rp {data.tunjanganTransport.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">Tunjangan Komunikasi</td>
                      <td className="py-2 text-right font-medium">Rp {data.tunjanganKomunikasi.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">Lembur</td>
                      <td className="py-2 text-right font-medium text-emerald-600">Rp {data.lembur.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">Bonus</td>
                      <td className="py-2 text-right font-medium text-emerald-600">Rp {data.bonus.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="font-bold bg-slate-50">
                      <td className="py-2 px-2">Total Pendapatan</td>
                      <td className="py-2 px-2 text-right">Rp {totalPendapatan.toLocaleString('id-ID')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-1">Potongan (-)</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-600">BPJS Ketenagakerjaan</td>
                      <td className="py-2 text-right font-medium text-red-500">Rp {data.bpjstk.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr className="font-bold bg-slate-50">
                      <td className="py-2 px-2">Total Potongan</td>
                      <td className="py-2 px-2 text-right text-red-600">Rp {totalPotongan.toLocaleString('id-ID')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t-2 border-slate-800 pt-4 mb-12">
              <div className="flex justify-between items-center py-4 px-6 bg-blue-600 rounded-xl text-white">
                <span className="text-lg font-bold">TAKE HOME PAY</span>
                <span className="text-3xl font-black">Rp {takeHomePay.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="flex justify-between mt-12 px-8">
              <div className="text-center w-40">
                <p className="text-[10px] text-slate-400 mb-16 italic font-bold">Karyawan,</p>
                <div className="border-b border-slate-800"></div>
                <p className="text-sm font-bold uppercase mt-2">{employee.nama}</p>
              </div>
              <div className="text-center w-40">
                <p className="text-[10px] text-slate-400 mb-16 italic font-bold">HR Manager,</p>
                <div className="border-b border-slate-800"></div>
                <p className="text-sm font-bold uppercase mt-2">Visibel Admin</p>
              </div>
            </div>

            <div className="mt-12 text-center text-[10px] text-slate-300 border-t pt-4">
              <p>&copy; 2026 Licensed by Visibel ID. Dokumen ini adalah slip gaji resmi.</p>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4 no-print">
            <button 
              onClick={() => setIsPreview(false)}
              className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Kembali Edit
            </button>
            <button 
              onClick={handleDownloadPDF}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputFields = [
    { label: 'Bulan', name: 'month', type: 'text' },
    { label: 'Tahun', name: 'year', type: 'text' },
    { label: 'Gaji Pokok', name: 'gapok', type: 'currency' },
    { label: 'Tj. Makan', name: 'tunjanganMakan', type: 'currency' },
    { label: 'Tj. Transportasi', name: 'tunjanganTransport', type: 'currency' },
    { label: 'Tj. Komunikasi', name: 'tunjanganKomunikasi', type: 'currency' },
    { label: 'BPJS TK', name: 'bpjstk', type: 'currency', helper: 'Potongan bulanan' },
    { label: 'Lembur', name: 'lembur', type: 'currency' },
    { label: 'Bonus', name: 'bonus', type: 'currency' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[50]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
          <div>
            <h2 className="text-xl font-bold">Komponen Gaji</h2>
            <p className="text-blue-100 text-xs">Untuk: {employee.nama}</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-2xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {inputFields.map((field) => (
              <div key={field.name} className={field.name === 'month' || field.name === 'year' ? '' : 'col-span-1'}>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{field.label}</label>
                {field.type === 'currency' ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                    <input 
                      type="text"
                      value={formatCurrencyInput((data as any)[field.name])} 
                      onChange={e => setData({...data, [field.name]: parseCurrencyInput(e.target.value)})}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 pl-8 text-sm focus:border-blue-400 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400 shadow-sm"
                    />
                  </div>
                ) : (
                  <input 
                    type="text"
                    value={(data as any)[field.name]} 
                    onChange={e => setData({...data, [field.name]: e.target.value})}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-blue-400 outline-none transition-all font-bold text-slate-900 shadow-sm"
                  />
                )}
                {field.helper && <p className="text-[9px] text-red-500 mt-1 font-bold">{field.helper}</p>}
              </div>
            ))}
          </div>
          
          <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-blue-800">Total Take Home Pay</span>
              <span className="text-lg font-black text-blue-700">Rp {takeHomePay.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50 flex gap-3">
          <button 
            onClick={handleDownloadExcel}
            className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Unduh Excel
          </button>
          <button 
            onClick={() => setIsPreview(true)}
            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 flex items-center justify-center gap-2"
          >
            Lihat Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalarySlipModal;
