
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const today = '2026-03-17';
  console.log(`Checking attendance for ${today}...`);
  
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('*, employees(nama)')
    .eq('date', today);
    
  if (error) {
    // If join fails, fetch without join
    console.log("Join failed, fetching direct...");
    const { data: directAtt, error: directError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today);
      
    if (directError) {
      console.error("Error:", directError);
      return;
    }
    
    // Fetch employees to map names
    const { data: employees } = await supabase.from('employees').select('id, nama');
    const empMap = (employees || []).reduce((acc: any, emp: any) => {
      acc[emp.id] = emp.nama;
      return acc;
    }, {});
    
    const mapped = directAtt.map((att: any) => ({
      ...att,
      employeeName: empMap[att.employeeId] || 'Unknown'
    }));
    
    console.log("Attendance records:", JSON.stringify(mapped, null, 2));
  } else {
    console.log("Attendance records (with join):", JSON.stringify(attendance, null, 2));
  }
}

check();
