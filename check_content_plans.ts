
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkContentPlans() {
  // Check count
  const { count, error: countError } = await supabase
    .from('content_plans')
    .select('*', { count: 'exact', head: true });
    
  if (countError) {
    console.error('Error fetching count:', countError.message);
  } else {
    console.log(`Total records in content_plans: ${count}`);
  }

  // Check sample record to see columns
  const { data: sample, error: sampleError } = await supabase
    .from('content_plans')
    .select('*')
    .limit(1);
    
  if (sampleError) {
    console.error('Error fetching sample:', sampleError.message);
  } else if (sample && sample.length > 0) {
    console.log('Columns in content_plans:', Object.keys(sample[0]));
    console.log('Sample record:', sample[0]);
  } else {
    console.log('No records found in content_plans.');
  }
}

checkContentPlans();
