import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EXATA Financial Dashboard",
  description:
    "Dashboard pengelolaan Bukti Kas Masuk (BKM) dan Bukti Kas Keluar (BKK) — Exata Group",
  icons: {
    icon: "/bkk-logo.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
