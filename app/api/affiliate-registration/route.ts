import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function getFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractCountry(cityCountry: string) {
  const parts = cityCountry
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts[parts.length - 1] : cityCountry.trim();
}

function getRegionFromCountry(country: string) {
  const normalizedCountry = country.trim().toLowerCase();

  const europe = [
    "bulgaria",
    "spain",
    "italy",
    "serbia",
    "poland",
    "germany",
    "france",
    "netherlands",
    "belgium",
    "romania",
    "greece",
    "hungary",
    "croatia",
    "montenegro",
    "albania",
    "north macedonia",
    "austria",
    "switzerland",
    "united kingdom",
    "ireland",
    "portugal",
  ];

  const mena = [
    "uae",
    "united arab emirates",
    "saudi arabia",
    "qatar",
    "kuwait",
    "bahrain",
    "oman",
    "egypt",
    "morocco",
    "tunisia",
    "jordan",
    "lebanon",
  ];

  const latam = [
    "mexico",
    "brazil",
    "argentina",
    "colombia",
    "chile",
    "peru",
    "uruguay",
    "paraguay",
    "ecuador",
    "venezuela",
  ];

  const northAmerica = [
    "usa",
    "united states",
    "united states of america",
    "canada",
  ];

  if (europe.includes(normalizedCountry)) return "Europe";
  if (mena.includes(normalizedCountry)) return "MENA";
  if (latam.includes(normalizedCountry)) return "LATAM";
  if (northAmerica.includes(normalizedCountry)) return "North America";

  return "Other";
}

