
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const today = new Date().toISOString().split('T')[0];
  const firliId = '96f83462-c481-4ff6-bc73-e47aa3d11b71';
  const pajarId = '6879c289-1f78-4253-8064-e6c7ca9c9df6';
  
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .in('employeeId', [firliId, pajarId])
    .eq('date', today);
    
  if (error) {
    console.error('Error fetching attendance:', error);
  } else {
    console.log('Attendance records found:', data);
  }
}

check();
