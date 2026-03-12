
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEmployee() {
  const phoneToSearch = '8111624080';
  console.log(`Searching for employee with phone ending in: ${phoneToSearch}`);
  
  const { data: employees, error } = await supabase
    .from('employees')
    .select('*');
    
  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  console.log(`Total employees in DB: ${employees?.length}`);
  
  const match = employees?.find(e => (e.noHandphone || '').replace(/\D/g, '').endsWith(phoneToSearch));
  
  if (match) {
    console.log("MATCH FOUND:");
    console.log(`Name: ${match.nama}`);
    console.log(`Phone in DB: ${match.noHandphone}`);
    console.log(`Company: ${match.company}`);
  } else {
    console.log("NO MATCH FOUND.");
    console.log("Available numbers in DB:");
    employees?.forEach(e => console.log(`- ${e.nama}: ${e.noHandphone}`));
  }
}

checkEmployee();
