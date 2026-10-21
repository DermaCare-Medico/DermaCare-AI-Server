import "dotenv/config";
import { google } from "googleapis";
import { randomUUID } from "node:crypto";

// const {
//     GOOGLE_CALENDAR_CLIENT_ID,
//     GOOGLE_CALENDAR_CLIENT_SECRET,
//     GOOGLE_CALENDAR_REDIRECT_URI,
//     GOOGLE_CALENDAR_REFRESH_TOKEN,
// } = process.env;

// if (
//     !GOOGLE_CALENDAR_CLIENT_ID ||
//     !GOOGLE_CALENDAR_CLIENT_SECRET ||
//     !GOOGLE_CALENDAR_REDIRECT_URI ||
//     !GOOGLE_CALENDAR_REFRESH_TOKEN
// ) {
//     throw new Error("Missing Google Calendar credentials");
// }

// const auth = new google.auth.OAuth2(
//     GOOGLE_CALENDAR_CLIENT_ID,
//     GOOGLE_CALENDAR_CLIENT_SECRET,
//     GOOGLE_CALENDAR_REDIRECT_URI
// );

// auth.setCredentials({
//     refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN,
// });

// const calendar = google.calendar({
//     version: "v3",
//     auth,
// });

// const start = new Date(Date.now() + 60 * 60 * 1000);
// const end = new Date(start.getTime() + 30 * 60 * 1000);

// async function main() {
//     const response = await calendar.events.insert({
//         calendarId: "primary",
//         conferenceDataVersion: 1,
//         requestBody: {
//             summary: "DermaCare AI — Test Consultation",
//             description: "Testing Google Meet integration",
//             start: {
//                 dateTime: start.toISOString(),
//             },
//             end: {
//                 dateTime: end.toISOString(),
//             },
//             conferenceData: {
//                 createRequest: {
//                     requestId: randomUUID(),
//                     conferenceSolutionKey: {
//                         type: "hangoutsMeet",
//                     },
//                 },
//             },
//         },
//     });

//     const event = response.data;

//     console.log("Event ID:", event.id);
//     console.log("Meet Link:", event.hangoutLink ?? "Not ready yet");
//     console.log("Conference Status:", event.conferenceData?.createRequest?.status?.statusCode);
// }

// main().catch((error) => {
//     console.error("Google Meet creation failed:", error.message);
//     process.exitCode = 1;
// });



const {
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI,
    GOOGLE_CALENDAR_REFRESH_TOKEN,
} = process.env;

if (
    !GOOGLE_CALENDAR_CLIENT_ID ||
    !GOOGLE_CALENDAR_CLIENT_SECRET ||
    !GOOGLE_CALENDAR_REDIRECT_URI ||
    !GOOGLE_CALENDAR_REFRESH_TOKEN
) {
    throw new Error("Missing Google Calendar credentials");
}


const auth = new google.auth.OAuth2(
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI
)


auth.setCredentials({
    refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
});

const calender = google.calendar({
    version: "v3",
    auth
})

const start = new Date(Date.now() + 60 * 60 * 1000);
const end = new Date(start.getTime() + 30 * 60 * 1000);


async function main() {
    const response = await calender.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        requestBody: {
            summary: "DermaCare AI - Test Consultation",
            description: "Testing Google Meet Integration",
            start: {
                dateTime: start.toISOString(),
            },
            end: {
                dateTime: end.toISOString(),
            },
            conferenceData: {
                createRequest: {
                    requestId: randomUUID(),
                    conferenceSolutionKey: {
                        type: "hangoutsMeet"
                    }
                }
            }
        }
    });


    const event = response.data;

    console.log("Event ID :", event.id);
    console.log("Meet Link:", event.hangoutLink ?? "Not Ready Yet")
    console.log("Conference Status:", event.conferenceData?.createRequest?.status?.statusCode);



}
main().catch((error) => {
    console.error("Google Meet creation failed:", error.message);
    process.exitCode = 1;
});