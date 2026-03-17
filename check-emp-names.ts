
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const ids = ['96f83462-c481-4ff6-bc73-e47aa3d11b71', '6879c289-1f78-4253-8064-e6c7ca9c9df6', 'd03a8ac6-f77f-46e5-bb98-89c85de5d5ab'];
  const { data: emps } = await supabase.from('employees').select('id, nama').in('id', ids);
  console.log("Employees:", emps);
}

check();
