import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const hyundaiSans = localFont({
  src: [
    {
      path: "../public/fonts/HyundaiSansHeadOffice-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/HyundaiSansHeadOffice-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/HyundaiSansHeadOffice-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/HyundaiSansHeadOffice-Light.woff2",
      weight: "300",
      style: "normal",
    },
  ],
  variable: "--font-hyundai-sans",
  display: "swap",
  fallback: ["var(--font-montserrat)", "system-ui", "-apple-system", "sans-serif"],
});

export const metadata: Metadata = {
  title: "KIA - Simulasi Kredit",
  description: "Simulasi kredit pembiayaan kendaraan KIA dengan layanan profesional",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${hyundaiSans.variable} ${montserrat.variable} antialiased`}>
        <div className="min-h-screen bg-white text-[var(--foreground)]">
          {children}
        </div>
      </body>
    </html>
  );
}
