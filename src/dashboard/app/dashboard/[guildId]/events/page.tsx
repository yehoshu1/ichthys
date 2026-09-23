"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { Input } from "../../../../components/ui/input";
import {
    Card,
    CardHeader,
    CardContent,
    CardTitle,
    CardDescription,
    CardFooter,
} from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "../../../../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../../components/ui/select";
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    Plus,
    MoreVertical,
    Trash,
    Edit,
    Copy,
    CheckCircle,
    XCircle,
    HelpCircle,
    CalendarDays,
    Repeat,
    Palette,
    ImageIcon,
} from "lucide-react";
import { ChannelSelect, RoleSelect, VoiceChannelSelect } from "../../../../components/DiscordSelectors";
import { useDiscordData } from "../../../../components/useDiscordData";
import { toast } from "sonner";
import { Badge } from "../../../../components/ui/badge";
import { Textarea } from "../../../../components/ui/textarea";
import { format } from "date-fns";
import { LabelWithTooltip, HelperText } from "../../../../components/HelpTooltip";
import { DateTimePicker, DatePicker } from "../../../../components/ui/datetime-picker";
import { RoleMultiSelect } from "../../../../components/DiscordSelectors";
import EventCalendar from "../../../../components/EventCalendar";
import { FadeInStagger, FadeInItem } from "../../../../components/MotionWrapper";

function formatTimezone(tz: string): string {
    try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts();
        const offset = parts.find(p => p.type === 'timeZoneName')?.value;
        if (offset) {
            return `${tz} (${offset.replace('GMT', 'UTC')})`;
        }
    } catch {
        // ignore
    }
    return tz;
}

// Types
interface Event {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    locationChannelId: string | null;
    imageUrl: string | null;
    color: string | null;
    startTime: string;
    endTime: string | null;
    durationMinutes: number | null;
    status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
    channelId: string;
    maxAttendees: number | null;
    enableWaitlist: boolean;
    mentionRoleIds: string[] | null;
    mentionOnCreate: boolean;
    mentionOnStart: boolean;
    requiredRoleIds: string[] | null;
    blockedRoleIds: string[] | null;
    attendeeRoleId: string | null;
    repeatFrequency: "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
    repeatUntil: string | null;
    mirrorToDiscord: boolean;
    discordScheduledEventId: string | null;
    createdAt: string;
    rsvpCounts: {
        yes: number;
        no: number;
        maybe: number;
        waitlist: number;
    };
    rsvpUsers: {
        yes: { userId: string; displayName: string; avatarUrl: string | null }[];
        no: { userId: string; displayName: string; avatarUrl: string | null }[];
        maybe: { userId: string; displayName: string; avatarUrl: string | null }[];
        waitlist: { userId: string; displayName: string; avatarUrl: string | null }[];
    };
}

interface EventTemplate {
    id: string;
    name: string;
    description: string | null;
    defaultTitle: string | null;
    defaultDescription: string | null;
    defaultLocation: string | null;
    defaultColor: string | null;
    defaultDurationMinutes: number | null;
}

interface EventFormData {
    title: string;
    description: string;
    location: string;
    locationChannelId: string;
    channelId: string;
    startTime: Date | null;
    endTime: Date | null;
    durationMinutes: number | null;
    color: string;
    maxAttendees: number | null;
    enableWaitlist: boolean;
    mentionRoleIdsOnCreate: string[];
    mentionRoleIdsOnStart: string[];
    mentionOnCreate: boolean;
    mentionOnStart: boolean;
    requiredRoleIds: string[];
    blockedRoleIds: string[];
    attendeeRoleId: string;
    repeatFrequency: "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
    repeatUntil: Date | null;
    mirrorToDiscord: boolean;
    imageUrl: string;
}

const REPEAT_OPTIONS = [
    { value: "NONE", label: "Does not repeat" },
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "BIWEEKLY", label: "Bi-weekly" },
    { value: "MONTHLY", label: "Monthly" },
    { value: "YEARLY", label: "Yearly" },
];

const EVENT_COLORS = [
    { value: "#5865F2", label: "Blurple", class: "bg-[#5865F2]" },
    { value: "#EB459E", label: "Fuchsia", class: "bg-[#EB459E]" },
    { value: "#3BA55D", label: "Green", class: "bg-[#3BA55D]" },
    { value: "#FAA61A", label: "Yellow", class: "bg-[#FAA61A]" },
    { value: "#ED4245", label: "Red", class: "bg-[#ED4245]" },
    { value: "#1ABC9C", label: "Teal", class: "bg-[#1ABC9C]" },
    { value: "#E91E63", label: "Pink", class: "bg-[#E91E63]" },
    { value: "#9B59B6", label: "Purple", class: "bg-[#9B59B6]" },
    { value: "#3498DB", label: "Blue", class: "bg-[#3498DB]" },
    { value: "#E67E22", label: "Orange", class: "bg-[#E67E22]" },
];

const EVENT_TABS = ["calendar", "upcoming", "past", "templates", "settings"] as const;
type EventTab = (typeof EVENT_TABS)[number];

