import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingPage } from "@/components/LandingPage";

function requestBaseUrl() {
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? (host?.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host ?? "localhost:3000"}`;
}

export function generateMetadata(): Metadata {
  const baseUrl = requestBaseUrl();
  const socialImageUrl = new URL("/og.png", baseUrl).toString();

  return {
    title: "BKFC Affiliate Gym Program",
    description:
      "Official intake for combat sports gyms applying to join the BKFC Affiliate Gym Network.",
    openGraph: {
      title: "BKFC Gym Network",
      description: "Official BKFC Affiliate Gym Program.",
      type: "website",
      url: baseUrl,
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: "BKFC Gym Network — Official Affiliate Program",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "BKFC Gym Network",
      description: "Official BKFC Affiliate Gym Program.",
      images: [socialImageUrl],
    },
  };
}

export default function HomePage() {
  return <LandingPage />;
}
