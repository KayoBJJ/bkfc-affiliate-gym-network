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
  to: "kkaloyanov@lgsports-ent.com", // TEMP: change this for testing
  subject: "Your BKFC Affiliate Gym application was received",
  html: `
    <h2>Application received</h2>
    <p>Thank you for submitting your gym for BKFC Affiliate Gym Network review.</p>
    <p>Your materials have been received and will be reviewed by BKFC International Development.</p>
    <p>If additional information is required during evaluation, you will be contacted at the email provided.</p>
    <p><strong>Gym:</strong> ${gymName}</p>
    <p><strong>Location:</strong> ${cityCountry}</p>
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