export default function EventsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: EventTab =
        requestedTab && EVENT_TABS.includes(requestedTab as EventTab)
            ? (requestedTab as EventTab)
            : "calendar";
    const [activeTab, setActiveTab] = useState<EventTab>(resolvedTab);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <CalendarDays className="h-8 w-8 text-indigo-500" />
                    Events
                </h1>
                <p className="text-muted-foreground">
                    Create and manage server events with RSVP tracking.
                </p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as EventTab)}
                className="space-y-4"
            >
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="calendar">Calendar</TabsTrigger>
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="past">Past Events</TabsTrigger>
                        <TabsTrigger value="templates">Templates</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    {(activeTab === "calendar" || activeTab === "upcoming") && <CreateEventButton guildId={guildId} onSuccess={() => setRefreshKey(k => k + 1)} />}
                </div>

                <TabsContent value="calendar" className="space-y-4">
                    <CalendarTab key={`cal-${refreshKey}`} guildId={guildId} />
                </TabsContent>

                <TabsContent value="upcoming" className="space-y-4">
                    <EventsList key={`up-${refreshKey}`} guildId={guildId} status="upcoming" />
                </TabsContent>

                <TabsContent value="past" className="space-y-4">
                    <EventsList key={`past-${refreshKey}`} guildId={guildId} status="past" />
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                    <EventTemplatesTab guildId={guildId} />
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <EventSettingsTab guildId={guildId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function CreateEventButton({ guildId, onSuccess }: { guildId: string; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                </Button>
            </DialogTrigger>
            <EventDialogShell
                title="Create New Event"
                description="Schedule a new event for your server members."
            >
                <EventForm guildId={guildId} onSuccess={() => { setOpen(false); onSuccess?.(); }} />
            </EventDialogShell>
        </Dialog>
    );
}

function EventDialogShell({
    title,
    description,
    children,
}: {
    title: string;
    description: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6 pr-14">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-6 pb-6 pr-4 pt-5">
                {children}
                </div>
            </div>
        </DialogContent>
    );
}

function EventForm({
    guildId,
    event,
    initialEvent,
    initialDate,
    onSuccess,
}: {
    guildId: string;
    event?: Event;
    initialEvent?: Event;
    initialDate?: Date | null;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const sourceEvent = event || initialEvent;
    const [templateName, setTemplateName] = useState(
        sourceEvent?.title ? `${sourceEvent.title} Template` : ""
    );
    const [formData, setFormData] = useState<EventFormData>({
        title: sourceEvent?.title ? (initialEvent ? `${sourceEvent.title} (Copy)` : sourceEvent.title) : "",
        description: sourceEvent?.description || "",
        location: sourceEvent?.location || "",
        locationChannelId: sourceEvent?.locationChannelId || "",
        channelId: sourceEvent?.channelId || "",
        startTime: sourceEvent?.startTime 
            ? (initialEvent ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date(sourceEvent.startTime)) 
            : (initialDate || null),
        endTime: sourceEvent?.endTime 
            ? (initialEvent ? new Date(new Date(sourceEvent.endTime).getTime() + 24 * 60 * 60 * 1000) : new Date(sourceEvent.endTime)) 
            : null,
        durationMinutes: sourceEvent?.durationMinutes || null,
        color: sourceEvent?.color || "#5865F2",
        maxAttendees: sourceEvent?.maxAttendees || null,
        enableWaitlist: sourceEvent?.enableWaitlist ?? true,
        mentionRoleIdsOnCreate: (sourceEvent?.mentionRoleIds && sourceEvent?.mentionOnCreate) ? sourceEvent.mentionRoleIds : [],
        mentionRoleIdsOnStart: (sourceEvent?.mentionRoleIds && sourceEvent?.mentionOnStart) ? sourceEvent.mentionRoleIds : [],
        mentionOnCreate: sourceEvent?.mentionOnCreate ?? false,
        mentionOnStart: sourceEvent?.mentionOnStart ?? false,
        requiredRoleIds: sourceEvent?.requiredRoleIds || [],
        blockedRoleIds: sourceEvent?.blockedRoleIds || [],
        attendeeRoleId: sourceEvent?.attendeeRoleId || "",
        repeatFrequency: sourceEvent?.repeatFrequency || "NONE",
        repeatUntil: sourceEvent?.repeatUntil ? new Date(sourceEvent.repeatUntil) : null,
        mirrorToDiscord: sourceEvent?.mirrorToDiscord ?? true,
        imageUrl: sourceEvent?.imageUrl || "",
    });

    useEffect(() => {
        fetchTemplates();
        fetchEventSettings();
    }, [guildId]);

    async function fetchTemplates() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/events/templates`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        }
    }

    async function fetchEventSettings() {
        if (event) return;
        try {
            const res = await fetch(`/api/guilds/${guildId}/events/settings`);
            if (!res.ok) return;
            const data = await res.json();
            setFormData((prev) => ({
                ...prev,
                mirrorToDiscord: data.mirrorToDiscordEvents ?? true,
            }));
        } catch (error) {
            console.error("Error fetching event settings:", error);
        }
    }

    function applyTemplate(templateId: string) {
        const template = templates.find((t) => t.id === templateId);
        if (!template) return;

        setFormData((prev) => ({
            ...prev,
            title: template.defaultTitle || prev.title,
            description: template.defaultDescription || prev.description,
            location: template.defaultLocation || prev.location,
            color: template.defaultColor || prev.color,
            durationMinutes: template.defaultDurationMinutes || prev.durationMinutes,
        }));
    }

    function getTemplateDurationMinutes(): number | undefined {
        if (formData.durationMinutes && formData.durationMinutes > 0) {
            return formData.durationMinutes;
        }

        if (formData.startTime && formData.endTime) {
            const minutes = Math.round((formData.endTime.getTime() - formData.startTime.getTime()) / 60000);
            if (minutes > 0) {
                return minutes;
            }
        }

        return undefined;
    }

    async function saveCurrentAsTemplate() {
        const allMentionRoleIds = Array.from(new Set([
            ...(formData.mentionOnCreate ? formData.mentionRoleIdsOnCreate : []),
            ...(formData.mentionOnStart ? formData.mentionRoleIdsOnStart : []),
        ]));

        const templatePayload = {
            name: templateName.trim(),
            defaultTitle: formData.title.trim(),
            defaultDescription: formData.description || undefined,
            defaultLocation: formData.location || undefined,
            defaultColor: formData.color || undefined,
            defaultDurationMinutes: getTemplateDurationMinutes(),
            maxAttendees: formData.maxAttendees || undefined,
            enableWaitlist: formData.enableWaitlist,
            mentionRoleIds: allMentionRoleIds.length > 0 ? allMentionRoleIds : undefined,
            requiredRoleIds: formData.requiredRoleIds.length > 0 ? formData.requiredRoleIds : undefined,
            blockedRoleIds: formData.blockedRoleIds.length > 0 ? formData.blockedRoleIds : undefined,
            attendeeRoleId: formData.attendeeRoleId || undefined,
        };

        const templateRes = await fetch(`/api/guilds/${guildId}/events/templates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(templatePayload),
        });

        if (!templateRes.ok) {
            const templateError = await templateRes.json().catch(() => ({} as { error?: string }));
            throw new Error(templateError.error || "Failed to save template");
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        try {
            // Validate required fields
            if (!(formData.title ?? "").trim()) {
                toast.error("Event title is required");
                setSaving(false);
                return;
            }
            if (!formData.channelId) {
                toast.error("Channel is required");
                setSaving(false);
                return;
            }
            if (!formData.startTime) {
                toast.error("Start time is required");
                setSaving(false);
                return;
            }
            if (saveAsTemplate && !templateName.trim()) {
                toast.error("Template name is required when saving as template");
                setSaving(false);
                return;
            }

            const url = event
                ? `/api/guilds/${guildId}/events/${event.id}`
                : `/api/guilds/${guildId}/events`;
            const method = event ? "PATCH" : "POST";

            // Combine mention role IDs - use union of both sets for backward compatibility
            const allMentionRoleIds = Array.from(new Set([
                ...(formData.mentionOnCreate ? formData.mentionRoleIdsOnCreate : []),
                ...(formData.mentionOnStart ? formData.mentionRoleIdsOnStart : []),
            ]));

            const payload = {
                title: formData.title,
                description: formData.description || undefined,
                location: formData.location || undefined,
                locationChannelId: formData.locationChannelId || undefined,
                channelId: formData.channelId,
                startTime: formData.startTime.toISOString(),
                endTime: formData.endTime?.toISOString() || undefined,
                durationMinutes: formData.durationMinutes || undefined,
                color: formData.color,
                imageUrl: formData.imageUrl || undefined,
                maxAttendees: formData.maxAttendees || undefined,
                enableWaitlist: formData.enableWaitlist,
                mentionRoleIds: allMentionRoleIds.length > 0 ? allMentionRoleIds : undefined,
                mentionOnCreate: formData.mentionOnCreate,
                mentionOnStart: formData.mentionOnStart,
                requiredRoleIds: formData.requiredRoleIds.length > 0 ? formData.requiredRoleIds : undefined,
                blockedRoleIds: formData.blockedRoleIds.length > 0 ? formData.blockedRoleIds : undefined,
                attendeeRoleId: formData.attendeeRoleId || undefined,
                repeatFrequency: formData.repeatFrequency,
                repeatUntil: formData.repeatUntil?.toISOString() || undefined,
                mirrorToDiscord: formData.mirrorToDiscord,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to save event");
                return;
            }

            if (saveAsTemplate) {
                try {
                    setSavingTemplate(true);
                    await saveCurrentAsTemplate();
                    toast.success(event ? "Event updated and template saved" : "Event created and template saved");
                } catch (templateError) {
                    const message = templateError instanceof Error ? templateError.message : "Failed to save template";
                    toast.error(`Event saved, but template was not saved: ${message}`);
                } finally {
                    setSavingTemplate(false);
                }
            } else {
                toast.success(event ? "Event updated" : "Event created");
            }
            onSuccess();
        } catch (error) {
            console.error("Error saving event:", error);
            toast.error("Failed to save event");
        } finally {
            setSaving(false);
        }
    }

    // Calculate end time based on duration
    function updateEndTimeFromDuration(durationMinutes: number | null) {
        if (!durationMinutes || !formData.startTime) return;
        const start = new Date(formData.startTime);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        setFormData((prev) => ({
            ...prev,
            endTime: end,
        }));
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
            {/* Template Selector */}
            {!event && templates.length > 0 && (
                <div className="space-y-3">
                    <Label>Use Template (Optional)</Label>
                    <Select onValueChange={applyTemplate}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                            {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Title */}
            <div className="space-y-2.5">
                <Label htmlFor="title">
                    Event Title <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Weekly Gaming Night"
                    required
                />
            </div>

            {/* Description */}
            <div className="space-y-2.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe your event..."
                    rows={3}
                />
            </div>

            {/* Channel */}
            <div className="space-y-2.5">
                <Label>
                    Channel <span className="text-red-500">*</span>
                </Label>
                <ChannelSelect
                    guildId={guildId}
                    value={formData.channelId}
                    onChange={(value) =>
                        setFormData({ ...formData, channelId: value })
                    }
                    placeholder="Select a channel..."
                />
            </div>

            {/* Time Settings */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                    <Label>
                        Start Time <span className="text-red-500">*</span>
                    </Label>
                    <DateTimePicker
                        value={formData.startTime}
                        onChange={(date) => {
                            setFormData({ ...formData, startTime: date });
                            if (date && formData.durationMinutes) {
                                updateEndTimeFromDuration(formData.durationMinutes);
                            }
                        }}
                        placeholder="Select start date and time"
                    />
                </div>
                <div className="space-y-2.5">
                    <Label>End Time</Label>
                    <DateTimePicker
                        value={formData.endTime}
                        onChange={(date) =>
                            setFormData({ ...formData, endTime: date })
                        }
                        placeholder="Select end date and time"
                        minDate={formData.startTime || undefined}
                        allowClear={true}
                    />
                </div>
            </div>

            {/* Duration Quick Select */}
            <div className="space-y-3">
                <Label>Quick Duration</Label>
                <div className="flex flex-wrap gap-2.5">
                    {[15, 30, 60, 90, 120, 180, 240].map((mins) => (
                        <Button
                            key={mins}
                            type="button"
                            variant={
                                formData.durationMinutes === mins
                                    ? "default"
                                    : "outline"
                            }
                            size="sm"
                            onClick={() => {
                                setFormData({ ...formData, durationMinutes: mins });
                                updateEndTimeFromDuration(mins);
                            }}
                        >
                            {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
                <Label htmlFor="location" className="flex pb-1">
                    <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                    </span>
                </Label>
                <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="e.g., Voice Channel #1 or Zoom link"
                />
            </div>

            <div className="space-y-4">
                <Label className="flex pb-1">
                    <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Voice Channel Location
                    </span>
                </Label>
                <VoiceChannelSelect
                    guildId={guildId}
                    value={formData.locationChannelId}
                    onChange={(value) =>
                        setFormData({ ...formData, locationChannelId: value })
                    }
                    allowNone={true}
                    placeholder="Select a voice/stage channel..."
                />
                <HelperText className="pt-1">
                    If set, mirrored Discord Scheduled Events will use this voice/stage channel as the native location.
                </HelperText>
            </div>

            {/* Event Color */}
            <div className="space-y-4">
                <Label className="flex pb-1">
                    <span className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Event Color
                    </span>
                </Label>
                <div className="flex flex-wrap gap-2.5">
                    {EVENT_COLORS.map((color) => (
                        <button
                            key={color.value}
                            type="button"
                            onClick={() =>
                                setFormData({ ...formData, color: color.value })
                            }
                            className={`w-8 h-8 rounded-full ${color.class} ${formData.color === color.value
                                    ? "ring-2 ring-offset-2 ring-primary"
                                    : ""
                                }`}
                            title={color.label}
                        />
                    ))}
                </div>
            </div>

            {/* Image URL */}
            <div className="space-y-4">
                <Label htmlFor="imageUrl" className="flex pb-1">
                    <span className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Image URL
                    </span>
                </Label>
                <Input
                    id="imageUrl"
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) =>
                        setFormData({ ...formData, imageUrl: e.target.value })
                    }
                    placeholder="https://example.com/image.png"
                />
                <HelperText className="pt-1">
                    Optional image to display on the event embed. Use a direct link to an image file (PNG, JPG, GIF, or WebP).
                </HelperText>
            </div>

            {/* Max Attendees */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="maxAttendees">
                        <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Maximum Attendees
                        </span>
                    </Label>
                    <Switch
                        checked={formData.maxAttendees !== null}
                        onCheckedChange={(checked) =>
                            setFormData({
                                ...formData,
                                maxAttendees: checked ? 10 : null,
                            })
                        }
                    />
                </div>
                {formData.maxAttendees !== null && (
                    <>
                        <Input
                            id="maxAttendees"
                            type="number"
                            min={1}
                            max={1000}
                            value={formData.maxAttendees}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    maxAttendees: parseInt(e.target.value) || 1,
                                })
                            }
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <Switch
                                id="enableWaitlist"
                                checked={formData.enableWaitlist}
                                onCheckedChange={(checked) =>
                                    setFormData({
                                        ...formData,
                                        enableWaitlist: checked,
                                    })
                                }
                            />
                            <Label htmlFor="enableWaitlist" className="cursor-pointer">
                                Enable waitlist when full
                            </Label>
                        </div>
                    </>
                )}
            </div>

            {/* Role Restrictions */}
            <div className="space-y-4 border-t pt-6">
                <Label className="text-base">Role Restrictions</Label>

                <div className="space-y-2.5">
                    <Label>Required Roles (must have one)</Label>
                    <RoleMultiSelect
                        guildId={guildId}
                        values={formData.requiredRoleIds}
                        onChange={(values) =>
                            setFormData({
                                ...formData,
                                requiredRoleIds: values,
                            })
                        }
                        placeholder="No role restriction..."
                    />
                </div>

                <div className="space-y-2.5">
                    <Label>Blocked Roles (cannot join)</Label>
                    <RoleMultiSelect
                        guildId={guildId}
                        values={formData.blockedRoleIds}
                        onChange={(values) =>
                            setFormData({
                                ...formData,
                                blockedRoleIds: values,
                            })
                        }
                        placeholder="No blocked roles..."
                    />
                </div>

                <div className="space-y-2.5">
                    <LabelWithTooltip
                        label="Auto-assign Role"
                        tooltip="Role to automatically assign to attendees when they RSVP Yes"
                    />
                    <RoleSelect
                        guildId={guildId}
                        value={formData.attendeeRoleId}
                        onChange={(value) =>
                            setFormData({ ...formData, attendeeRoleId: value })
                        }
                        allowNone={true}
                        placeholder="No auto-assign role..."
                    />
                </div>
            </div>

            {/* Discord Integration */}
            <div className="space-y-4 border-t pt-6">
                <Label className="text-base">Discord Integration</Label>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Mirror to Discord Events</Label>
                        <HelperText>Create a native Discord Scheduled Event (shows in server's event list)</HelperText>
                    </div>
                    <Switch
                        checked={formData.mirrorToDiscord}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, mirrorToDiscord: checked })
                        }
                    />
                </div>
            </div>

            {/* Mention Settings */}
            <div className="space-y-4 border-t pt-6">
                <Label className="text-base">Mention Settings</Label>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Mention on Create</Label>
                            <HelperText>Mention roles when event is created</HelperText>
                        </div>
                        <Switch
                            checked={formData.mentionOnCreate}
                            onCheckedChange={(checked) =>
                                setFormData({ ...formData, mentionOnCreate: checked })
                            }
                        />
                    </div>

                    {formData.mentionOnCreate && (
                        <div className="space-y-2.5 pl-6">
                            <Label>Mention Roles on Create</Label>
                            <RoleMultiSelect
                                guildId={guildId}
                                values={formData.mentionRoleIdsOnCreate}
                                onChange={(values) =>
                                    setFormData({
                                        ...formData,
                                        mentionRoleIdsOnCreate: values,
                                    })
                                }
                                placeholder="Select roles to mention on create..."
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Mention on Start</Label>
                            <HelperText>Mention roles when event starts</HelperText>
                        </div>
                        <Switch
                            checked={formData.mentionOnStart}
                            onCheckedChange={(checked) =>
                                setFormData({ ...formData, mentionOnStart: checked })
                            }
                        />
                    </div>

                    {formData.mentionOnStart && (
                        <div className="space-y-2.5 pl-6">
                            <Label>Mention Roles on Start</Label>
                            <RoleMultiSelect
                                guildId={guildId}
                                values={formData.mentionRoleIdsOnStart}
                                onChange={(values) =>
                                    setFormData({
                                        ...formData,
                                        mentionRoleIdsOnStart: values,
                                    })
                                }
                                placeholder="Select roles to mention on start..."
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Repeat Settings */}
            <div className="space-y-4 border-t pt-6">
                <Label className="text-base flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Recurring Event
                </Label>

                <Select
                    value={formData.repeatFrequency}
                    onValueChange={(value) =>
                        setFormData({
                            ...formData,
                            repeatFrequency: value as EventFormData["repeatFrequency"],
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select frequency..." />
                    </SelectTrigger>
                    <SelectContent>
                        {REPEAT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {formData.repeatFrequency !== "NONE" && (
                    <div className="space-y-2.5">
                        <Label>Repeat Until</Label>
                        <DatePicker
                            value={formData.repeatUntil}
                            onChange={(date) =>
                                setFormData({
                                    ...formData,
                                    repeatUntil: date,
                                })
                            }
                            placeholder="Select end date for recurrence"
                            minDate={formData.startTime || undefined}
                        />
                    </div>
                )}
            </div>

            {/* Save as Template */}
            <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Save as Template</Label>
                        <HelperText>
                            Save this event configuration as a reusable template
                        </HelperText>
                    </div>
                    <Switch
                        checked={saveAsTemplate}
                        onCheckedChange={setSaveAsTemplate}
                    />
                </div>

                {saveAsTemplate && (
                    <div className="space-y-2.5">
                        <Label htmlFor="templateName">
                            Template Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="templateName"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., Weekly Community Meetup"
                            required
                        />
                    </div>
                )}
            </div>

            <DialogFooter className="gap-2 border-t pt-6">
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={saving || savingTemplate}>
                    {saving || savingTemplate
                        ? "Saving..."
                        : event
                            ? "Update Event"
                            : "Create Event"}
                </Button>
            </DialogFooter>
        </form>
    );
}

function EventsList({
    guildId,
    status,
}: {
    guildId: string;
    status: "upcoming" | "past";
}) {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [duplicatingEvent, setDuplicatingEvent] = useState<Event | null>(null);

    useEffect(() => {
        fetchEvents();
    }, [guildId, status]);

    async function fetchEvents() {
        try {
            const params = new URLSearchParams();
            if (status === "upcoming") {
                params.set("upcoming", "true");
            } else {
                params.set("past", "true");
            }

            const res = await fetch(
                `/api/guilds/${guildId}/events?${params.toString()}`
            );
            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    }

    async function deleteEvent(eventId: string) {
        try {
            const res = await fetch(
                `/api/guilds/${guildId}/events/${eventId}`,
                { method: "DELETE" }
            );
            if (res.ok) {
                setEvents(events.filter((e) => e.id !== eventId));
                toast.success("Event deleted");
            } else {
                toast.error("Failed to delete event");
            }
        } catch (error) {
            console.error("Error deleting event:", error);
            toast.error("Failed to delete event");
        }
    }

    function duplicateEvent(event: Event) {
        setDuplicatingEvent(event);
    }

    const filteredEvents = events.filter(
        (e) =>
            e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading events...
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>
                                {status === "upcoming" ? "Upcoming Events" : "Past Events"}
                            </CardTitle>
                            <CardDescription>
                                {events.length} event{events.length !== 1 ? "s" : ""}
                            </CardDescription>
                        </div>
                        <Input
                            placeholder="Search events..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredEvents.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">
                                {searchTerm
                                    ? "No events match your search"
                                    : status === "upcoming"
                                        ? "No upcoming events"
                                        : "No past events"}
                            </p>
                            <p className="text-sm">
                                {searchTerm
                                    ? "Try a different search term"
                                    : status === "upcoming"
                                        ? "Create your first event to get started"
                                        : "Completed events will appear here"}
                            </p>
                        </div>
                    ) : (
                        <FadeInStagger className="space-y-4">
                            {filteredEvents.map((event) => (
                                <FadeInItem key={event.id}>
                                    <EventCard
                                        guildId={guildId}
                                        event={event}
                                        onEdit={() => setEditingEvent(event)}
                                        onDelete={() => deleteEvent(event.id)}
                                        onDuplicate={() => duplicateEvent(event)}
                                    />
                                </FadeInItem>
                            ))}
                        </FadeInStagger>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog
                open={!!editingEvent}
                onOpenChange={(open) => !open && setEditingEvent(null)}
            >
                <EventDialogShell
                    title="Edit Event"
                    description="Update the event details."
                >
                    {editingEvent && (
                        <EventForm
                            guildId={guildId}
                            event={editingEvent}
                            onSuccess={() => {
                                setEditingEvent(null);
                                fetchEvents();
                            }}
                        />
                    )}
                </EventDialogShell>
            </Dialog>

            {/* Duplicate Dialog */}
            <Dialog
                open={!!duplicatingEvent}
                onOpenChange={(open) => !open && setDuplicatingEvent(null)}
            >
                <EventDialogShell
                    title="Duplicate Event"
                    description="Create a new event based on this template."
                >
                    {duplicatingEvent && (
                        <EventForm
                            guildId={guildId}
                            initialEvent={duplicatingEvent}
                            onSuccess={() => {
                                setDuplicatingEvent(null);
                                fetchEvents();
                            }}
                        />
                    )}
                </EventDialogShell>
            </Dialog>
        </>
    );
}

function CalendarTab({ guildId }: { guildId: string }) {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    useEffect(() => {
        fetchEvents();
    }, [guildId]);

    async function fetchEvents() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/events`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    }

    function handleCreateEvent(date: Date) {
        setSelectedDate(date);
        setCreatingEvent(true);
    }

    function handleEventClick(event: Event) {
        setEditingEvent(event);
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground">Loading calendar...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <EventCalendar
                events={events}
                onEventClick={handleEventClick}
                onCreateEvent={handleCreateEvent}
            />

            {/* Create Dialog */}
            <Dialog open={creatingEvent} onOpenChange={setCreatingEvent}>
                <EventDialogShell
                    title="Create New Event"
                    description={selectedDate && `Creating event for ${format(selectedDate, "MMMM d, yyyy")}`}
                >
                    <EventForm
                        guildId={guildId}
                        initialDate={selectedDate}
                        onSuccess={() => {
                            setCreatingEvent(false);
                            setSelectedDate(null);
                            fetchEvents();
                        }}
                    />
                </EventDialogShell>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog
                open={!!editingEvent}
                onOpenChange={(open) => !open && setEditingEvent(null)}
            >
                <EventDialogShell
                    title="Edit Event"
                    description="Update the event details."
                >
                    {editingEvent && (
                        <EventForm
                            guildId={guildId}
                            event={editingEvent}
                            onSuccess={() => {
                                setEditingEvent(null);
                                fetchEvents();
                            }}
                        />
                    )}
                </EventDialogShell>
            </Dialog>
        </>
    );
}

function EventCard({
    guildId,
    event,
    onEdit,
    onDelete,
    onDuplicate,
}: {
    guildId: string;
    event: Event;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
}) {
    const { channelsById } = useDiscordData(guildId);
    const startDate = new Date(event.startTime);
    const renderRsvpNames = (
        label: string,
        users: { userId: string; displayName: string; avatarUrl: string | null }[],
        colorClass: string
    ) => {
        if (!users || users.length === 0) return null;

        const visible = users.slice(0, 6).map((user) => user.displayName).join(", ");
        const extra = users.length > 6 ? ` +${users.length - 6} more` : "";

        return (
            <div className={`text-xs ${colorClass}`}>
                <span className="font-medium">{label}:</span> {visible}{extra}
            </div>
        );
    };

    return (
        <Card
            className="overflow-hidden"
            style={{
                borderLeftWidth: "4px",
                borderLeftColor: event.color || "#5865F2",
            }}
        >
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg truncate">
                                {event.title}
                            </h3>
                            <Badge
                                variant={
                                    event.status === "SCHEDULED"
                                        ? "default"
                                        : event.status === "ACTIVE"
                                            ? "secondary"
                                            : "outline"
                                }
                            >
                                {event.status.toLowerCase()}
                            </Badge>
                            {event.repeatFrequency !== "NONE" && (
                                <Badge variant="outline" className="gap-1">
                                    <Repeat className="h-3 w-3" />
                                    {REPEAT_OPTIONS.find(
                                        (r) => r.value === event.repeatFrequency
                                    )?.label}
                                </Badge>
                            )}
                            {event.mirrorToDiscord && (
                                event.discordScheduledEventId ? (
                                    <a href={`https://discord.com/events/${guildId}/${event.discordScheduledEventId}`} target="_blank" rel="noopener noreferrer">
                                        <Badge variant="outline" className="gap-1 text-[#5865F2] border-[#5865F2] hover:bg-[#5865F2]/10 transition-colors">
                                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                            </svg>
                                            Discord Event
                                        </Badge>
                                    </a>
                                ) : (
                                    <Badge variant="outline" className="gap-1 text-[#5865F2] border-[#5865F2]">
                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                        </svg>
                                        Discord Event
                                    </Badge>
                                )
                            )}
                        </div>

                        {event.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {event.description}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(startDate, "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {format(startDate, "h:mm a")}
                                {event.endTime &&
                                    ` - ${format(
                                        new Date(event.endTime),
                                        "h:mm a"
                                    )}`}
                            </span>
                            {(event.locationChannelId || event.location) && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {event.locationChannelId
                                        ? `Voice: ${channelsById.get(event.locationChannelId)?.name ? `#${channelsById.get(event.locationChannelId)?.name}` : `#${event.locationChannelId}`}${event.location ? ` (${event.location})` : ""}`
                                        : event.location}
                                </span>
                            )}
                        </div>

                        {/* RSVP Counts */}
                        <div className="flex items-center gap-4 mt-3">
                            <Badge
                                variant="secondary"
                                className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            >
                                <CheckCircle className="h-3 w-3" />
                                {event.rsvpCounts.yes} going
                            </Badge>
                            <Badge
                                variant="secondary"
                                className="gap-1 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                            >
                                <HelpCircle className="h-3 w-3" />
                                {event.rsvpCounts.maybe} maybe
                            </Badge>
                            <Badge
                                variant="secondary"
                                className="gap-1 bg-red-500/10 text-red-600 hover:bg-red-500/20"
                            >
                                <XCircle className="h-3 w-3" />
                                {event.rsvpCounts.no} declined
                            </Badge>
                            {event.maxAttendees && (
                                <Badge variant="outline" className="gap-1">
                                    <Users className="h-3 w-3" />
                                    {event.rsvpCounts.yes + event.rsvpCounts.waitlist}/
                                    {event.maxAttendees}
                                    {event.rsvpCounts.waitlist > 0 &&
                                        ` (${event.rsvpCounts.waitlist} waitlist)`}
                                </Badge>
                            )}
                        </div>
                        {(event.rsvpUsers?.yes?.length > 0 ||
                            event.rsvpUsers?.maybe?.length > 0 ||
                            event.rsvpUsers?.no?.length > 0 ||
                            event.rsvpUsers?.waitlist?.length > 0) && (
                            <div className="mt-2 space-y-1">
                                {renderRsvpNames("Going", event.rsvpUsers.yes, "text-green-600")}
                                {renderRsvpNames("Maybe", event.rsvpUsers.maybe, "text-yellow-600")}
                                {renderRsvpNames("Declined", event.rsvpUsers.no, "text-red-600")}
                                {renderRsvpNames("Waitlist", event.rsvpUsers.waitlist, "text-muted-foreground")}
                            </div>
                        )}
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEdit}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDuplicate}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                            </DropdownMenuItem>
                            <ConfirmDeleteDialog
                                onConfirm={onDelete}
                                title="Delete Event?"
                                description="Are you sure you want to delete this event? This action cannot be undone."
                                confirmText="Delete Event"
                            >
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-red-600"
                                >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </ConfirmDeleteDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </Card>
    );
}

function EventTemplatesTab({ guildId }: { guildId: string }) {
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EventTemplate | null>(null);
    const [savingTemplate, setSavingTemplate] = useState(false);

    useEffect(() => {
        fetchTemplates();
    }, [guildId]);

    async function fetchTemplates() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/events/templates`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    }

    async function deleteTemplate(templateId: string) {

        try {
            const res = await fetch(`/api/guilds/${guildId}/events/templates/${templateId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                toast.error("Failed to delete template");
                return;
            }
            setTemplates((prev) => prev.filter((template) => template.id !== templateId));
            toast.success("Template deleted");
        } catch (error) {
            console.error("Error deleting template:", error);
            toast.error("Failed to delete template");
        }
    }

    async function saveTemplateEdits() {
        if (!editingTemplate) return;
        if (!editingTemplate.name.trim()) {
            toast.error("Template name is required");
            return;
        }

        setSavingTemplate(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/events/templates/${editingTemplate.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editingTemplate.name,
                    defaultDescription: editingTemplate.defaultDescription,
                    defaultTitle: editingTemplate.defaultTitle,
                    defaultLocation: editingTemplate.defaultLocation,
                    defaultDurationMinutes: editingTemplate.defaultDurationMinutes,
                }),
            });
            if (!res.ok) {
                toast.error("Failed to update template");
                return;
            }
            const updated = await res.json();
            setTemplates((prev) => prev.map((template) => template.id === updated.id ? updated : template));
            setEditingTemplate(null);
            toast.success("Template updated");
        } catch (error) {
            console.error("Error updating template:", error);
            toast.error("Failed to update template");
        } finally {
            setSavingTemplate(false);
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading templates...
                </CardContent>
            </Card>
        );
    }

    return (
        <>
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle>Event Templates</CardTitle>
                        <CardDescription>
                            Save common event configurations for quick creation.
                        </CardDescription>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Template
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Event Template</DialogTitle>
                                <DialogDescription>
                                    Save reusable defaults for future events.
                                </DialogDescription>
                            </DialogHeader>
                            <CreateEventTemplateForm
                                guildId={guildId}
                                onSuccess={() => {
                                    setCreateOpen(false);
                                    fetchTemplates();
                                }}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {templates.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No templates yet.</p>
                        <p className="text-sm">
                            Templates will appear here when created.
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Default Duration</TableHead>
                                <TableHead className="w-[140px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">
                                        {template.name}
                                    </TableCell>
                                    <TableCell>{template.description}</TableCell>
                                    <TableCell>
                                        {template.defaultDurationMinutes
                                            ? `${template.defaultDurationMinutes} minutes`
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingTemplate({ ...template })}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <ConfirmDeleteDialog
                                                onConfirm={() => deleteTemplate(template.id)}
                                                title="Delete Template?"
                                                description="Are you sure you want to delete this template?"
                                                confirmText="Delete Template"
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                >
                                                    <Trash className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </ConfirmDeleteDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>

        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Event Template</DialogTitle>
                </DialogHeader>
                {editingTemplate && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input
                                value={editingTemplate.name}
                                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={editingTemplate.defaultDescription ?? ""}
                                onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultDescription: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Title</Label>
                            <Input
                                value={editingTemplate.defaultTitle ?? ""}
                                onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultTitle: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Location</Label>
                            <Input
                                value={editingTemplate.defaultLocation ?? ""}
                                onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultLocation: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Duration (minutes)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={1440}
                                value={editingTemplate.defaultDurationMinutes ?? ""}
                                onChange={(e) =>
                                    setEditingTemplate({
                                        ...editingTemplate,
                                        defaultDurationMinutes: e.target.value ? Number(e.target.value) : null,
                                    })
                                }
                            />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                    <Button onClick={saveTemplateEdits} disabled={savingTemplate}>
                        {savingTemplate ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

function CreateEventTemplateForm({
    guildId,
    onSuccess,
}: {
    guildId: string;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        defaultTitle: "",
        defaultDescription: "",
        defaultLocation: "",
        defaultColor: "#5865F2",
        defaultDurationMinutes: null as number | null,
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("Template name is required");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/events/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    defaultTitle: formData.defaultTitle || undefined,
                    defaultDescription: formData.defaultDescription || undefined,
                    defaultLocation: formData.defaultLocation || undefined,
                    defaultColor: formData.defaultColor || undefined,
                    defaultDurationMinutes: formData.defaultDurationMinutes || undefined,
                }),
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => ({} as { error?: string }));
                toast.error(payload.error || "Failed to create template");
                return;
            }

            toast.success("Template created");
            onSuccess();
        } catch (error) {
            console.error("Error creating event template:", error);
            toast.error("Failed to create template");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="event-template-name">
                    Template Name <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="event-template-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weekly Team Meeting"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="event-template-title">Default Event Title</Label>
                <Input
                    id="event-template-title"
                    value={formData.defaultTitle}
                    onChange={(e) => setFormData({ ...formData, defaultTitle: e.target.value })}
                    placeholder="e.g., Community Hangout"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="event-template-description">Default Description</Label>
                <Textarea
                    id="event-template-description"
                    value={formData.defaultDescription}
                    onChange={(e) => setFormData({ ...formData, defaultDescription: e.target.value })}
                    placeholder="Default description for events using this template"
                    rows={3}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="event-template-location">Default Location</Label>
                <Input
                    id="event-template-location"
                    value={formData.defaultLocation}
                    onChange={(e) => setFormData({ ...formData, defaultLocation: e.target.value })}
                    placeholder="e.g., Lounge VC"
                />
            </div>

            <div className="space-y-2">
                <Label>Default Color</Label>
                <div className="flex gap-2 flex-wrap">
                    {EVENT_COLORS.map((color) => (
                        <button
                            key={`template-${color.value}`}
                            type="button"
                            onClick={() => setFormData({ ...formData, defaultColor: color.value })}
                            className={`w-7 h-7 rounded-full ${color.class} ${formData.defaultColor === color.value ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                            title={color.label}
                        />
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="event-template-duration">Default Duration (minutes)</Label>
                <Input
                    id="event-template-duration"
                    type="number"
                    min={1}
                    max={1440}
                    value={formData.defaultDurationMinutes ?? ""}
                    onChange={(e) =>
                        setFormData({
                            ...formData,
                            defaultDurationMinutes: e.target.value ? Number(e.target.value) : null,
                        })
                    }
                />
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                    {saving ? "Creating..." : "Create Template"}
                </Button>
            </DialogFooter>
        </form>
    );
}

function EventSettingsTab({ guildId }: { guildId: string }) {
    const [settings, setSettings] = useState({
        defaultEventChannelId: "",
        defaultMentionOnCreate: false,
        defaultMentionOnStart: false,
        serverTimezone: "UTC",
        mirrorToDiscordEvents: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [guildId]);

    async function fetchSettings() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/events/settings`);
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    defaultEventChannelId: data.defaultEventChannelId ?? "",
                    defaultMentionOnCreate: data.defaultMentionOnCreate ?? false,
                    defaultMentionOnStart: data.defaultMentionOnStart ?? false,
                    serverTimezone: data.serverTimezone ?? "UTC",
                    mirrorToDiscordEvents: data.mirrorToDiscordEvents ?? true,
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch(`/api/guilds/${guildId}/events/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                toast.success("Settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading settings...
                </CardContent>
            </Card>
        );
    }

    return (
        <form onSubmit={handleSave}>
            <Card>
                <CardHeader>
                    <CardTitle>Event Settings</CardTitle>
                    <CardDescription>
                        Configure default settings for events in this server.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Default Event Channel</Label>
                        <ChannelSelect
                            guildId={guildId}
                            value={settings.defaultEventChannelId}
                            onChange={(value) =>
                                setSettings({
                                    ...settings,
                                    defaultEventChannelId: value,
                                })
                            }
                            allowNone={true}
                            placeholder="No default channel..."
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Default Mention on Create</Label>
                            <HelperText>
                                Pre-checks the 'Mention Roles on Create' option in the dashboard form by default.
                            </HelperText>
                        </div>
                        <Switch
                            checked={settings.defaultMentionOnCreate}
                            onCheckedChange={(checked) =>
                                setSettings({
                                    ...settings,
                                    defaultMentionOnCreate: checked,
                                })
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Default Mention on Start</Label>
                            <HelperText>
                                Pre-checks the 'Mention Roles on Start' option in the dashboard form by default.
                            </HelperText>
                        </div>
                        <Switch
                            checked={settings.defaultMentionOnStart}
                            onCheckedChange={(checked) =>
                                setSettings({
                                    ...settings,
                                    defaultMentionOnStart: checked,
                                })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Server Timezone</Label>
                        <Select
                            value={settings.serverTimezone || "UTC"}
                            onValueChange={(value) =>
                                setSettings({
                                    ...settings,
                                    serverTimezone: value,
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select timezone..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Intl.supportedValuesOf('timeZone').map((tz) => (
                                    <SelectItem key={tz} value={tz}>
                                        {formatTimezone(tz)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <HelperText>
                            Used as default timezone for events. Uses UTC if invalid.
                        </HelperText>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Mirror Events to Discord</Label>
                            <HelperText>
                                Automatically create Discord Scheduled Events for new events (default for new events)
                            </HelperText>
                        </div>
                        <Switch
                            checked={settings.mirrorToDiscordEvents ?? true}
                            onCheckedChange={(checked) =>
                                setSettings({
                                    ...settings,
                                    mirrorToDiscordEvents: checked,
                                })
                            }
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Settings"}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