async function uploadFile(file: File, folder: string) {
  const safeName = sanitizeFileName(file.name || "upload");
  const filePath = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("affiliate-applications")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from("affiliate-applications")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

function buildApplicantReceivedEmail({
  contactPerson,
  gymName,
  cityCountry,
  submissionId,
}: {
  contactPerson: string;
  gymName: string;
  cityCountry: string;
  submissionId: string;
}) {
  return `
<body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr>
      <td align="center">

        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#111111;border:1px solid #262626;border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:#c8a45d;padding:14px 24px;">
              <div style="margin:0;color:#000000;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                BKFC Gym Network
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 18px;background:#111111;">
              <div style="display:inline-block;margin:0 0 16px;padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c8a45d;background:#1a1a1a;border:1px solid #3a3324;border-radius:999px;">
                Application Received
              </div>

              <h1 style="margin:0 0 10px;color:#ffffff;font-size:30px;line-height:36px;font-weight:700;">
                Welcome to the process.
              </h1>

              <p style="margin:0;color:#b5b5b5;font-size:16px;line-height:26px;">
                We’re excited to see your interest in joining the BKFC Gym Network.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Dear ${escapeHtml(contactPerson)},
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Thank you for submitting your application for <strong style="color:#ffffff;">${escapeHtml(gymName)}</strong>.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                We’re excited to see your interest in joining the BKFC Gym Network and becoming part of the international development pathway we are building with selected combat sports gyms around the world.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Your application has been received successfully, and our team will now begin reviewing your gym profile, location, training environment, and role inside the BKFC Gym Network.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#171717;border:1px solid #2a2a2a;border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin:0 0 14px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
                      Application Summary
                    </div>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Status:</strong> Submitted
                    </p>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Gym:</strong> ${escapeHtml(gymName)}
                    </p>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Location:</strong> ${escapeHtml(cityCountry)}
                    </p>

                    <p style="margin:0;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Application ID:</strong> ${escapeHtml(submissionId)}
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#141414;border-left:3px solid #c8a45d;border-radius:10px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin:0 0 14px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
                      What happens next
                    </div>

                   

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:24px;">
                      If we need any additional information, photos, fighter details, or clarification, we will contact you directly.
                    </p>

                    <p style="margin:0;color:#d4d4d4;font-size:14px;line-height:24px;">
                      If approved, we will guide you through the next steps, including membership activation, starter kit preparation, and official affiliate onboarding.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                There is no need to submit another application. Your gym is now in the review pipeline.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Thank you again for your interest in the BKFC Gym Network.
              </p>

              <p style="margin:28px 0 0;color:#ffffff;font-size:15px;font-weight:600;">
                BKFC International Development
              </p>

            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #262626;padding:20px 32px 28px;">
              <div style="margin:0 0 6px;color:#c8a45d;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                BKFC Gym Network
              </div>

              <p style="margin:0;color:#8a8a8a;font-size:12px;line-height:20px;">
                Official communication from BKFC International Development.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
`;
}

function buildApplicationUnderReviewEmail({
  contactPerson,
  gymName,
  cityCountry,
  submissionId,
}: {
  contactPerson: string;
  gymName: string;
  cityCountry: string;
  submissionId: string;
}) {
  return `
<body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr>
      <td align="center">

        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#111111;border:1px solid #262626;border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:#c8a45d;padding:14px 24px;">
              <div style="margin:0;color:#000000;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                BKFC Gym Network - Application Update
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 18px;background:#111111;">
              <div style="display:inline-block;margin:0 0 16px;padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c8a45d;background:#1a1a1a;border:1px solid #3a3324;border-radius:999px;">
                In Progress
              </div>

              <h1 style="margin:0 0 10px;color:#ffffff;font-size:30px;line-height:36px;font-weight:700;">
                Your application is moving forward.
              </h1>

              <p style="margin:0;color:#b5b5b5;font-size:16px;line-height:26px;">
                Our team has started checking the submitted details.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
               Dear ${escapeHtml(contactPerson)},
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Thank you again for your application for <strong style="color:#ffffff;">${escapeHtml(gymName)}</strong>.
             </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Our team has started checking the submitted details and will contact you directly if anything else is needed.
            </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#171717;border:1px solid #2a2a2a;border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin:0 0 14px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
                      Review Summary
                    </div>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Status:</strong> In Progress
                    </p>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Gym:</strong> ${escapeHtml(gymName)}
                    </p>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Location:</strong> ${escapeHtml(cityCountry)}
                    </p>

                    <p style="margin:0;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Application ID:</strong> ${escapeHtml(submissionId)}
                    </p>
                  </td>
                </tr>
              </table>

               <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#141414;border-left:3px solid #c8a45d;border-radius:10px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin:0 0 14px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
                      Current Step
                    </div>

                    <p style="margin:0;color:#d4d4d4;font-size:14px;line-height:24px;">
                      At this stage, no action is required from your side. If anything else is needed, our team will contact you directly.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                If your application is approved, we will guide you through the next steps for membership activation, starter kit preparation, and official affiliate onboarding.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Thank you for your patience while we complete the review.
              </p>

              <p style="margin:28px 0 0;color:#ffffff;font-size:15px;font-weight:600;">
                BKFC International Development
              </p>

            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #262626;padding:20px 32px 28px;">
              <div style="margin:0 0 6px;color:#c8a45d;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                BKFC Gym Network
              </div>

              <p style="margin:0;color:#8a8a8a;font-size:12px;line-height:20px;">
                Official communication from BKFC International Development.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
`;
}

async function sendApplicationEmails({
  submissionId,
  submittedAt,
  gymName,
  cityCountry,
  country,
  region,
  contactPerson,
  email,
  phone,
  websiteInstagram,
  disciplinesOffered,
  promoVideoLink,
}: {
  submissionId: string;
  submittedAt: string;
  gymName: string;
  cityCountry: string;
  country: string;
  region: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  disciplinesOffered: string;
  promoVideoLink: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("Missing RESEND_API_KEY. Email notifications skipped.");
    return;
  }

 const internalEmail = await resend.emails.send({
  from: "BKFC Affiliate Intake <onboarding@resend.dev>",
  to: "kkaloyanov@lgsports-ent.com",
  subject: `New BKFC Affiliate Gym Application: ${gymName}`,
  html: `
<div style="margin:0;background:#000000 !important;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#ffffff !important;">
  <div style="max-width:680px;margin:0 auto;background:#0b0b0b !important;border:1px solid #2a2a2a;">

    <div style="text-align:center;padding:32px 24px 22px;border-bottom:3px solid #ffffff;">
      <div style="font-size:54px;font-weight:900;letter-spacing:2px;color:#ffffff !important;">
        BKFC
      </div>
      <div style="margin-top:10px;font-size:12px;letter-spacing:4px;color:#f2c94c !important;text-transform:uppercase;">
        Affiliate Gym Network
      </div>
    </div>

    <div style="padding:12px 30px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505 !important;border:1px solid #333333;">
    <tr>
      <td style="padding:14px;color:#f2c94c !important;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
        Application ID
      </td>
      <td style="padding:14px;color:#ffffff !important;font-size:13px;text-align:right;">
        ${submissionId}
      </td>
    </tr>

    <tr>
      <td style="padding:14px;color:#f2c94c !important;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
        Submitted
      </td>
      <td style="padding:14px;color:#ffffff !important;font-size:13px;text-align:right;">
        ${submittedAt}
      </td>
    </tr>
  </table>
</div>

    <div style="padding:28px 30px 18px;">
      <div style="font-size:13px;letter-spacing:3px;color:#f2c94c !important;text-transform:uppercase;margin-bottom:10px;">
        New Application Received
      </div>

      <h1 style="margin:0 0 12px;font-size:30px;color:#ffffff !important;text-transform:uppercase;">
        ${escapeHtml(gymName)}
      </h1>

      <p style="margin:0;font-size:16px;color:#d6d6d6 !important;">
        A new gym has submitted an application for review by BKFC International Development.
      </p>
    </div>

    <div style="padding:10px 30px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#151515 !important;border:1px solid #333333;">
        <tr>
          <td style="padding:18px;border-bottom:1px solid #333333;color:#f2c94c !important;font-size:13px;letter-spacing:2px;text-transform:uppercase;">
            Application Details
          </td>
        </tr>

        <tr>
          <td style="padding:18px;color:#ffffff !important;">
            <p><strong>Gym:</strong> ${escapeHtml(gymName)}</p>
            <p><strong>Location:</strong> ${escapeHtml(cityCountry)}</p>
            <p><strong>Country:</strong> ${escapeHtml(country)}</p>
            <p><strong>Region:</strong> ${escapeHtml(region)}</p>
            <p><strong>Contact:</strong> ${escapeHtml(contactPerson)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p><strong>Website / Social:</strong> ${escapeHtml(websiteInstagram)}</p>
            <p><strong>Promo Video Link:</strong> ${
              promoVideoLink ? escapeHtml(promoVideoLink) : "Not provided"
            }</p>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:18px 30px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#101010 !important;border:1px solid #333333;">
        <tr>
          <td style="padding:18px;border-bottom:1px solid #333333;color:#f2c94c !important;font-size:13px;letter-spacing:2px;text-transform:uppercase;">
            Disciplines Offered
          </td>
        </tr>

        <tr>
          <td style="padding:18px;font-size:15px;color:#ffffff !important;">
            ${escapeHtml(disciplinesOffered).replace(/\n/g, "<br />")}
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:24px 30px 30px;text-align:center;">
      <div style="display:inline-block;border:2px solid #ffffff;padding:13px 24px;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffffff !important;">
        Review in Supabase
      </div>

      <p style="margin:20px 0 0;font-size:13px;color:#999999 !important;">
        Full uploaded assets are stored in Supabase Storage under the affiliate application record.
      </p>
    </div>

  </div>
</div>
  `,
});

console.log("Internal email response:", internalEmail);


const applicantEmail = await resend.emails.send({
  from: "BKFC Affiliate Intake <onboarding@resend.dev>",
  to: "kkaloyanov@lgsports-ent.com", // TEMP for testing. Later change to: email
  subject: "BKFC Gym Network — Application Received",
  html: buildApplicantReceivedEmail({
    contactPerson,
    gymName,
    cityCountry,
    submissionId,
  }),
});

console.log("Applicant email response:", applicantEmail);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const gymName = getString(formData, "gymName");
    const cityCountry = getString(formData, "cityCountry");
    const country = extractCountry(cityCountry);
    const region = getRegionFromCountry(country);
    const contactPerson = getString(formData, "contactPerson");
    const email = getString(formData, "email");
    const phone = getString(formData, "phone");
    const websiteInstagram = getString(formData, "websiteInstagram");
    const disciplinesOffered = getString(formData, "disciplinesOffered");
    const promoVideoLink = getString(formData, "promoVideoLink");

    const reviewConsent = formData.get("reviewConsent") === "on";
    const followUpConsent = formData.get("followUpConsent") === "on";

    const logoUpload = getFile(formData, "logoUpload");
    const gymPhotos = getFiles(formData, "gymPhotos");
    const fighterListUpload = getFile(formData, "fighterListUpload");

    if (
      !gymName ||
      !cityCountry ||
      !contactPerson ||
      !email ||
      !phone ||
      !websiteInstagram ||
      !disciplinesOffered ||
      !reviewConsent ||
      !logoUpload ||
      gymPhotos.length === 0
    ) {
      return NextResponse.json(
        { message: "Please complete all required fields before submitting." },
        { status: 400 }
      );
    }

    const submissionId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    const folder = `${slugify(gymName)}-${submissionId}`;

    const logoUrl = await uploadFile(logoUpload, `${folder}/logo`);

    const gymPhotoUrls = await Promise.all(
      gymPhotos.map((file) => uploadFile(file, `${folder}/gym-photos`))
    );

    const fighterListUrl = fighterListUpload
      ? await uploadFile(fighterListUpload, `${folder}/fighter-list`)
      : null;

    

    const { error } = await supabase.from("affiliate_applications").insert({
      id: submissionId,
      gym_name: gymName,
      city_country: cityCountry,
      country,
      region,
      contact_person: contactPerson,
      email,
      phone,
      website_instagram: websiteInstagram,
      disciplines_offered: disciplinesOffered,
      logo_url: logoUrl,
      gym_photo_urls: gymPhotoUrls,
      fighter_list_url: fighterListUrl,
      promo_video_link: promoVideoLink || null,
      review_consent: reviewConsent,
      follow_up_consent: followUpConsent,
      status: "new",
      review_stage: "submitted",
    });

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    try {
  await sendApplicationEmails({
    submissionId,
    submittedAt,
    gymName,
    cityCountry,
    country,
    region,
    contactPerson,
    email,
    phone,
    websiteInstagram,
    disciplinesOffered,
    promoVideoLink,
  });
} catch (emailError) {
  console.error("Email notification failed", emailError);
}

    return NextResponse.json({
      message:
        "Registration submitted successfully. Your materials have been received for review by BKFC International Development. Applications are typically reviewed within 5–10 business days. If additional information is required during evaluation, you will be contacted at the email provided.",
    });
  } catch (error) {
    console.error("Affiliate registration submission failed", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The registration could not be processed at this time. Please try again.",
      },
      { status: 500 }
    );
  }
}