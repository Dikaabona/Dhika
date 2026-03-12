
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seedUser() {
  const user = {
    nama: 'DHIKA',
    noHandphone: '628111624080',
    company: 'Visibel',
    jabatan: 'Admin'
  };

  console.log(`Seeding user ${user.nama} with phone ${user.noHandphone}`);
  
  const { data, error } = await supabase
    .from('employees')
    .insert(user);
    
  if (error) {
    console.error("Error seeding user:", error);
  } else {
    console.log("User seeded successfully.");
  }
}

seedUser();
