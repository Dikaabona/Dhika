
import axios from "axios";

const apiUrl = "https://waha-e1fqkhd0cijw.cgk-super.sumopod.my.id";
const apiKey = "kDx7DDRlTic6RGfZ5nAaKjpQml6MFLBb";
const sessionName = "Dhika-WAHA";

async function findGroup() {
  try {
    const response = await axios.get(`${apiUrl}/api/${sessionName}/groups`, {
      headers: { 'X-Api-Key': apiKey }
    });
    
    const groups = Object.values(response.data);
    const targetGroup: any = groups.find((g: any) => g.subject?.toLowerCase() === "ai test");
    
    if (targetGroup) {
      console.log("GROUP_ID:" + targetGroup.id);
      console.log("NAME:" + targetGroup.subject);
    } else {
      console.log("NOT_FOUND");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

findGroup();
