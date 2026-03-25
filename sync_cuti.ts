
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncCuti() {
  console.log('Fetching employees...');
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, nama, sisaCuti');
    
  if (empError) {
    console.error('Error fetching employees:', empError);
    return;
  }
  
  console.log(`Found ${employees.length} employees.`);
  
  console.log('Fetching approved leave submissions since 2026-01-01...');
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*')
    .eq('type', 'Cuti')
    .eq('status', 'Approved')
    .gte('startDate', '2026-01-01');
    
  if (subError) {
    console.error('Error fetching submissions:', subError);
    return;
  }
  
  console.log(`Found ${submissions.length} approved leave submissions.`);
  
  const leaveTakenMap = new Map();
  
  submissions.forEach(sub => {
    const start = new Date(sub.startDate);
    const end = new Date(sub.endDate);
    // Calculate days inclusive
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const current = leaveTakenMap.get(sub.employeeId) || 0;
    leaveTakenMap.set(sub.employeeId, current + diffDays);
  });
  
  const DEFAULT_LEAVE = 12;
  
  for (const emp of employees) {
    const taken = leaveTakenMap.get(emp.id) || 0;
    const newSisaCuti = DEFAULT_LEAVE - taken;
    
    console.log(`Updating ${emp.nama}: Taken ${taken} days, New Sisa Cuti: ${newSisaCuti}`);
    
    const { error: updateError } = await supabase
      .from('employees')
      .update({ sisaCuti: newSisaCuti })
      .eq('id', emp.id);
      
    if (updateError) {
      console.error(`Error updating ${emp.nama}:`, updateError);
    }
  }
  
  console.log('Sync complete.');
}

syncCuti();
