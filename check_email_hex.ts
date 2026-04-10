
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkEmailHex() {
  const { data, error } = await supabase
    .from('employees')
    .select('email')
    .ilike('email', 'wida.oktapiani99@gmail.com');
    
  if (data && data[0]) {
    const email = data[0].email;
    console.log(`Email: "${email}"`);
    console.log(`Hex: ${Buffer.from(email).toString('hex')}`);
    
    const expected = 'wida.oktapiani99@gmail.com';
    console.log(`Expected Hex: ${Buffer.from(expected).toString('hex')}`);
  }
}

checkEmailHex();
