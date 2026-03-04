
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log("--- Checking Employees ---");
  const { data: employees } = await supabase.from('employees').select('id, nama').in('nama', ['ARAFFI MAJID', 'MUHAMMAD ARIYANSYAH', 'PAJAR SIDIK']);
  console.log("Found employees:", employees);

  console.log("\n--- Checking Schedules for March 2026 ---");
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', '2026-03-01')
    .lte('date', '2026-03-31');
  
  if (error) {
    console.error("Error fetching schedules:", error);
  } else {
    console.log(`Found ${schedules?.length} schedules in March.`);
    if (schedules && schedules.length > 0) {
      console.log("Sample schedules:", schedules.slice(0, 5));
    }
  }

  console.log("\n--- Checking Brands ---");
  const { data: brands } = await supabase.from('settings').select('value').ilike('key', 'live_brands_%');
  console.log("Brands settings:", JSON.stringify(brands, null, 2));
}

checkData();
