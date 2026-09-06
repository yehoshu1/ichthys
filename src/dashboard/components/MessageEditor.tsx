"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Eye, Code, HelpCircle } from "lucide-react";
import { ColorPicker } from "./ui/color-picker";
import { useTooltipsEnabled } from "./TooltipContext";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";

export interface EmbedData {
    title?: string;
    description?: string;
    url?: string;
    color?: string; // Hex color code
    timestamp?: boolean;
    footer?: { text: string; icon_url?: string };
    thumbnail?: { url: string };
    image?: { url: string };
    author?: { name: string; url?: string; icon_url?: string };
}

interface MessageEditorProps {
    content: string;
    embed?: EmbedData;
    embedEnabled: boolean;
    onChange: (content: string, embedEnabled: boolean, embed: EmbedData) => void;
    variables?: string[]; // List of available variables for user reference
    placeholder?: string;
}

export function MessageEditor({
    content,
    embed = {},
    embedEnabled,
    onChange,
    variables = ["{user}", "{username}", "{server}", "{memberCount}"],
    placeholder = "Enter your message here..."
}: MessageEditorProps) {
    const [activeTab, setActiveTab] = useState("edit");

    const updateEmbed = (key: keyof EmbedData, value: any) => {
        onChange(content, embedEnabled, { ...embed, [key]: value });
    };

    const updateEmbedNested = (parent: "footer" | "image" | "thumbnail" | "author", key: string, value: string) => {
        const current = embed[parent] || {};
        onChange(content, embedEnabled, { ...embed, [parent]: { ...current, [key]: value } });
    };

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="edit"><Code className="mr-2 h-4 w-4" /> Edit</TabsTrigger>
                    <TabsTrigger value="preview"><Eye className="mr-2 h-4 w-4" /> Live Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-4 mt-4">
                    {/* Plain Text Content */}
                    <div className="space-y-2">
                        <Label>Message Content</Label>
                        <Textarea
                            value={content}
                            onChange={(e) => onChange(e.target.value, embedEnabled, embed)}
                            placeholder={placeholder}
                            className="min-h-[100px] font-mono text-sm"
                        />
                        <VariableHelp variables={variables} />
                    </div>

                    {/* Embed Toggle */}
                    <div className="flex items-center space-x-2 rounded-lg border p-3 bg-muted/20">
                        <Switch
                            id="embed-toggle"
                            checked={embedEnabled}
                            onCheckedChange={(checked) => onChange(content, checked, embed)}
                        />
                        <div className="flex-1">
                            <Label htmlFor="embed-toggle" className="font-medium">Enable Embed</Label>
                            <p className="text-xs text-muted-foreground">Send a rich card instead of just plain text.</p>
                        </div>
                    </div>

                    {/* Embed Fields */}
                    {embedEnabled && (
                        <div className="space-y-4 border-l-2 border-primary/20 pl-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Input
                                        value={embed.title || ""}
                                        onChange={(e) => updateEmbed("title", e.target.value)}
                                        placeholder="Embed Title"
                                    />
                                </div>
                                <ColorPicker
                                    label="Color"
                                    value={embed.color || "#5865F2"}
                                    onChange={(value) => updateEmbed("color", value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={embed.description || ""}
                                    onChange={(e) => updateEmbed("description", e.target.value)}
                                    placeholder="Body of the embed..."
                                    className="min-h-[80px]"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Thumbnail URL</Label>
                                    <Input
                                        value={embed.thumbnail?.url || ""}
                                        onChange={(e) => updateEmbedNested("thumbnail", "url", e.target.value)}
                                        placeholder="https://example.com/image.png"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Image URL (Big)</Label>
                                    <Input
                                        value={embed.image?.url || ""}
                                        onChange={(e) => updateEmbedNested("image", "url", e.target.value)}
                                        placeholder="https://example.com/banner.png"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Footer Text</Label>
                                    <Input
                                        value={embed.footer?.text || ""}
                                        onChange={(e) => updateEmbedNested("footer", "text", e.target.value)}
                                        placeholder="Footer text"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Author Name</Label>
                                    <Input
                                        value={embed.author?.name || ""}
                                        onChange={(e) => updateEmbedNested("author", "name", e.target.value)}
                                        placeholder="Author Name"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                    <DiscordMessagePreview
                        content={content}
                        embed={embedEnabled ? embed : undefined}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Variable explanations map
const variableExplanations: Record<string, string> = {
    "{user}": "Mentions the user (@username)",
    "{username}": "The user's display name",
    "{server}": "Your server name",
    "{memberCount}": "Total number of members in the server",
    "{level}": "The user's current level",
    "{xp}": "The user's total XP",
    "{user.mention}": "Mentions the user (@username)",
    "{user.username}": "The user's username",
    "{user.displayname}": "The user's display name",
    "{user.nickname}": "The user's nickname in this server",
    "{user.id}": "The user's Discord ID",
    "{age}": "The user's age (if birth year is set)",
    "{server.name}": "Your server name",
    "{server.id}": "Your server's Discord ID",
    "{server.members}": "Total member count",
    "{boostCount}": "Total number of server boosts",
    "{boostLevel}": "Current server boost level (1-3)",
};

function VariableHelp({ variables }: { variables: string[] }) {
    const tooltipsEnabled = useTooltipsEnabled();

    if (!tooltipsEnabled) {
        return (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Variables:</span>
                {variables.map(v => (
                    <code key={v} className="bg-muted px-1 rounded">{v}</code>
                ))}
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={100}>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                <span className="flex items-center gap-1">
                    Variables:
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                                <HelpCircle className="h-3 w-3" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p>Click on variables to copy them. Hover over each variable to see what it does.</p>
                        </TooltipContent>
                    </Tooltip>
                </span>
                {variables.map(v => {
                    const explanation = variableExplanations[v] || "Custom variable";
                    return (
                        <Tooltip key={v}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(v)}
                                    className="bg-muted px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                                >
                                    {v}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{explanation}</p>
                                <p className="text-xs text-muted-foreground mt-1">Click to copy</p>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}

function DiscordMessagePreview({ content, embed }: { content: string; embed?: EmbedData }) {
    // Mock user for preview
    const botName = "ΙΧΘΥΣ";
    const today = new Date();
    const timeString = `Today at ${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')} ${today.getHours() >= 12 ? 'PM' : 'AM'}`;

    return (
        <div className="bg-[#313338] text-gray-100 p-4 rounded-md font-sans text-[16px] leading-[1.375rem] shadow-inner font-normal">
            <div className="flex gap-4">
                {/* Bot Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0 mt-0.5">
                    BOT
                </div>

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white hover:underline cursor-pointer">{botName}</span>
                        <span className="bg-[#5865F2] text-white text-[10px] px-1 rounded-[3px] h-[15px] flex items-center leading-none">BOT</span>
                        <span className="text-xs text-[#949BA4]">{timeString}</span>
                    </div>

                    {/* Content */}
                    {content && (
                        <div className="whitespace-pre-wrap mb-2 text-[#dbdee1]">
                            {content}
                        </div>
                    )}

                    {/* Embed */}
                    {embed && (
                        <div
                            className="bg-[#2B2D31] rounded flex max-w-[520px] grid-cols-[auto_1fr] overflow-hidden"
                            style={{ borderLeft: `4px solid ${embed.color || '#1E1F22'}` }}
                        >
                            <div className="p-4 grid gap-2 w-full">
                                {embed.author?.name && (
                                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                                        {embed.author.icon_url && <img src={embed.author.icon_url} className="w-6 h-6 rounded-full" />}
                                        <span>{embed.author.name}</span>
                                    </div>
                                )}

                                {embed.title && (
                                    <div className="font-semibold text-white truncate text-base hover:underline cursor-pointer">
                                        {embed.title}
                                    </div>
                                )}

                                {embed.description && (
                                    <div className="text-sm text-[#dbdee1] whitespace-pre-wrap">
                                        {embed.description}
                                    </div>
                                )}

                                {embed.image?.url && (
                                    <div className="mt-2 rounded overflow-hidden">
                                        <img src={embed.image.url} className="max-w-full h-auto max-h-[300px] object-cover rounded" alt="Embed Image" />
                                    </div>
                                )}

                                {embed.footer?.text && (
                                    <div className="mt-1 flex items-center gap-2 text-xs text-[#949BA4]">
                                        {embed.footer.icon_url && <img src={embed.footer.icon_url} className="w-5 h-5 rounded-full" />}
                                        <span>{embed.footer.text}</span>
                                    </div>
                                )}
                            </div>

                            {embed.thumbnail?.url && (
                                <div className="p-4 pl-0">
                                    <img src={embed.thumbnail.url} className="w-[80px] h-[80px] rounded object-cover" alt="Thumbnail" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
