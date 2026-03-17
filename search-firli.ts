
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const tables = ['schedules', 'shift_assignments', 'attendance', 'content_plans'];
  const firliId = '96f83462-c481-4ff6-bc73-e47aa3d11b71';
  
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.log(`Table ${t} error: ${error.message}`);
      continue;
    }
    console.log(`Table ${t} has ${data.length} rows`);
    const found = data.filter((row: any) => JSON.stringify(row).includes(firliId));
    if (found.length > 0) {
      console.log(`Found Firli in ${t}:`, found);
    }
  }
}

check();
