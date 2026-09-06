import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";

export default function Loading() {
    return (
        <div className="space-y-6">
            {/* Page Header Skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-10 w-[250px]" />
                <Skeleton className="h-4 w-[400px]" />
            </div>

            {/* Cards Skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-[120px]" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-[80px]" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-[120px]" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-[80px]" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-[120px]" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-[80px]" />
                    </CardContent>
                </Card>
            </div>

            {/* Content Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-[200px]" />
                    <Skeleton className="h-4 w-[300px]" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>

            {/* Loading Indicator */}
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </div>
    );
}
