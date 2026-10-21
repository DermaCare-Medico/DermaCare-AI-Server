import "dotenv/config";
import { google } from "googleapis";

// const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
// const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
// const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

// if (!clientId || !clientSecret || !redirectUri) {
//     throw new Error("Missing Google Calendar OAuth credentials");
// }

// const oauth2Client = new google.auth.OAuth2(
//     clientId,
//     clientSecret,
//     redirectUri
// );

// const authorizationUrl = oauth2Client.generateAuthUrl({
//     access_type: "offline",
//     prompt: "consent",
//     scope: [
//         "https://www.googleapis.com/auth/calendar.events",
//     ],
// });

// console.log("Open this URL in your browser:");
// console.log(authorizationUrl);



const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;



if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google Calender OAuth credentials")

}

const oAuth2CLient = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
);



const authorizationUrl = oAuth2CLient.generateAuthUrl({
    access_type : "offline",
    prompt : "consent",
    scope : [
        "https://www.googleapis.com/auth/calendar.events"
    ],
});


console.log("Open this Url in your browser")
console.log(authorizationUrl)


