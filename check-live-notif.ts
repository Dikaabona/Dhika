
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const today = '2026-03-17';
  console.log(`Checking live_schedules for ${today}...`);
  
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', today);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Found schedules:", JSON.stringify(schedules, null, 2));
}

check();
