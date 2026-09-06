"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Copy, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { DateTimePicker } from "../../components/ui/datetime-picker";
import ThemeToggle from "../../components/ThemeToggle";

const FORMATS = [
    { id: "default", suffix: "", name: "Default", format: "November 28, 2018 9:01 AM" },
    { id: "short-time", suffix: ":t", name: "Short Time", format: "9:01 AM" },
    { id: "long-time", suffix: ":T", name: "Long Time", format: "9:01:00 AM" },
    { id: "short-date", suffix: ":d", name: "Short Date", format: "11/28/2018" },
    { id: "long-date", suffix: ":D", name: "Long Date", format: "November 28, 2018" },
    { id: "short-datetime", suffix: ":f", name: "Short Date/Time", format: "November 28, 2018 9:01 AM" },
    { id: "long-datetime", suffix: ":F", name: "Long Date/Time", format: "Wednesday, November 28, 2018 9:01 AM" },
    { id: "relative", suffix: ":R", name: "Relative Time", format: "3 years ago" },
];

export default function TimestampPage() {
    const [date, setDate] = useState<Date | null>(new Date());
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Make sure we update the preview whenever the date changes
    // Next.js hydration issues might arise if we use new Date() initially without a client-side check, 
    // but the DatePicker is a client component so it's fine.
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!mounted) {
        return <div className="min-h-screen bg-background" />;
    }

    const unix = date ? Math.floor(date.getTime() / 1000) : Math.floor(Date.now() / 1000);

    return (
        <main className="min-h-screen px-6 py-10 bg-background">
            <div className="mx-auto flex max-w-4xl justify-between items-center mb-8">
                <Link href="/">
                    <Button variant="ghost" className="gap-2 -ml-4">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Button>
                </Link>
                <ThemeToggle />
            </div>

            <div className="mx-auto max-w-4xl space-y-8">
                <div className="space-y-2">
                    <h1 className="text-4xl font-semibold tracking-tight flex items-center gap-3">
                        <Clock className="h-10 w-10 text-primary" />
                        Discord Timestamp Generator
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Select a date and time to generate timestamp tags for Discord messages. 
                        These timestamps automatically adjust to the viewer's local timezone.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-[300px_1fr] items-start">
                    <Card className="sticky top-10">
                        <CardHeader>
                            <CardTitle>Select Date & Time</CardTitle>
                            <CardDescription>Pick the exact moment you want to share.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <DateTimePicker
                                value={date}
                                onChange={setDate}
                                placeholder="Pick a date and time"
                            />
                            <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => setDate(new Date())}
                            >
                                Reset to Now
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {FORMATS.map((format) => {
                            const tag = `<t:${unix}${format.suffix}>`;
                            const isCopied = copiedId === format.id;

                            // We use Discord's timestamp format for the preview by using JS Intl directly,
                            // or we can just rely on basic formatting to simulate Discord's preview.
                            // For simplicity, we just use a generic format or show what they see.
                            const previewDate = date || new Date();
                            let preview = "";
                            const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
                            
                            switch(format.suffix) {
                                case ":t": preview = previewDate.toLocaleTimeString(undefined, { timeStyle: 'short' }); break;
                                case ":T": preview = previewDate.toLocaleTimeString(undefined, { timeStyle: 'medium' }); break;
                                case ":d": preview = previewDate.toLocaleDateString(undefined, { dateStyle: 'short' }); break;
                                case ":D": preview = previewDate.toLocaleDateString(undefined, { dateStyle: 'long' }); break;
                                case ":f": preview = previewDate.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }); break;
                                case ":F": preview = previewDate.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }); break;
                                case ":R": 
                                    const diff = (previewDate.getTime() - Date.now()) / 1000;
                                    if (Math.abs(diff) < 60) preview = rtf.format(Math.round(diff), 'second');
                                    else if (Math.abs(diff) < 3600) preview = rtf.format(Math.round(diff / 60), 'minute');
                                    else if (Math.abs(diff) < 86400) preview = rtf.format(Math.round(diff / 3600), 'hour');
                                    else if (Math.abs(diff) < 2592000) preview = rtf.format(Math.round(diff / 86400), 'day');
                                    else if (Math.abs(diff) < 31536000) preview = rtf.format(Math.round(diff / 2592000), 'month');
                                    else preview = rtf.format(Math.round(diff / 31536000), 'year');
                                    break;
                                default: preview = previewDate.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }); break;
                            }

                            return (
                                <Card key={format.id} className="overflow-hidden transition-all hover:border-primary/50">
                                    <div className="flex flex-col sm:flex-row sm:items-center">
                                        <div className="flex-1 p-4 border-b sm:border-b-0 sm:border-r bg-muted/20">
                                            <div className="text-sm font-medium mb-1">{format.name}</div>
                                            <div className="font-mono text-sm text-primary tracking-tight bg-primary/10 inline-block px-2 py-0.5 rounded">
                                                {tag}
                                            </div>
                                        </div>
                                        <div className="flex-1 p-4 flex items-center justify-between gap-4">
                                            <div className="text-sm">
                                                <span className="text-muted-foreground mr-2">Preview:</span>
                                                <span className="font-medium bg-secondary/50 px-2 py-1 rounded">{preview}</span>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant={isCopied ? "default" : "secondary"}
                                                className="shrink-0 transition-all w-24"
                                                onClick={() => handleCopy(tag, format.id)}
                                            >
                                                {isCopied ? (
                                                    <><Check className="h-4 w-4 mr-2" /> Copied</>
                                                ) : (
                                                    <><Copy className="h-4 w-4 mr-2" /> Copy</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
        </main>
    );
}
