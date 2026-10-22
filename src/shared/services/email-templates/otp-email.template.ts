export interface OtpEmailTemplateParams {
  code: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
  expiresInMinutes: number;
  userName?: string;
}

const CONTENT = {
  EMAIL_VERIFICATION: {
    heading: "Verify Your Email",
    message:
      "We received a request to verify your email address. Use the one-time code below to continue securely.",
    codeLabel: "YOUR VERIFICATION CODE",
  },
  PASSWORD_RESET: {
    heading: "Reset Your Password",
    message:
      "We received a request to reset your password. Use the one-time code below to create a new password and get back to your account.",
    codeLabel: "YOUR ONE-TIME CODE · TO RESET YOUR PASSWORD",
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function otpEmailTemplate({
  code,
  purpose,
  expiresInMinutes,
  userName,
}: OtpEmailTemplateParams): string {
  const content = CONTENT[purpose];
  const isPasswordReset = purpose === "PASSWORD_RESET";

  const safeCode = escapeHtml(code);
  const safeName = escapeHtml(userName?.trim() || "there");
  const safeHeading = escapeHtml(content.heading);
  const safeMessage = escapeHtml(content.message);
  const safeCodeLabel = escapeHtml(content.codeLabel);
  const safeExpiry = escapeHtml(String(expiresInMinutes));
  const year = new Date().getFullYear();

  const colors = {
    page: "#F0FAF6",
    outerCard: "#DFF7EF",
    border: "#91E5D3",
    brand: "#07574F",
    brandDark: "#064E48",
    mint: "#65D9BD",
    text: "#07574F",
    muted: "#527D76",
    otpBackground: "#07574F",
    warningBackground: "#FFF1F2",
    warningBorder: "#FFBFC7",
    warningAccent: "#E52545",
    warningText: "#B4233D",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeHeading} | DermaCare AI</title>
</head>

<body style="
  margin:0;
  padding:0;
  width:100%;
  background-color:${colors.page};
  font-family:Arial,Helvetica,sans-serif;
  -webkit-text-size-adjust:100%;
">

  <!-- Hidden email preview -->
  <div style="
    display:none;
    font-size:1px;
    color:${colors.page};
    line-height:1px;
    max-height:0;
    max-width:0;
    opacity:0;
    overflow:hidden;
    mso-hide:all;
  ">
    Your DermaCare AI ${
      isPasswordReset ? "password reset" : "email verification"
    } code is ready.
  </div>

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="width:100%;background-color:${colors.page};"
  >
    <tr>
      <td align="center" style="padding:28px 12px;">

        <!-- OUTER CARD: NO SHADOW -->
        <table
          role="presentation"
          class="outer-card"
          width="620"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            width:100%;
            max-width:620px;
            background-color:${colors.outerCard};
            border:0;
            border-radius:22px;
          "
        >
          <tr>
            <td style="padding:10px;">

              <!-- INNER CARD -->
              <table
                role="presentation"
                class="email-wrapper"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  background-color:#FFFFFF;
                  border:1px solid ${colors.border};
                  border-radius:17px;
                "
              >

                <!-- BRAND HEADER -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:23px 16px 19px;
                      background-color:${colors.brand};
                      border-radius:16px 16px 0 0;
                      text-align:center;
                    "
                  >
                    <p style="
                      margin:0;
                      color:#FFFFFF;
                      font-size:28px;
                      line-height:34px;
                      font-weight:700;
                      letter-spacing:-0.7px;
                    ">
                      DermaCare
                      <span style="color:${colors.mint};">AI</span>
                    </p>

                    <p style="
                      margin:4px 0 0;
                      color:#D3F4EA;
                      font-size:10px;
                      line-height:15px;
                      font-weight:600;
                      letter-spacing:1.8px;
                    ">
                      YOUR SKIN HEALTH COMPANION
                    </p>
                  </td>
                </tr>

                <!-- MAIN CONTENT -->
                <tr>
                  <td
                    class="email-card"
                    align="center"
                    style="
                      padding:20px 32px 23px;
                      background-color:#FFFFFF;
                      text-align:center;
                    "
                  >

                    <!-- LOCK LOGO -->
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      align="center"
                    >
                      <tr>
                        <td
                          align="center"
                          valign="middle"
                          width="68"
                          height="68"
                          style="
                            width:68px;
                            height:68px;
                            background-color:#D5F8EF;
                            border:2px solid ${colors.border};
                            border-radius:50%;
                            text-align:center;
                            vertical-align:middle;
                          "
                        >
                          <span style="
                            font-family:Arial,sans-serif;
                            font-size:34px;
                            line-height:68px;
                          ">&#128274;</span>
                        </td>
                      </tr>
                    </table>

                    <!-- PERSONALIZED GREETING -->
                    <h2 style="
                      margin:9px 0 4px;
                      color:${colors.text};
                      font-size:25px;
                      line-height:31px;
                      font-weight:700;
                      letter-spacing:-0.5px;
                    ">
                      Hi
                      <span style="color:#16A88B;">${safeName}</span>,
                      <span style="font-size:22px;">&#128075;</span>
                    </h2>

                    <!-- HEADING -->
                    <h1
                      class="email-heading"
                      style="
                        margin:0 0 9px;
                        color:${colors.brandDark};
                        font-size:25px;
                        line-height:32px;
                        font-weight:700;
                        letter-spacing:-0.4px;
                      "
                    >
                      ${safeHeading}
                    </h1>

                    <!-- DESCRIPTION: WIDER, LESS SPACING -->
                    <p class="description" style="
                      margin:0 auto 19px;
                      max-width:460px;
                      color:${colors.muted};
                      font-size:13px;
                      line-height:19px;
                      font-weight:400;
                      text-align:center;
                    ">
                      ${safeMessage}
                    </p>

                    <!-- OTP CARD -->
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:${colors.otpBackground};
                        border:2px solid ${colors.mint};
                        border-radius:15px;
                      "
                    >
                      <tr>
                        <td
                          align="center"
                          style="
                            padding:19px 10px 20px;
                            text-align:center;
                          "
                        >
                          <p style="
                            margin:0 0 10px;
                            color:#E7FFF7;
                            font-size:10px;
                            line-height:15px;
                            font-weight:700;
                            letter-spacing:1px;
                          ">
                            ${safeCodeLabel}
                          </p>

                          <p
                            class="otp-code"
                            style="
                              margin:0;
                              color:${colors.mint};
                              font-family:Arial,Helvetica,sans-serif;
                              font-size:40px;
                              line-height:48px;
                              font-weight:700;
                              letter-spacing:8px;
                              font-variant-numeric:tabular-nums;
                              overflow-wrap:anywhere;
                            "
                          >${safeCode}</p>

                          <p style="
                            margin:9px 0 0;
                            color:#D3F4EA;
                            font-size:12px;
                            line-height:18px;
                          ">
                            This code expires in
                            <strong style="color:#FFFFFF;">
                              ${safeExpiry} minutes
                            </strong>.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- EXPIRY REMINDER -->
                   <p
  style="
    margin:9px 0 0;;
    color: #049e70;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
  "
>
  ⏱️ Please use your code before it expires.
</p>

                    <!-- RED SECURITY WARNING -->
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        width:100%;
                        margin-top:15px;
                        background-color:${colors.warningBackground};
                        border:1px solid ${colors.warningBorder};
                        border-radius:11px;
                      "
                    >
                      <tr>
                        <td
                          width="4"
                          style="
                            width:4px;
                            background-color:${colors.warningAccent};
                            font-size:1px;
                          "
                        >&nbsp;</td>

                        <td
                          align="left"
                          style="
                            padding:12px 13px;
                            text-align:left;
                          "
                        >
                          <p style="
                            margin:0 0 4px;
                            color:${colors.warningText};
                            font-size:12px;
                            line-height:18px;
                            font-weight:700;
                          ">
                            &#9888; Security Warning
                          </p>

                          <p style="
                            margin:0;
                            color:#823A4B;
                            font-size:11px;
                            line-height:17px;
                          ">
                            Never share this code with anyone.
                            DermaCare AI will never ask you to disclose
                            your one-time code to another person.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- IGNORE MESSAGE -->
                    <p style="
                      margin:13px auto 0;
                      max-width:460px;
                      color:${colors.muted};
                      font-size:11px;
                      line-height:17px;
                    ">
                      ${
                        isPasswordReset
                          ? "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged."
                          : "If you did not request this verification code, you can safely ignore this email."
                      }
                    </p>

                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:15px 14px 16px;
                      background-color:#EFFAF6;
                      border-top:1px solid #D8F0E8;
                      border-radius:0 0 16px 16px;
                      text-align:center;
                    "
                  >
                    <p style="
                      margin:0 0 4px;
                      color:${colors.brand};
                      font-size:13px;
                      line-height:18px;
                      font-weight:700;
                    ">
                      DermaCare
                      <span style="color:#16A88B;">AI</span>
                    </p>

                    <p style="
                      margin:0;
                      color:#648F87;
                      font-size:10px;
                      line-height:15px;
                    ">
                      Automated security email &middot; Please do not reply
                    </p>

                    <p style="
                      margin:5px 0 0;
                      color:#83A49C;
                      font-size:10px;
                      line-height:15px;
                    ">
                      &copy; ${year} DermaCare AI
                    </p>
                  </td>
                </tr>

              </table>
              <!-- END INNER CARD -->

            </td>
          </tr>
        </table>
        <!-- END OUTER CARD -->

      </td>
    </tr>
  </table>

  <!-- RESPONSIVE STYLES -->
  <style>
    @media only screen and (max-width:480px) {
      .outer-card {
        border-radius:15px !important;
      }

      .email-wrapper {
        border-radius:12px !important;
      }

      .email-card {
        padding:19px 15px 20px !important;
      }

      .email-heading {
        font-size:22px !important;
        line-height:28px !important;
      }

      .description {
        font-size:12px !important;
        line-height:18px !important;
      }

      .otp-code {
        font-size:30px !important;
        line-height:40px !important;
        letter-spacing:5px !important;
      }
    }
  </style>

</body>
</html>`;
}
