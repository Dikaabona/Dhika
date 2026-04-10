
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkEmail() {
  const emailToSearch = 'wida.oktapiani99@gmail.com';
  
  console.log(`Searching for email: ${emailToSearch}`);
  
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .ilike('email', emailToSearch);
    
  if (error) {
    console.error('Error searching employee:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Found employee:', JSON.stringify(data, null, 2));
  } else {
    console.log('Employee not found with exact email.');
    
    // Search for similar emails or just list some to see the format
    const { data: allEmps } = await supabase
      .from('employees')
      .select('nama, email')
      .limit(20);
      
    console.log('Sample employees in DB:');
    console.log(JSON.stringify(allEmps, null, 2));
    
    // Try searching by name if we know it, or just partial email
    const { data: partial } = await supabase
      .from('employees')
      .select('*')
      .ilike('email', '%wida%');
      
    console.log('Partial match for "wida":');
    console.log(JSON.stringify(partial, null, 2));
  }
}

checkEmail();
