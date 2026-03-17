
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const today = '2026-03-17';
  
  console.log("--- Schedules Today ---");
  const { data: schedules } = await supabase.from('schedules').select('*').eq('date', today);
  console.log(schedules);

  console.log("\n--- Shift Assignments Today ---");
  const { data: assignments } = await supabase.from('shift_assignments').select('*').eq('date', today);
  console.log(assignments);
  
  console.log("\n--- Content Plans Today ---");
  const { data: contents } = await supabase.from('content_plans').select('*').eq('postingDate', today);
  console.log(contents);
}

check();
