
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkWidaByName() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .ilike('nama', '%Wida Oktapiani%');
    
  if (data) {
    console.log(`Found ${data.length} records matching "Wida Oktapiani":`);
    data.forEach(emp => {
      console.log(`- ID: ${emp.id}`);
      console.log(`  Nama: "${emp.nama}"`);
      console.log(`  Email: "${emp.email}"`);
      console.log(`  Deleted At: ${emp.deleted_at}`);
    });
  }
}

checkWidaByName();
