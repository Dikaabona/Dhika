
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function checkPhoneNumbers() {
  const { data: emps, error } = await supabase.from('employees').select('id, nama, noHandphone');
  
  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  console.log(`Total Employees: ${emps.length}`);
  const invalidFormat = emps.filter(emp => {
    const phone = emp.noHandphone || '';
    return !phone.startsWith('628');
  });

  if (invalidFormat.length > 0) {
    console.log("\nEmployees with phone numbers NOT starting with '628':");
    invalidFormat.forEach(emp => {
      console.log(`- ${emp.nama}: ${emp.noHandphone || '(Empty)'}`);
    });
  } else {
    console.log("\nAll employee phone numbers start with '628'.");
  }
}

checkPhoneNumbers();
