
import React from 'react';

interface SalarySlipContentProps {
  employee: any;
  data: any;
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
  return (
    <div style={{ width: '794px', height: '1122px', position: 'relative', overflow: 'hidden', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff' }}>
      <div style={{ padding: '20px 60px 30px 60px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={slipLogo} alt="Logo" style={{ height: '65px', width: 'auto' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '30px', fontWeight: '900', margin: '0', letterSpacing: '-1px' }}>SLIP GAJI</h2>
            <p style={{ fontSize: '14px', fontWeight: '800', color: '#806000', margin: '2px 0' }}>{(data.month || '').toUpperCase()} {data.year}</p>
            <p style={{ fontSize: '9px', color: '#94a3b8', margin: '2px 0 0 0' }}>Cutoff: {cutoffStart} - {cutoffEnd}</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFBEB', border: '1.2px solid #FFC000', borderRadius: '24px', padding: '20px 35px', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '20px', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Nama Karyawan</p>
            <p style={{ fontSize: '18px', fontWeight: '900', margin: '2px 0 8px 0' }}>{employee.nama}</p>
            <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>ID KARYAWAN</p>
            <p style={{ fontSize: '12px', fontWeight: '900', color: '#806000', margin: '2px 0 0 0' }}>{employee.idKaryawan}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '18px', fontWeight: '900', margin: '2px 0 8px 0' }}>{employee.jabatan}</p>
            <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>NO. REKENING</p>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#334155', margin: '2px 0 0 0' }}>{employee.noRekening} ({employee.bank})</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>Penerimaan (+)</h3>
            <div style={{ fontSize: '12px', lineHeight: '2.0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gaji Pokok</span><span style={{ fontWeight: '800' }}>Rp {(data.gapok || 0).toLocaleString('id-ID')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tunjangan Ops..</span><span style={{ fontWeight: '800' }}>Rp {(totalTunjanganOps || 0).toLocaleString('id-ID')}</span></div>
              {(data.lembur || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Lembur</span><span style={{ fontWeight: '800' }}>Rp {data.lembur.toLocaleString('id-ID')}</span></div>}
              {data.bonus > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bonus</span><span style={{ fontWeight: '800' }}>Rp {data.bonus.toLocaleString('id-ID')}</span></div>}
              {(data.thr || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#806000', fontWeight: '800' }}>THR</span><span style={{ color: '#806000', fontWeight: '900' }}>Rp {(data.thr || 0).toLocaleString('id-ID')}</span></div>}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '13px' }}><span>Total Bruto</span><span>Rp {(totalPendapatan || 0).toLocaleString('id-ID')}</span></div>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>Potongan (-)</h3>
            <div style={{ fontSize: '12px', lineHeight: '2.0' }}>
              {isBPJSTKActive && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>BPJS TK (2%)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.bpjstk || 0).toLocaleString('id-ID')}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Absensi ({attendanceResults.alpha || 0} Alpha)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(potonganAbsensi || 0).toLocaleString('id-ID')}</span></div>
              {(data.pph21 || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PPh 21</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.pph21 || 0).toLocaleString('id-ID')}</span></div>}
              {(data.potonganHutang || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cicilan Hutang</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.potonganHutang || 0).toLocaleString('id-ID')}</span></div>}
              {(data.potonganLain || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Potongan Lain</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.potonganLain || 0).toLocaleString('id-ID')}</span></div>}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '13px' }}><span>Total Potongan</span><span style={{ color: '#ef4444' }}>Rp {(totalPotongan || 0).toLocaleString('id-ID')}</span></div>
            </div>
          </div>
        </div>

        {(employee.hutang || 0) > 0 && (
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '15px 25px', marginBottom: '20px', border: '1px solid #e2e8f0', flexShrink: 0 }}>
            <h3 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}>Informasi Hutang Karyawan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div><p style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Saldo Awal</p><p style={{ fontSize: '12px', fontWeight: '800', margin: '2px 0 0 0' }}>Rp {(employee.hutang || 0).toLocaleString('id-ID')}</p></div>
              <div><p style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Potongan</p><p style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444', margin: '2px 0 0 0' }}>- Rp {(data.potonganHutang || 0).toLocaleString('id-ID')}</p></div>
              <div><p style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Sisa Hutang</p><p style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0' }}>Rp {(sisaHutang || 0).toLocaleString('id-ID')}</p></div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '32px', padding: '25px', textAlign: 'center', border: '3px solid rgba(255, 192, 0, 0.2)', flexShrink: 0, marginTop: 'auto' }}>
          <span style={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '4px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Total Gaji Bersih</span>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#FFC000' }}>IDR</span>
            <span style={{ fontSize: '42px', fontWeight: '900' }}>Rp {(takeHomePay || 0).toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
          <p style={{ fontSize: '8px', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>- DOKUMEN ELEKTRONIK SAH -</p>
        </div>
      </div>
    </div>
  );
};

export default SalarySlipContent;
