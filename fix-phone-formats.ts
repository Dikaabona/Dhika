
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function fixPhoneNumbers() {
  const { data: emps, error } = await supabase.from('employees').select('id, nama, noHandphone');
  
  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  console.log(`Total Employees: ${emps.length}`);
  const toFix = emps.filter(emp => {
    const phone = emp.noHandphone || '';
    return phone.startsWith('08');
  });

  if (toFix.length === 0) {
    console.log("No phone numbers starting with '08' found.");
    return;
  }

  console.log(`\nFixing ${toFix.length} phone numbers...`);
  for (const emp of toFix) {
    const newPhone = '62' + emp.noHandphone.substring(1);
    console.log(`- ${emp.nama}: ${emp.noHandphone} -> ${newPhone}`);
    const { error: updateError } = await supabase
      .from('employees')
      .update({ noHandphone: newPhone })
      .eq('id', emp.id);
    
    if (updateError) {
      console.error(`Error updating ${emp.nama}:`, updateError);
    }
  }
  console.log("\nPhone numbers fixed.");
}

fixPhoneNumbers();
