"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, ArrowLeft, Key, ServerCrash } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

function AuthSignInContent() {
    const searchParams = useSearchParams();
    const error = searchParams?.get("error");

    let errorTitle = "Authentication Error";
    let errorMessage = "An unknown error occurred during authentication.";
    let ErrorIcon = AlertCircle;

    if (error === "OAuthCallback") {
        errorTitle = "OAuth Configuration Error";
        errorMessage = "Discord rejected the login attempt.";
        ErrorIcon = Key;
    } else if (error === "AccessDenied") {
        errorTitle = "Access Denied";
        errorMessage = "You do not have permission to sign in.";
    } else if (error === "Configuration") {
        errorTitle = "Server Configuration Error";
        errorMessage = "There is a problem with the server configuration. Please check your environment variables.";
        ErrorIcon = ServerCrash;
    }

    const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/callback/discord` : 'http://localhost:4002/api/auth/callback/discord';

    return (
        <Card className="z-10 w-full max-w-md border-primary/20 shadow-2xl bg-background/60 backdrop-blur-xl">
            <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-4">
                    {error ? (
                        <div className="p-3 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
                            <ErrorIcon className="w-8 h-8" />
                        </div>
                    ) : (
                        <div className="p-3 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                            <Key className="w-8 h-8" />
                        </div>
                    )}
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                    {error ? errorTitle : "Sign In"}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm px-2">
                    {error ? "Something went wrong while trying to sign you in." : "Sign in to access your dashboard"}
                </CardDescription>
            </CardHeader>
            
            <CardContent>
                {error ? (
                    <>
                        <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-sm leading-relaxed text-secondary-foreground font-medium">
                            {errorMessage}
                        </div>
                        
                        {error === "OAuthCallback" && (
                            <div className="mt-6 text-sm text-muted-foreground space-y-3">
                                <p className="font-semibold text-foreground/90">How to fix this issue:</p>
                                <ol className="list-decimal list-inside space-y-2 ml-1">
                                    <li><strong>Clear your browser cookies</strong> for this site (or try opening in an Incognito window). A "state mismatch" error usually means your browser has stale OAuth cookies.</li>
                                    <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Discord Developer Portal</a></li>
                                    <li>Open your application and navigate to <strong>OAuth2</strong></li>
                                    <li>Ensure the following exact Redirect URI is added:</li>
                                    <div className="mt-3 p-3 rounded-md bg-black/40 border border-border/50 font-mono text-xs sm:text-sm text-primary/90 break-all select-all flex items-center justify-between group">
                                        <code>
                                            {redirectUri}
                                        </code>
                                    </div>
                                </ol>
                            </div>
                        )}
                        <div className="mt-6 flex justify-center">
                            <Button variant="default" size="lg" className="w-full gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}>
                                Try Again with Discord
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col space-y-4">
                        <Button variant="default" size="lg" className="w-full gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}>
                            Sign In with Discord
                        </Button>
                    </div>
                )}
            </CardContent>
            
            <CardFooter className="flex justify-center pt-2 pb-6 border-t border-border/50 mt-4">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="gap-2 mt-4 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-4 h-4" />
                        Return to Home
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
}

export default function AuthSignInPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20 pointer-events-none" />
            
            {/* Ambient glowing effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

            <Suspense fallback={<div className="z-10 flex items-center justify-center p-8 bg-background/60 backdrop-blur-xl rounded-xl border border-primary/20 text-muted-foreground font-medium">Loading...</div>}>
                <AuthSignInContent />
            </Suspense>
        </div>
    );
}
