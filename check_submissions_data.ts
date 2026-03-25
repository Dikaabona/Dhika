import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSubmissions() {
  console.log('--- Checking Submissions ---');
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('type', 'Cuti')
    .eq('status', 'Approved')
    .gte('startDate', '2026-01-01')
    .limit(10);

  if (error) {
    console.error('Error fetching submissions:', error);
    return;
  }

  console.log('Sample Approved Leave Submissions (>= 2026-01-01):');
  console.log(JSON.stringify(data, null, 2));
}

checkSubmissions();
