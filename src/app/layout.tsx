import type { Metadata } from "next";
import "./globals.css";
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";
import { GoogleOneTap } from "@/components/auth/GoogleOneTap";

export const metadata: Metadata = {
  title: "Formia | AI-Powered Form Builder",
  description: "Create premium, Araform-style forms with ease using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <SessionProviderWrapper>
          <GoogleOneTap />
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
