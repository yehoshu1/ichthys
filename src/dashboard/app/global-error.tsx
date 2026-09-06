"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to error monitoring service
        console.error("Global error:", error);
    }, [error]);

    return (
        <html lang="en">
            <body>
                <div className="flex min-h-screen items-center justify-center bg-background p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                            </div>
                            <CardTitle className="text-xl">Application Error</CardTitle>
                            <CardDescription>
                                A critical error occurred. Please try again or contact support if the problem persists.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error.message && (
                                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                                    <code className="break-all">{error.message}</code>
                                </div>
                            )}
                            {error.digest && (
                                <div className="text-center text-xs text-muted-foreground">
                                    Error ID: {error.digest}
                                </div>
                            )}
                            <Button onClick={reset} className="w-full">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </body>
        </html>
    );
}
