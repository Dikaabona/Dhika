
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debug() {
  console.log("--- DEBUGGING CONNECTION ---");
  
  // Check Employees
  const { data: emps, error: err1 } = await supabase.from('employees').select('nama, noHandphone').limit(5);
  if (err1) console.error("Error emps:", err1);
  else console.log(`Employees found: ${emps?.length || 0}`, emps);

  // Check WAHA Settings
  const { data: settings, error: err2 } = await supabase.from('settings').select('*').eq('key', 'waha_settings_Visibel').single();
  if (err2) console.error("Error settings:", err2);
  else console.log("WAHA Settings in DB:", settings.value);
}

debug();
