"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../../../../components/ui/alert";
import { Download, Upload, FileJson, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleExport = async () => {
        try {
            // Trigger download by waiting for the browser to handle the attachment response
            window.location.href = `/api/guilds/${guildId}/settings/export`;
        } catch (error) {
            console.error("Export failed:", error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImportFile(e.target.files[0]);
            setImportStatus(null);
        }
    };

    const handleImport = async () => {
        if (!importFile) return;

        if (!confirm("WARNING: Importing a configuration will OVERWRITE all current settings, triggers, templates, and actions. This cannot be undone. Are you sure?")) {
            return;
        }

        setIsImporting(true);
        setImportStatus(null);

        try {
            const fileContent = await importFile.text();
            const json = JSON.parse(fileContent);

            const res = await fetch(`/api/guilds/${guildId}/settings/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(json)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Import failed");
            }

            setImportStatus({ type: 'success', message: "Configuration imported successfully! Please refresh the page to see changes." });
            setImportFile(null);
            // reset file input?

        } catch (error: any) {
            console.error("Import error:", error);
            setImportStatus({ type: 'error', message: error.message || "Failed to import configuration." });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage your server configuration and backups.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Export Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Export Configuration
                        </CardTitle>
                        <CardDescription>
                            Download a backup of all your current settings, message templates, and automations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md bg-muted p-4 flex items-center gap-4">
                            <div className="h-10 w-10 flex items-center justify-center rounded bg-background border">
                                <FileJson className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="text-sm">
                                <p className="font-medium">guild-config.json</p>
                                <p className="text-xs text-muted-foreground">JSON format, readable and portable.</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleExport} variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            Download Backup
                        </Button>
                    </CardFooter>
                </Card>

                {/* Import Card */}
                <Card className="border-destructive/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <Upload className="h-5 w-5" />
                            Import Configuration
                        </CardTitle>
                        <CardDescription>
                            Restore settings from a previous backup.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Warning</AlertTitle>
                            <AlertDescription>
                                Importing will <strong>permanently overwrite</strong> your current configuration, including all templates, triggers, and actions.
                            </AlertDescription>
                        </Alert>

                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="config-file">Configuration File</Label>
                            <Input
                                id="config-file"
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                disabled={isImporting}
                            />
                        </div>

                        {importStatus && (
                            <Alert variant={importStatus.type === 'success' ? 'default' : 'destructive'} className={importStatus.type === 'success' ? "border-green-500 text-green-600" : ""}>
                                {importStatus.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                                <AlertTitle>{importStatus.type === 'success' ? "Success" : "Error"}</AlertTitle>
                                <AlertDescription>
                                    {importStatus.message}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handleImport}
                            disabled={!importFile || isImporting}
                            variant="destructive"
                            className="w-full"
                        >
                            {isImporting ? "Importing..." : "Restore Configuration"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
