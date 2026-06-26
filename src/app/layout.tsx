import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { activeSchoolConfig, getThemeColors } from "@/config/whiteLabel.config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: `%s | ${activeSchoolConfig.name}`,
    default: `${activeSchoolConfig.name} - Hub`,
  },
  description: activeSchoolConfig.motto,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const colors = getThemeColors(activeSchoolConfig.themePersonality);
  
  const dynamicStyles = `
    :root {
      --color-primary: ${colors.primary};
      --color-primary-hover: ${colors.primaryHover};
      --color-secondary: ${colors.secondary};
      --color-secondary-hover: ${colors.secondaryHover};
      --color-accent: ${colors.accent};
      --color-success: ${colors.success};
      --color-warning: ${colors.warning};
      --color-danger: ${colors.danger};
      --color-surface-dense: ${colors.surfaceDense};
    }
  `;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
