
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', '2026-03-01')
    .lte('date', '2026-03-31');
    
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${attendance?.length} attendance records in March.`);
    if (attendance && attendance.length > 0) {
      console.log("Sample attendance:", attendance.slice(0, 5));
    }
  }
}

check();
