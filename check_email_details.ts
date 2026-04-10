
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkEmailDetails() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, email, nama')
    .ilike('email', 'wida.oktapiani99@gmail.com');
    
  if (data) {
    data.forEach(emp => {
      console.log(`ID: ${emp.id}`);
      console.log(`Email: "${emp.email}" (Length: ${emp.email.length})`);
      console.log(`Nama: "${emp.nama}" (Length: ${emp.nama.length})`);
      
      // Check if it matches exactly without ilike
      const exactMatch = emp.email === 'wida.oktapiani99@gmail.com';
      console.log(`Exact match with "wida.oktapiani99@gmail.com": ${exactMatch}`);
    });
  }
}

checkEmailDetails();
