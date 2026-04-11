
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAprilRecords() {
  const { count, error } = await supabase
    .from('content_plans')
    .select('*', { count: 'exact', head: true })
    .gte('postingDate', '2026-04-01')
    .lte('postingDate', '2026-04-30');
    
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(`Total records in April 2026: ${count}`);
  }
}

checkAprilRecords();
