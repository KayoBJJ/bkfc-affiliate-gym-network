import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const displayFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "BKFC Affiliate Gym Program",
  description: "Official intake form for gyms applying to join the BKFC Affiliate Gym Network."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={displayFont.variable}>{children}</body>
    </html>
  );
}
