import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificSub() {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('employeeId', '17696941770670.47568031245595743');
    
  console.log(data);
}

checkSpecificSub();
