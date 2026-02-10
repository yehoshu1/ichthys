'use client';

import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Home, SearchX, BookOpen, Code } from 'lucide-react';

export default function DocsNotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md border-border/50 shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <SearchX className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-2xl">Documentation Not Found</CardTitle>
                    <CardDescription>
                        The page does not exist or has been moved.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-center">
                    <Link href="/docs" passHref>
                        <Button variant="outline" className="w-full gap-2">
                            <BookOpen className="h-4 w-4" />
                            User Docs
                        </Button>
                    </Link>
                    <Link href="/docs/dev" passHref>
                        <Button variant="outline" className="w-full gap-2">
                            <Code className="h-4 w-4" />
                            Developer Docs
                        </Button>
                    </Link>
                    <Link href="/" passHref>
                        <Button className="w-full gap-2">
                            <Home className="h-4 w-4" />
                            Return to Home
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
