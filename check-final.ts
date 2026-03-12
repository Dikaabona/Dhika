
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkFinal() {
  console.log("--- FINAL CHECK ---");
  
  // 1. Cek apakah tabel employees sekarang sudah bisa dibaca
  const { data: emps, error } = await supabase.from('employees').select('nama, noHandphone');
  if (error) {
    console.error("❌ Masih Gagal Baca Employees:", error.message);
  } else {
    console.log(`✅ Berhasil Baca Employees! Total: ${emps?.length}`);
    const me = emps?.find(e => e.noHandphone.includes('8111624080'));
    console.log(me ? `👉 Nomor Anda (${me.noHandphone}) DITEMUKAN!` : "👉 Nomor Anda BELUM DITEMUKAN di list.");
  }

  // 2. Cek Log Webhook Terakhir
  const { data: logs } = await supabase.from('waha_logs').select('*').order('timestamp', { ascending: false }).limit(5);
  console.log("--- 5 LOG TERAKHIR ---");
  logs?.forEach(l => {
    console.log(`[${l.timestamp}] ${l.type}: ${JSON.stringify(l.data)}`);
  });
}

checkFinal();
