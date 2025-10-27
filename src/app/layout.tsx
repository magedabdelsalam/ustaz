import type { Metadata } from "next";
import "./globals.css";
import { ErrorProvider } from "@/components/ErrorProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ustaz - AI-Powered Learning Platform",
  description: "An intelligent tutoring system powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorProvider>
          {children}
          {/* Add Sonner toast notifications */}
          <Toaster richColors position="top-right" />
        </ErrorProvider>
      </body>
    </html>
  );
}
