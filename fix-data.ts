
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fix() {
  try {
    // 1. Find Wida Oktapiani
    const { data: employees } = await supabase.from('employees').select('*').ilike('nama', '%Wida Oktapiani%');
    if (!employees || employees.length === 0) {
      console.log("Employee not found");
      return;
    }
    const wida = employees[0];
    console.log("Found employee:", wida.nama, wida.id);

    // 2. Find the submission
    const { data: submissions } = await supabase.from('submissions')
      .select('*')
      .eq('employeeId', wida.id)
      .eq('type', 'Cuti')
      .eq('status', 'Approved');
    
    console.log("Found approved submissions:", submissions?.length);

    const targetSub = submissions?.find(s => s.startDate === '2026-03-23' && s.endDate === '2026-02-23');
    
    if (targetSub) {
      console.log("Found target submission:", targetSub.id);
      
      // Update submission dates
      const { error: updateError } = await supabase.from('submissions')
        .update({ startDate: '2026-02-23', endDate: '2026-02-23' })
        .eq('id', targetSub.id);
      
      if (updateError) {
        console.error("Error updating submission:", updateError);
      } else {
        console.log("Submission updated successfully");
      }
    } else {
      console.log("Target submission with wrong dates not found. Checking for any submission on Feb 23...");
      const anySub = submissions?.find(s => s.startDate === '2026-02-23' || s.endDate === '2026-02-23');
      if (anySub) {
         console.log("Found a submission on Feb 23:", anySub.id, anySub.startDate, anySub.endDate);
      }
    }

    // 3. Create attendance record for 2026-02-23
    const { error: attError } = await supabase.from('attendance').upsert({
      employeeId: wida.id,
      company: wida.company,
      date: '2026-02-23',
      status: 'Cuti',
      clockIn: '--:--',
      clockOut: '--:--',
      notes: 'Pengajuan disetujui (Sinkronisasi Manual): Izin karena ada acara keluarga halal bihalal di Bandung.'
    }, { onConflict: 'employeeId,date' });

    if (attError) {
      console.error("Error creating attendance record:", attError);
    } else {
      console.log("Attendance record created successfully for 2026-02-23");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

fix();
