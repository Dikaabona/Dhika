import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugReminders() {
  console.log('--- DEBUGGING REMINDERS ---');
  console.log('ENABLE_LOCAL_CRON:', process.env.ENABLE_LOCAL_CRON);
  console.log('WAHA_API_URL:', process.env.WAHA_API_URL ? 'SET' : 'NOT SET');

  const today = new Date().toISOString().split('T')[0];
  console.log('Today (UTC):', today);

  // Get employees
  const names = ['Fikry Aditya Rizky', 'Adinda Salsabilla', 'Ezar Rizarul Fiqry', 'Ryan Adhitya R'];
  const { data: emps, error: empError } = await supabase
    .from('employees')
    .select('*')
    .in('nama', names);

  if (empError) {
    console.error('Error fetching employees:', empError);
    return;
  }

  console.log(`Found ${emps?.length || 0} employees.`);

  for (const emp of emps || []) {
    console.log(`\nChecking for: ${emp.nama} (ID: ${emp.id}, Phone: ${emp.noHandphone})`);
    
    // Check shift assignment
    const { data: assignments, error: assignError } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('employeeId', emp.id)
      .eq('date', today);

    if (assignError) {
      console.error('Error fetching assignments:', assignError);
      continue;
    }

    if (!assignments || assignments.length === 0) {
      console.log('No shift assignment for today.');
      continue;
    }

    for (const assign of assignments) {
      console.log(`Shift Assignment: ${assign.shiftId}`);
      
      // Get shift details
      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', assign.shiftId)
        .single();

      if (shiftError) {
        console.error('Error fetching shift:', shiftError);
        continue;
      }

      console.log(`Shift: ${shift.name} (${shift.startTime} - ${shift.endTime})`);

      // Check attendance
      const { data: att, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employeeId', emp.id)
        .eq('date', today)
        .maybeSingle();

      if (attError) {
        console.error('Error fetching attendance:', attError);
      } else if (att) {
        console.log(`Attendance found: ClockIn at ${att.clockIn}`);
      } else {
        console.log('No attendance record for today.');
      }
    }
  }
}

debugReminders();
