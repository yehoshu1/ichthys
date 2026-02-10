'use client';

import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Lock, Home } from 'lucide-react';

export default function ForbiddenError() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-border/50 shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-xl">Access Denied</CardTitle>
                    <CardDescription>
                        You don't have permission to access this resource.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Error code: 403
                    </p>
                    <div className="pt-4">
                        <Link href="/" passHref>
                            <Button className="gap-2">
                                <Home className="h-4 w-4" />
                                Return to Home
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
