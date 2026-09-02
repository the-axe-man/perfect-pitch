import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shot Caller",
  description: "Call live MLB plate appearance outcomes and score your reads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>{children}</body>
    </html>
  );
}
