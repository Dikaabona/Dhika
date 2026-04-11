
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // This might not work if get_tables RPC doesn't exist
  if (error) {
    // Fallback: try to query a common table to see if it exists
    console.log('Error listing tables via RPC, trying direct queries...');
    const tables = ['employees', 'attendance', 'content_plans', 'live_reports', 'schedules', 'submissions', 'broadcasts', 'shift_assignments', 'advertising_records', 'settings'];
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('*').limit(1);
      if (!tableError) {
        console.log(`Table exists: ${table}`);
      } else {
        console.log(`Table error (${table}): ${tableError.message}`);
      }
    }
  } else {
    console.log('Tables:', data);
  }
}

listTables();
