
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function calculateUsedLeave() {
  const currentYear = new Date().getFullYear();
  const startDate = `${currentYear}-01-01`;
  const endDate = `${currentYear}-12-31`;

  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('employeeId, status, date')
    .eq('status', 'Cuti')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    console.error(error);
    return;
  }

  const usedMap = new Map();
  attendance.forEach(r => {
    const current = usedMap.get(r.employeeId) || 0;
    usedMap.set(r.employeeId, current + 1);
  });

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, nama, sisaCuti, tanggalMasuk')
    .is('deleted_at', null);

  if (empError) {
    console.error(empError);
    return;
  }

  console.log('Calculated vs Current Sisa Cuti:');
  employees.forEach(emp => {
    const used = usedMap.get(emp.id) || 0;
    const name = emp.nama.toLowerCase();
    let adjustment = 0;
    if (name.includes('fikry aditya rizky')) adjustment = 2;
    else if (name.includes('iskandar juliana')) adjustment = 3;
    else if (name.includes('adinda salsabilla')) adjustment = 3;
    else if (name.includes('pajar sidik')) adjustment = 1;

    // Tenure check
    const parts = emp.tanggalMasuk.split('/');
    if (parts.length !== 3) {
      console.log(`${emp.nama}: Invalid date format ${emp.tanggalMasuk}`);
      return;
    }
    const join = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    const now = new Date();
    let years = now.getFullYear() - join.getFullYear();
    if (now.getMonth() < join.getMonth() || (now.getMonth() === join.getMonth() && now.getDate() < join.getDate())) years--;
    
    const calculated = years < 1 ? 0 : Math.max(0, 12 - used - adjustment);
    
    console.log(`${emp.nama}: DB=${emp.sisaCuti}, Calc=${calculated} (Used=${used}, Adj=${adjustment}, Tenure=${years})`);
  });
}

calculateUsedLeave();
