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

async function sendApplicationEmails({
  gymName,
  cityCountry,
  contactPerson,
  email,
  phone,
  websiteInstagram,
  disciplinesOffered,
}: {
  gymName: string;
  cityCountry: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  disciplinesOffered: string;
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
    <h2>New BKFC Affiliate Gym Application</h2>
    <p><strong>Gym:</strong> ${gymName}</p>
    <p><strong>Location:</strong> ${cityCountry}</p>
    <p><strong>Contact:</strong> ${contactPerson}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Website / Social:</strong> ${websiteInstagram}</p>
    <p><strong>Disciplines:</strong></p>
    <p>${disciplinesOffered}</p>
    <hr />
    <p>Review the full submission inside Supabase.</p>
  `,
});

console.log("Internal email response:", internalEmail);


const applicantEmail = await resend.emails.send({
  from: "BKFC Affiliate Intake <onboarding@resend.dev>",
  to: "kkaloyanov@lgsports-ent.com", // TEMP for testing. Later change to: email
  subject: "BKFC Affiliate Application Received",
  html: `
    <body style="margin:0;background:#000000;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
        <tr>
          <td align="center">

            <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#000000;">
              
              <tr>
                <td align="center" style="padding:34px 20px 22px;">
                  <div style="font-size:56px;font-weight:900;letter-spacing:2px;color:#ffffff;line-height:1;">
                    BKFC
                  </div>
                  <div style="font-size:12px;letter-spacing:5px;color:#f2c94c;text-transform:uppercase;margin-top:10px;">
                    Bare Knuckle Fighting Championship
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 24px 24px;">
                  <div style="border:1px solid #333333;background:#111111;padding:30px;text-align:center;">
                    <div style="font-size:13px;letter-spacing:4px;color:#f2c94c;text-transform:uppercase;">
                      Official Intake Confirmation
                    </div>
                    <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.1;color:#ffffff;text-transform:uppercase;">
                      Affiliate Gym Network
                    </h1>
                    <div style="font-size:18px;color:#d8d8d8;">
                      Application Received
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 12px;">
                  <p style="font-size:17px;line-height:1.6;color:#ffffff;margin:0 0 16px;">
                    Thank you for submitting your gym to the official BKFC Affiliate Gym Network.
                  </p>
                  <p style="font-size:16px;line-height:1.6;color:#d6d6d6;margin:0;">
                    Your application has been registered and will be reviewed by BKFC International Development.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#151515;border:1px solid #333333;">
                    <tr>
                      <td style="padding:20px;">
                        <div style="font-size:13px;letter-spacing:3px;color:#f2c94c;text-transform:uppercase;margin-bottom:12px;">
                          Application Summary
                        </div>
                        <p style="margin:0 0 8px;font-size:16px;color:#ffffff;">
                          <strong>Gym:</strong> ${gymName}
                        </p>
                        <p style="margin:0;font-size:16px;color:#ffffff;">
                          <strong>Location:</strong> ${cityCountry}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:6px 32px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border:1px solid #333333;">
                    <tr>
                      <td style="padding:20px;">
                        <div style="font-size:13px;letter-spacing:3px;color:#f2c94c;text-transform:uppercase;margin-bottom:12px;">
                          Next Step
                        </div>
                        <p style="margin:0;font-size:15px;line-height:1.6;color:#d6d6d6;">
                          Our team will evaluate your facility, coaching structure, athlete development environment, and regional alignment. If additional information is required, you will be contacted directly.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:12px 32px 34px;">
                  <div style="display:inline-block;border:2px solid #ffffff;padding:14px 28px;font-size:15px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
                    Review Pending
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 24px;">
                  <hr style="border:0;border-top:2px solid #ffffff;">
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px;">
                  <div style="background:#202020;padding:18px;">
                    <span style="font-size:14px;color:#ffffff;margin:0 10px;">BKFC International Development</span>
                  </div>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:8px 32px 40px;">
                  <p style="font-size:13px;line-height:1.5;color:#ffffff;margin:0;">
                    Copyright © 2026 Bare Knuckle Fighting Championship, LLC. All rights reserved.
                  </p>
                  <p style="font-size:12px;line-height:1.5;color:#888888;margin:10px 0 0;">
                    You are receiving this email because you submitted a BKFC Affiliate Gym application.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
  `,
});

console.log("Applicant email response:", applicantEmail);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const gymName = getString(formData, "gymName");
    const cityCountry = getString(formData, "cityCountry");
    const contactPerson = getString(formData, "contactPerson");
    const email = getString(formData, "email");
    const phone = getString(formData, "phone");
    const websiteInstagram = getString(formData, "websiteInstagram");
    const disciplinesOffered = getString(formData, "disciplinesOffered");

    const reviewConsent = formData.get("reviewConsent") === "on";
    const followUpConsent = formData.get("followUpConsent") === "on";

    const logoUpload = getFile(formData, "logoUpload");
    const gymPhotos = getFiles(formData, "gymPhotos");
    const fighterListUpload = getFile(formData, "fighterListUpload");
    const promoVideoUpload = getFile(formData, "promoVideoUpload");

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
    const folder = `${slugify(gymName)}-${submissionId}`;

    const logoUrl = await uploadFile(logoUpload, `${folder}/logo`);

    const gymPhotoUrls = await Promise.all(
      gymPhotos.map((file) => uploadFile(file, `${folder}/gym-photos`))
    );

    const fighterListUrl = fighterListUpload
      ? await uploadFile(fighterListUpload, `${folder}/fighter-list`)
      : null;

    const promoVideoUrl = promoVideoUpload
      ? await uploadFile(promoVideoUpload, `${folder}/promo-video`)
      : null;

    const { error } = await supabase.from("affiliate_applications").insert({
      id: submissionId,
      gym_name: gymName,
      city_country: cityCountry,
      contact_person: contactPerson,
      email,
      phone,
      website_instagram: websiteInstagram,
      disciplines_offered: disciplinesOffered,
      logo_url: logoUrl,
      gym_photo_urls: gymPhotoUrls,
      fighter_list_url: fighterListUrl,
      promo_video_url: promoVideoUrl,
      review_consent: reviewConsent,
      follow_up_consent: followUpConsent,
      status: "new",
    });

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    try {
  await sendApplicationEmails({
    gymName,
    cityCountry,
    contactPerson,
    email,
    phone,
    websiteInstagram,
    disciplinesOffered,
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