import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Toaster } from "sonner";

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
  } catch (e) {}
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
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
                <AuthProvider>
                    <ErrorBoundary>
                        {children}
                        <Toaster richColors theme="system" />
                    </ErrorBoundary>
                </AuthProvider>
            </body>
        </html>
    );
}
