import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SubmissionRecord = {
  id: string;
  submittedAt: string;
  gymName: string;
  cityCountry: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  disciplinesOffered: string;
  reviewConsent: boolean;
  followUpConsent: boolean;
  uploads: {
    logoUpload: StoredFile | null;
    gymPhotos: StoredFile[];
    fighterListUpload: StoredFile | null;
    promoVideoUpload: StoredFile | null;
  };
};

type StoredFile = {
  originalName: string;
  storedName: string;
  relativePath: string;
  mimeType: string;
  size: number;
};

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");
const uploadsDir = path.join(projectRoot, "uploads");
const submissionsFile = path.join(dataDir, "submissions.json");

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

async function persistFile(
  file: File,
  submissionId: string,
  bucket: string
): Promise<StoredFile> {
  const bucketDir = path.join(uploadsDir, submissionId, bucket);
  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name || "upload");
  const storedName = `${timestamp}-${safeName}`;
  const targetPath = path.join(bucketDir, storedName);

  await mkdir(bucketDir, { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(targetPath, Buffer.from(arrayBuffer));

  return {
    originalName: file.name,
    storedName,
    relativePath: path.relative(projectRoot, targetPath),
    mimeType: file.type || "application/octet-stream",
    size: file.size
  };
}

async function readExistingSubmissions() {
  try {
    const content = await readFile(submissionsFile, "utf8");
    const parsed = JSON.parse(content) as SubmissionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
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

  try {
    await mkdir(dataDir, { recursive: true });
    await mkdir(uploadsDir, { recursive: true });

    const storedLogo = await persistFile(logoUpload, submissionId, "logo");
    const storedGymPhotos = await Promise.all(
      gymPhotos.map((file) => persistFile(file, submissionId, "photos"))
    );
    const storedFighterList = fighterListUpload
      ? await persistFile(fighterListUpload, submissionId, "fighter-list")
      : null;
    const storedPromoVideo = promoVideoUpload
      ? await persistFile(promoVideoUpload, submissionId, "promo-video")
      : null;

    const record: SubmissionRecord = {
      id: submissionId,
      submittedAt: new Date().toISOString(),
      gymName,
      cityCountry,
      contactPerson,
      email,
      phone,
      websiteInstagram,
      disciplinesOffered,
      reviewConsent,
      followUpConsent,
      uploads: {
        logoUpload: storedLogo,
        gymPhotos: storedGymPhotos,
        fighterListUpload: storedFighterList,
        promoVideoUpload: storedPromoVideo
      }
    };

    const submissions = await readExistingSubmissions();
    submissions.push(record);

    const tempFile = `${submissionsFile}.tmp`;
    await writeFile(tempFile, JSON.stringify(submissions, null, 2), "utf8");
    await rename(tempFile, submissionsFile);

    // Replace local persistence here with cloud object storage or a database.
    // Trigger email or CRM workflows from this point if needed.
    return NextResponse.json({
      message:
        "Registration submitted successfully. Your materials have been received for review by BKFC International Development. Applications are typically reviewed within 5–10 business days. If additional information is required during evaluation, you will be contacted at the email provided."
    });
  } catch (error) {
    console.error("Affiliate registration submission failed", error);

    return NextResponse.json(
      {
        message:
          "The registration could not be processed at this time. Please try again."
      },
      { status: 500 }
    );
  }
}
