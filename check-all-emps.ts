
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: emps } = await supabase.from('employees').select('id, nama');
  console.log("Total employees:", emps?.length);
  const target = emps?.find(e => e.id === '40d8929e-224a-449e-b816-174880529d33');
  console.log("Target employee:", target);
}

check();
