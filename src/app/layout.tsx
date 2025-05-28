import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ustaz",
  description: "AI-powered educational tool for mastering complex subjects through personalized content and interactive learning",
  keywords: ["AI", "education", "learning", "tutoring", "mathematics", "study"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="font-sans antialiased bg-gray-50"
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
      >
        {children}
      </body>
    </html>
  );
}
