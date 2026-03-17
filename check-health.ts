
import axios from 'axios';

async function check() {
  try {
    const res = await axios.get('http://localhost:3000/api/health');
    console.log("Health check:", res.data);
  } catch (e) {
    console.error("Health check failed:", e.message);
  }
}

check();
