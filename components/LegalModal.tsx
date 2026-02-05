import React from 'react';
import { Icons } from '../constants';

interface LegalModalProps {
  type: 'privacy' | 'tos';
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  const isPrivacy = type === 'privacy';

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] sm:rounded-[40px] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 sm:p-8 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="p-2 bg-slate-200 rounded-xl">
              <Icons.FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight">
              {isPrivacy ? 'Kebijakan Privasi' : 'Syarat & Ketentuan'}
            </h2>
          </div>
          <button onClick={onClose} className="text-3xl leading-none text-slate-400 hover:text-slate-900 transition-colors">&times;</button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 sm:p-10 space-y-8 text-slate-600 leading-relaxed custom-scrollbar">
          {isPrivacy ? (
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">1. Kepemilikan & Kerahasiaan Data</h3>
                <p className="text-sm">Seluruh data pribadi yang dikelola oleh aplikasi HR.Visibel (Nama, KTP, Rekening, dll) adalah hak milik organisasi pengguna. Pengembang menjamin bahwa data ini disimpan dalam infrastruktur terenkripsi dan tidak akan dibagikan kepada pihak ketiga manapun untuk kepentingan komersial selain operasional sistem.</p>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">2. Integritas Verifikasi</h3>
                <p className="text-sm">Data biometrik dan lokasi GPS yang diambil selama proses absensi bersifat final. Upaya untuk memanipulasi atau menggunakan perangkat lunak pihak ketiga guna memalsukan data ini akan dicatat sebagai pelanggaran keamanan sistem yang serius.</p>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">3. Keamanan Akses Administrator</h3>
                <p className="text-sm">Akses tingkat tinggi (Super Admin/Admin) hanya diberikan kepada personel yang ditunjuk secara resmi. Penyalahgunaan wewenang administratif untuk merugikan data karyawan adalah tanggung jawab hukum penuh dari pemegang akun tersebut.</p>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">4. Pengawasan Berkas Digital</h3>
                <p className="text-sm">Dokumen kontrak dan KTP yang diunggah diproses dengan protokol keamanan tingkat tinggi. Pengembang tidak bertanggung jawab atas kebocoran informasi yang disebabkan oleh kelalaian pengguna dalam menjaga kerahasiaan kata sandi.</p>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">1. Lisensi Penggunaan & Hak Cipta</h3>
                <p className="text-sm">HR.Visibel adalah produk kekayaan intelektual Visibel ID. Pengguna diberikan hak non-eksklusif untuk menggunakan sistem ini sebagai platform manajemen. Dilarang keras menyalin, mendistribusikan ulang, atau melakukan rekayasa balik (reverse engineering) pada kode sumber tanpa izin tertulis.</p>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">2. Larangan Perubahan Konfigurasi</h3>
                <p className="text-sm font-black text-slate-900 italic underline">PENGGUNA DILARANG KERAS MERUBAH PENGATURAN SISTEM, STRUKTUR DATABASE, ATAU FITUR INTI TANPA PERSETUJUAN TERTULIS DARI PENGEMBANG.</p>
                <p className="text-sm">Setiap upaya modifikasi ilegal yang ditemukan akan mengakibatkan pencabutan akses secara sepihak dan penonaktifan akun secara permanen tanpa adanya kompensasi.</p>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">3. Model Penggunaan Perusahaan B2B</h3>
                <p className="text-sm font-medium text-slate-500 italic mb-2">Ketentuan: Akses Layanan (SaaS)</p>
                <p className="text-sm">Sistem ini ditawarkan sebagai layanan kepada perusahaan atau organisasi lain untuk pengelolaan SDM internal mereka. Pembayaran yang dilakukan oleh perusahaan pengguna adalah biaya lisensi penggunaan, bukan pembelian hak kepemilikan software. Perusahaan pengguna dilarang memindahtangankan lisensi atau menjual kembali akses sistem kepada pihak lain.</p>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">4. Batasan Tanggung Jawab</h3>
                <p className="text-sm">Pengembang menyediakan sistem "sebagaimana adanya". Pengembang tidak bertanggung jawab atas kerugian materiil akibat kesalahan entri data manual, pemalsuan data oleh karyawan pengguna, atau kelalaian manajemen operasional organisasi pengguna.</p>
              </section>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 border-t bg-slate-50">
          <button 
            onClick={onClose}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-[0.98] transition-all"
          >
            SAYA MENGERTI & SETUJU
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;