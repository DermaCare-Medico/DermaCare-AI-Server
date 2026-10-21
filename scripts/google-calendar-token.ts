import "dotenv/config";
import { google } from "googleapis";
import { createInterface } from "node:readline/promises";

const {
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI
} = process.env; 

if(
    !GOOGLE_CALENDAR_CLIENT_ID ||
    !GOOGLE_CALENDAR_CLIENT_SECRET ||
    !GOOGLE_CALENDAR_REDIRECT_URI
){
    throw new Error("Missing Google Calender Credentials")
}


const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI
)


const rl = createInterface({
    input : process.stdin,
    output : process.stdout
})



try{
    const code =  await rl.question("Enter authorization code: ");
    const { tokens } = await oAuth2Client.getToken(code.trim());
    if(!tokens.refresh_token){
        throw new Error("No refersh token recieved")
    }


    console.log("\nRefersh Token:" , tokens.refresh_token);
}finally{
    rl.close
}