import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { SearchX, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <SearchX className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-xl">Page Not Found</CardTitle>
                    <CardDescription>
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Link href="/guilds" className="flex-1">
                            <Button variant="outline" className="w-full">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Servers
                            </Button>
                        </Link>
                        <Link href="/" className="flex-1">
                            <Button className="w-full">
                                <Home className="mr-2 h-4 w-4" />
                                Go Home
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
