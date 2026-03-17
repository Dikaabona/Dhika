
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const ids = ['6879c289-1f78-4253-8064-e6c7ca9c9df6', '96f83462-c481-4ff6-bc73-e47aa3d11b71'];
  const { data: emps } = await supabase.from('employees').select('nama, noHandphone').in('id', ids);
  console.log("Contact info:", emps);
}

check();
