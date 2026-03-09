import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { partnerId, movieTitle, initiatorName } = await req.json()

    if (!partnerId || !movieTitle || !initiatorName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create Supabase client with service_role key (server-side access)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Get partner's email from auth.users
    const { data: emailData } = await supabaseAdmin.rpc("get_user_email", {
      p_user_id: partnerId,
    })
    const partnerEmail = emailData

    if (!partnerEmail) {
      return new Response(
        JSON.stringify({ error: "Partner email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get partner's display name
    const { data: nameData } = await supabaseAdmin.rpc("get_user_display_name", {
      p_user_id: partnerId,
    })
    const partnerName = nameData || "amigo"

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured")
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const emailHtml = buildEmailTemplate(initiatorName, movieTitle, partnerName)

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VOSE <onboarding@resend.dev>",
        to: [partnerEmail],
        subject: `🎬 ${initiatorName} quiere ir al cine contigo`,
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

// ─── Email Template ──────────────────────────────────────────────────────────

function buildEmailTemplate(
  initiatorName: string,
  movieTitle: string,
  partnerName: string
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Match en VOSE</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;">

          <!-- Logo VOSE -->
          <tr>
            <td align="center" style="padding:0 0 32px;">
              <span style="font-size:42px;font-weight:200;letter-spacing:14px;color:#ffffff;">VOSE</span>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.15),transparent);"></div>
            </td>
          </tr>

          <!-- Match icon -->
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <span style="font-size:48px;">🎬</span>
            </td>
          </tr>

          <!-- Main heading -->
          <tr>
            <td align="center" style="padding:0 0 12px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">
                Match con ${initiatorName}!
              </h1>
            </td>
          </tr>

          <!-- Body text -->
          <tr>
            <td align="center" style="padding:0 0 32px;">
              <p style="margin:0;font-size:16px;color:rgba(255,255,255,0.55);line-height:1.6;">
                ${initiatorName} tambien quiere ver<br>
                <strong style="color:#ffffff;font-size:18px;">"${movieTitle}"</strong>
              </p>
            </td>
          </tr>

          <!-- CTA text -->
          <tr>
            <td align="center" style="padding:0 0 32px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.35);line-height:1.6;">
                Abre VOSE para organizar el plan juntos
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
            <td align="center" style="padding:0;">
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
