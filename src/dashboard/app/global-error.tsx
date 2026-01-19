'use client';

import { useEffect } from 'react';
import { Button } from '../components/ui/button';
import { AlertCircle } from 'lucide-react';

// global-error must include html and body tags
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Global Error:', error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold">Critical System Error</h2>
                    <p className="mb-8 text-muted-foreground text-center max-w-md">
                        A critical error occurred that prevented the application from loading.
                    </p>
                    <p className="mb-8 p-4 bg-muted rounded font-mono text-sm max-w-md overflow-hidden text-ellipsis">
                        {error.message}
                    </p>
                    <Button onClick={() => reset()} variant="default">
                        Reload Application
                    </Button>
                </div>
            </body>
        </html>
    );
}
