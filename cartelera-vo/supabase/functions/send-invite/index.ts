import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { recipientEmail, inviterName, inviteCode } = await req.json()

    if (!recipientEmail || !inviterName || !inviteCode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: recipientEmail, inviterName, inviteCode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const emailHtml = buildInviteEmail(inviterName, inviteCode)

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VOSE <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `${inviterName} te invita a VOSE`,
        html: emailHtml,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error("Resend error:", resendData)
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Edge function error:", err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

// ─── Invitation Email Template ──────────────────────────────────────────────

function buildInviteEmail(inviterName: string, inviteCode: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Te han invitado a VOSE</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;">

          <!-- Logo VOSE -->
          <tr>
            <td align="center" style="padding:0 0 12px;">
              <span style="font-size:42px;font-weight:200;letter-spacing:14px;color:#ffffff;">VOSE</span>
            </td>
          </tr>

          <!-- Tagline -->
          <tr>
            <td align="center" style="padding:0 0 32px;">
              <span style="font-size:13px;font-style:italic;color:rgba(255,255,255,0.25);letter-spacing:0.02em;">El cine como debe sonar</span>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.15),transparent);"></div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td align="center" style="padding:0 0 8px;">
              <span style="font-size:15px;color:rgba(255,255,255,0.5);">Hola!</span>
            </td>
          </tr>

          <!-- Main heading -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.4;">
                ${inviterName} te invita a unirte a VOSE
              </h1>
            </td>
          </tr>

          <!-- What is VOSE -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;">
                VOSE es una app para cineros de Las Palmas.<br>
                Descubre que pelis en version original<br>
                estan en cartelera y organiza planes<br>
                para ir al cine con tus amigos.
              </p>
            </td>
          </tr>

          <!-- How it works -->
          <tr>
            <td style="padding:0 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;">

                <tr>
                  <td style="padding:20px 20px 14px;">
                    <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.1em;">Como funciona</span>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 20px 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;font-size:20px;">🎬</td>
                        <td style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;padding-bottom:4px;">
                          <strong style="color:#fff;">Desliza pelis</strong> — Pasa las pelis en cartelera VO y marca las que quieres ver
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 20px 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;font-size:20px;">🤝</td>
                        <td style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;padding-bottom:4px;">
                          <strong style="color:#fff;">Conecta con amigos</strong> — Agrega a tus amigos y descubre que pelis coincidis
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 20px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;font-size:20px;">🍿</td>
                        <td style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;padding-bottom:4px;">
                          <strong style="color:#fff;">Haz un plan</strong> — Cuando coincidis, elegid sesion y listo. Al cine!
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Invite code box -->
          <tr>
            <td align="center" style="padding:0 0 12px;">
              <span style="font-size:12px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.08em;">Tu codigo de invitacion</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <div style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 32px;">
                <span style="font-size:28px;font-weight:300;letter-spacing:0.15em;color:#ffffff;">${inviteCode}</span>
              </div>
            </td>
          </tr>

          <!-- Steps to join -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.45);line-height:1.7;">
                <strong style="color:rgba(255,255,255,0.7);">1.</strong> Abre <strong style="color:#fff;">carteleravo.app</strong> en tu movil<br>
                <strong style="color:rgba(255,255,255,0.7);">2.</strong> Introduce el codigo <strong style="color:#fff;">${inviteCode}</strong><br>
                <strong style="color:rgba(255,255,255,0.7);">3.</strong> Entra con tu cuenta de Google<br>
                <strong style="color:rgba(255,255,255,0.7);">4.</strong> Ya estas dentro!
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.08),transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:0 0 8px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.15);">
                Solo para cineros de Las Palmas de Gran Canaria
              </p>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;font-size:13px;font-style:italic;color:rgba(255,255,255,0.2);">
                El cine como debe sonar.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
