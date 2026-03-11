
import React from 'react';
import { Employee, SalaryData } from '../types';

interface SalarySlipContentProps {
  employee: Employee;
  data: SalaryData;
  totalTunjanganOps: number;
  totalPendapatan: number;
  totalPotongan: number;
  takeHomePay: number;
  sisaHutang: number;
  attendanceResults: any;
  cutoffStart: number;
  cutoffEnd: number;
  slipLogo: string;
  isBPJSTKActive: boolean;
  potonganAbsensi: number;
}

const SalarySlipContent: React.FC<SalarySlipContentProps> = ({
  employee,
  data,
  totalTunjanganOps,
  totalPendapatan,
  totalPotongan,
  takeHomePay,
  sisaHutang,
  attendanceResults,
  cutoffStart,
  cutoffEnd,
  slipLogo,
  isBPJSTKActive,
  potonganAbsensi
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount).replace('Rp', 'Rp ');
  };

  return (
    <div className="bg-white p-12 w-[210mm] min-h-[297mm] mx-auto text-[#0f172a] font-sans relative overflow-hidden">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-10">
        <div className="w-48">
          <img src={slipLogo} alt="Visibel Logo" className="w-full object-contain" referrerPolicy="no-referrer" />
        </div>
        <div className="text-right">
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-1">SLIP GAJI</h1>
          <h2 className="text-xl font-black text-[#FFC000] uppercase tracking-tight mb-1">
            {data.month} {data.year}
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Cutoff: {cutoffStart} - {cutoffEnd}
          </p>
        </div>
      </div>

      <div className="w-full h-0.5 bg-slate-100 mb-8"></div>

      {/* Employee Info Box */}
      <div className="bg-[#FFFDF0] border-2 border-[#FFC000] rounded-[32px] p-8 mb-12 flex justify-between items-center">
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nama Karyawan</p>
            <h3 className="text-2xl font-black tracking-tight">{employee.nama}</h3>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">ID Karyawan</p>
            <p className="text-lg font-black text-[#FFC000]">{employee.idKaryawan || employee.id}</p>
          </div>
        </div>
        <div className="text-right space-y-6">
          <div>
            <h4 className="text-3xl font-black tracking-tighter uppercase">{employee.jabatan}</h4>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">No. Rekening</p>
            <p className="text-lg font-black">{employee.noRekening || '-'}</p>
          </div>
        </div>
      </div>

      {/* Salary Breakdown Grid */}
      <div className="grid grid-cols-2 gap-16 mb-16">
        {/* Penerimaan */}
        <div>
          <h5 className="text-sm font-black uppercase tracking-widest mb-6 border-b-2 border-slate-900 pb-2 inline-block">
            Penerimaan (+)
          </h5>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Gaji Pokok</span>
              <span className="text-sm font-black">{formatCurrency(data.gapok || 0)}</span>
            </div>
            {data.tunjanganJabatan > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Tunjangan Jabatan</span>
                <span className="text-sm font-black">{formatCurrency(data.tunjanganJabatan)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Tunjangan Ops..</span>
              <span className="text-sm font-black">{formatCurrency(totalTunjanganOps)}</span>
            </div>
            {data.bonus > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Bonus/Insentif</span>
                <span className="text-sm font-black">{formatCurrency(data.bonus)}</span>
              </div>
            )}
            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-widest">Total Bruto</span>
              <span className="text-sm font-black">{formatCurrency(totalPendapatan)}</span>
            </div>
          </div>
        </div>

        {/* Potongan */}
        <div>
          <h5 className="text-sm font-black uppercase tracking-widest mb-6 border-b-2 border-slate-900 pb-2 inline-block">
            Potongan (-)
          </h5>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Absensi ({attendanceResults?.absent || 0} Alpha)</span>
              <span className="text-sm font-black text-rose-500">{formatCurrency(potonganAbsensi)}</span>
            </div>
            {isBPJSTKActive && data.bpjstk > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">BPJS TK</span>
                <span className="text-sm font-black text-rose-500">{formatCurrency(data.bpjstk)}</span>
              </div>
            )}
            {data.potonganHutang > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Cicilan Hutang</span>
                <span className="text-sm font-black text-rose-500">{formatCurrency(data.potonganHutang)}</span>
              </div>
            )}
            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-widest">Total Potongan</span>
              <span className="text-sm font-black text-rose-500">{formatCurrency(totalPotongan)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Total Net Pay Box */}
      <div className="mt-auto mb-12">
        <div className="bg-[#0f172a] rounded-[48px] p-12 text-center shadow-2xl relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          </div>
          
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6 relative z-10">
            Total Gaji Bersih
          </p>
          <div className="flex items-center justify-center gap-4 relative z-10">
            <span className="text-xl font-black text-[#FFC000] mt-2">IDR</span>
            <h4 className="text-7xl font-black tracking-tighter text-white">
              {formatCurrency(takeHomePay).replace('Rp ', '')}
            </h4>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
          - Dokumen Elektronik Sah -
        </p>
      </div>
    </div>
  );
};

export default SalarySlipContent;
