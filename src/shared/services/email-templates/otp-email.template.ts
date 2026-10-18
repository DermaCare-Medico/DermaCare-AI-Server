
interface OtpEmailTemplateParams {
  code: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
  expiresInMinutes: number;
}

const CONTENT = {
  EMAIL_VERIFICATION: {
    heading: "Verify your email",
    message:
      "Welcome to DermaCare AI! Use the verification code below to verify your email address and continue creating your account.",
    title: "Email verification code",
  },
  PASSWORD_RESET: {
    heading: "Reset your password",
    message:
      "We received a request to reset your DermaCare AI password. Use the code below to continue.",
    title: "Password reset code",
  },
} as const;

export const otpEmailTemplate = ({
  code,
  purpose,
  expiresInMinutes,
}: OtpEmailTemplateParams): string => {
  const content = CONTENT[purpose];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${content.heading} | DermaCare AI</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#f1f5f9;
  font-family:Arial,Helvetica,sans-serif;
  color:#183b4e;
  text-align:center;
">

  <table
  role="presentation"
  width="560"
  align="center"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    width:100%;
    max-width:560px;
    margin:0 auto;
    background-color:#ffffff;
    border-radius:16px;
    overflow:hidden;
    text-align:center;
  "
>
    <tr>
      <td align="center" style="text-align:center;">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:560px;
            background-color:#ffffff;
            border-radius:16px;
            overflow:hidden;
            text-align:center;
          "
        >

          <!-- Brand Header -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 24px;
                background-color:#e8f7f4;
                border-bottom:1px solid #d8eee9;
                text-align:center;
              "
            >
              <div style="
                font-size:25px;
                line-height:1.4;
                font-weight:700;
                color:#116b65;
                text-align:center;
              ">
                DermaCare AI
              </div>

              <div style="
                margin-top:6px;
                font-size:12px;
                line-height:1.6;
                color:#557b7a;
                text-align:center;
              ">
                Your skin health companion
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td
              align="center"
              style="
                padding:36px 24px 28px;
                text-align:center;
              "
            >
              <p style="
                margin:0 0 12px;
                font-size:12px;
                line-height:1.6;
                font-weight:700;
                letter-spacing:1.5px;
                text-transform:uppercase;
                color:#16877e;
                text-align:center;
              ">
                ${content.title}
              </p>

              <h1 style="
                margin:0 0 16px;
                font-size:27px;
                line-height:1.3;
                font-weight:700;
                color:#183b4e;
                text-align:center;
              ">
                ${content.heading}
              </h1>

              <p style="
                margin:0 0 28px;
                font-size:15px;
                line-height:1.8;
                color:#526777;
                text-align:center;
              ">
                ${content.message}
              </p>

              <!-- OTP Code -->
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="width:100%;text-align:center;"
              >
                <tr>
                  <td
                    align="center"
                    style="
                      padding:24px 12px;
                      background-color:#effaf7;
                      border:1px solid #d4eee7;
                      border-radius:12px;
                      text-align:center;
                    "
                  >
                    <p style="
                      margin:0 0 12px;
                      font-size:12px;
                      line-height:1.6;
                      font-weight:600;
                      letter-spacing:1px;
                      color:#557b7a;
                      text-align:center;
                    ">
                      YOUR ONE-TIME PASSWORD
                    </p>

                    <div style="
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:32px;
                      line-height:1.5;
                      font-weight:700;
                      letter-spacing:7px;
                      color:#116b65;
                      text-align:center;
                      overflow-wrap:anywhere;
                    ">
                      ${code}
                    </div>

                    <p style="
                      margin:12px 0 0;
                      font-size:12px;
                      line-height:1.6;
                      color:#557b7a;
                      text-align:center;
                    ">
                      Expires in ${expiresInMinutes} minutes
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Message -->
              <p style="
                margin:26px 0 0;
                font-size:13px;
                line-height:1.8;
                color:#526777;
                text-align:center;
              ">
                For your security, never share this code with anyone.
                DermaCare AI will never ask you to share your OTP.
              </p>

              <p style="
                margin:16px 0 0;
                font-size:13px;
                line-height:1.8;
                color:#526777;
                text-align:center;
              ">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              style="
                padding:22px 24px;
                background-color:#f8fafc;
                border-top:1px solid #e2e8f0;
                text-align:center;
              "
            >
              <p style="
                margin:0;
                font-size:12px;
                line-height:1.7;
                color:#64748b;
                text-align:center;
              ">
                This is an automated message. Please do not reply to this email.
              </p>

              <p style="
                margin:8px 0 0;
                font-size:12px;
                line-height:1.6;
                color:#94a3b8;
                text-align:center;
              ">
                &copy; DermaCare AI
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};
