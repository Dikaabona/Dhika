
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const ids = ['40d8929e-224a-449e-b816-174880529d33', '6879c289-1f78-4253-8064-e6c7ca9c9df6'];
  const { data: emps } = await supabase.from('employees').select('id, nama').in('id', ids);
  console.log("Employees for Shift 3:", emps);
}

check();
