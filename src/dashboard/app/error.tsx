'use client';

import { useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-destructive/20 shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-xl">Something went wrong!</CardTitle>
                    <CardDescription>
                        An unexpected error occurred in the dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground bg-muted/50 p-4 m-4 rounded-md overflow-auto max-h-32 font-mono">
                    {error.message || "Unknown error occurred"}
                    {error.digest && <div className="mt-2 text-xs opacity-70">Error ID: {error.digest}</div>}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button onClick={() => reset()} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Try again
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
