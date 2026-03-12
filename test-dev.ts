
import axios from 'axios';

async function testDev() {
  const url = 'https://ais-dev-2o26hqewofzqxhvztgztta-20816017201.asia-southeast1.run.app/api/health';
  try {
    const res = await axios.get(url);
    console.log("Dev Health Check:", res.data);
  } catch (err: any) {
    console.error("Dev Health Check FAILED:", err.response?.data || err.message);
  }
}

testDev();
