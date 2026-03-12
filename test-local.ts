
import axios from 'axios';

async function testLocal() {
  try {
    const res = await axios.get('http://localhost:3000/api/health');
    console.log("Local Health Check:", res.data);
  } catch (err: any) {
    console.error("Local Health Check FAILED:", err.message);
  }
}

testLocal();
