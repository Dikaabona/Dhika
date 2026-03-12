
import axios from 'axios';

async function testExternal() {
  const url = 'https://ais-pre-2o26hqewofzqxhvztgztta-20816017201.asia-southeast1.run.app/api/health';
  try {
    const res = await axios.get(url);
    console.log("External Health Check:", res.data);
  } catch (err: any) {
    console.error("External Health Check FAILED:", err.response?.data || err.message);
  }
}

testExternal();
