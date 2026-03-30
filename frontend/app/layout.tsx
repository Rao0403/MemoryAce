import type { Metadata } from "next";
import { Sora, Space_Grotesk } from "next/font/google";

import "./globals.css";

const headline = Sora({ subsets: ["latin"], variable: "--font-headline" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Brain Games Lab",
  description: "Aesthetic human benchmark style brain games",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${headline.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}