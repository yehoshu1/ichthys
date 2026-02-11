import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Toaster } from "sonner";
import { TooltipProvider } from "../components/TooltipContext";

const dmSans = DM_Sans({
    subsets: ["latin"],
    variable: "--font-sans",
});
const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-display",
});

export const metadata: Metadata = {
    title: "ΙΧΘΥΣ | Dashboard",
    description: "Manage your Discord server with ease",
};

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    // Theme initialization failed, fall back to system preference
    console.warn('Theme initialization failed:', e);
}
})();
`;

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
                <AuthProvider>
                    <TooltipProvider>
                        <ErrorBoundary>
                            {children}
                            <Toaster richColors theme="system" />
                        </ErrorBoundary>
                    </TooltipProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
