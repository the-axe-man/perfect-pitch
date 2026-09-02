import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfect Pitch",
  description: "Predict the next pitch type and location from real MLB games.",
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
