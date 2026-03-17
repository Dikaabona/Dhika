
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUpcoming() {
  const today = '2026-03-17';
  const now = new Date();
  const currentHour = 14; // WIB
  const currentMin = 24; // WIB
  
  console.log(`Current Time (WIB): ${currentHour}:${currentMin}`);
  
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', today);
    
  if (error) {
    console.error("Error fetching schedules:", error);
    return;
  }

  const { data: emps } = await supabase.from('employees').select('id, nama, noHandphone');

  const upcoming = schedules?.map(s => {
    const startTimeStr = s.hourSlot.split('-')[0].trim().replace('.', ':');
    const [h, m] = startTimeStr.split(':').map(Number);
    const totalMins = (h * 60) + m;
    const nowTotalMins = (currentHour * 60) + currentMin;
    const diff = totalMins - nowTotalMins;
    
    const host = emps?.find(e => e.id === s.hostId);
    const operator = emps?.find(e => e.id === s.opId);
    
    return {
      brand: s.brand,
      slot: s.hourSlot,
      startTime: startTimeStr,
      diff,
      host: host?.nama,
      operator: operator?.nama,
      notifAt: `${h}:${m - 15 < 0 ? 0 : m - 15}` // Simplified
    };
  }).filter(s => s.diff > 0).sort((a, b) => a.diff - b.diff);

  console.log("Upcoming Notifications:");
  console.log(JSON.stringify(upcoming, null, 2));
}

checkUpcoming();
