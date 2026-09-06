'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function InternalError({
    error,
    reset,
}: {
    error?: Error & { digest?: string };
    reset?: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        if (error) {
            console.error('Internal Server Error:', error);
        }
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-destructive/20 shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-xl">Server Error</CardTitle>
                    <CardDescription>
                        Something went wrong on our end. Please try again later.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 m-4">
                    <ScrollArea className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md max-h-32 font-mono">
                        {error?.message || "An internal server error occurred"}
                        {error?.digest && <div className="mt-2 text-xs opacity-70">Error ID: {error.digest}</div>}
                    </ScrollArea>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button onClick={() => reset?.()} className="gap-2 w-full">
                        <RefreshCw className="h-4 w-4" />
                        Try again
                    </Button>
                    <Link href="/" passHref>
                        <Button variant="outline" className="w-full">
                            <Home className="h-4 w-4" />
                            Return to Home
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}