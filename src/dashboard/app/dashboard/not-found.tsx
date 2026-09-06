'use client';

import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Home, SearchX, LayoutDashboard } from 'lucide-react';

export default function DashboardNotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-border/50 shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <SearchX className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-2xl">Dashboard Page Not Found</CardTitle>
                    <CardDescription>
                        The dashboard page you're looking for doesn't exist or has been moved.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Error code: 404
                    </p>
                    <div className="pt-4 space-y-2">
                        <Link href="/dashboard" passHref>
                            <Button variant="outline" className="gap-2 w-full">
                                <LayoutDashboard className="h-4 w-4" />
                                Go to Dashboard
                            </Button>
                        </Link>
                        <Link href="/" passHref>
                            <Button className="gap-2 w-full">
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
