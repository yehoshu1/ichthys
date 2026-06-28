"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React rendering errors
 * and display a user-friendly fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });

        // In production, you might want to log this to an error tracking service
        if (process.env.NODE_ENV === "production") {
            // Example: Sentry.captureException(error);
        }
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="w-full max-w-lg">
                        <CardHeader className="text-center">
                            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <CardTitle className="text-2xl">Something went wrong</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground text-center">
                                We apologize for the inconvenience. An unexpected error has occurred.
                            </p>

                            {process.env.NODE_ENV === "development" && this.state.error && (
                                <ScrollArea className="max-h-48">
                                    <div className="bg-muted p-4 rounded-lg">
                                    <p className="font-mono text-sm text-red-600 dark:text-red-400">
                                        {this.state.error.toString()}
                                    </p>
                                    {this.state.errorInfo && (
                                        <pre className="font-mono text-xs text-muted-foreground mt-2">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                    </div>
                                </ScrollArea>
                            )}

                            <div className="flex gap-2 justify-center">
                                <Button
                                    onClick={this.handleReset}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    Try Again
                                </Button>
                                <Button
                                    onClick={this.handleReload}
                                    className="gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Reload Page
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
