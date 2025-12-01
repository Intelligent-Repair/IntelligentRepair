import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "IntelligentRepair | חוויית שירות חכמה",
  description:
    "IntelligentRepair - פלטפורמת שירות ותחזוקה חכמה למוסכים מודרניים.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
