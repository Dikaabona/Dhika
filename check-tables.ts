
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_tables'); // This might not work if RPC is not defined
  if (error) {
    console.log("RPC error:", error.message);
    // Try a direct query to a common table
    const tables = ['shifts', 'shift_assignments', 'schedules', 'employees', 'attendance', 'content_plans', 'settings'];
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('*').limit(1);
      if (tableError) {
        console.log(`Table ${table} error:`, tableError.message);
      } else {
        console.log(`Table ${table} exists.`);
      }
    }
  } else {
    console.log("Tables:", data);
  }
}

check();
