import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Querying information_schema is usually restricted, but let's try a common table
  const { data: tables, error } = await supabase.rpc('get_tables'); // If there's a custom RPC
  if (error) {
    console.log("RPC get_tables not found, trying manual check of common names");
    const common = ['shifts', 'shift_types', 'master_shifts', 'attendance', 'employees', 'settings', 'shift_assignments'];
    for (const t of common) {
      const { error: e } = await supabase.from(t).select('*', { count: 'exact', head: true });
      console.log(`Table '${t}': ${e ? 'Error ' + e.code : 'Exists'}`);
    }
  } else {
    console.log("Tables:", tables);
  }
}

check();
