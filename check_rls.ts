
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'employees' });
  // If RPC doesn't exist, we can try to query pg_policies if we have access, 
  // but usually we don't.
  // Let's just try to query as a normal user if possible, but we don't have a user token.
  
  console.log('Checking RLS is hard without direct DB access.');
  console.log('But we can check if the table has RLS enabled.');
  
  const { data: tableInfo, error: tableError } = await supabase.from('employees').select('id').limit(1);
  console.log('Query with service role succeeded:', !!data);
}

// Let's try to see if there are any other employees with the same email in different companies?
// No, I already checked all records.

// Wait, look at the screenshot again.
// Is it possible the user is logging into a DIFFERENT environment or project?
// The URL in the runtime context is:
// https://ais-dev-2o26hqewofzqxhvztgztta-20816017201.asia-southeast1.run.app

// Let's check the supabase client config in the app.
