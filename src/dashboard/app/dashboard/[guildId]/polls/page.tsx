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
    BarChart3,
    Plus,
    MoreVertical,
    Trash,
    Edit,
    X,
    Clock,
    Users,
    BarChart,
    Lock,
    EyeOff,
    Calendar,
    List,
    SmilePlus,
} from "lucide-react";

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui/popover";

import { toast } from "sonner";
import { Badge } from "../../../../components/ui/badge";
import { Textarea } from "../../../../components/ui/textarea";
import { format, addDays, addMinutes, setHours, setMinutes, startOfDay } from "date-fns";
import { LabelWithTooltip, HelperText } from "../../../../components/HelpTooltip";

import { DateTimePicker, DatePicker, TimePicker } from "../../../../components/ui/datetime-picker";
import { RoleMultiSelect, ChannelSelect } from "../../../../components/DiscordSelectors";
import { FadeInStagger, FadeInItem } from "../../../../components/MotionWrapper";
import { useDiscordData } from "../../../../components/useDiscordData";

// Types
interface Poll {
    id: string;
    guildId: string;
    creatorId: string;
    channelId: string;
    messageId: string | null;
    question: string;
    description: string | null;
    type: "STANDARD" | "TIME" | "ANONYMOUS";
    allowMultipleVotes: boolean;
    maxVotesPerUser: number | null;
    allowCustomOptions: boolean;
    isAnonymous: boolean;
    endTime: string | null;
    allowedRoleIds: string[] | null;
    mentionRoleIds: string[] | null;
    mentionOnCreate: boolean;
    createdAt: string;
    options?: PollOption[];
    voteCount?: number;
}

interface PollOption {
    id: string;
    pollId: string;
    text: string;
    emoji: string | null;
    order: number;
    dateTimeValue?: string | null;
    voteCount?: number;
}

interface PollTemplate {
    id: string;
    name: string;
    description: string | null;
    question: string | null;
    pollDescription: string | null;
    type: "STANDARD" | "TIME" | "ANONYMOUS";
    allowMultipleVotes: boolean;
    maxVotesPerUser: number | null;
    allowCustomOptions: boolean;
    defaultOptions: string[] | null;
}



const POLL_TYPES = [
    { value: "STANDARD", label: "Standard Poll", icon: BarChart, description: "Simple voting with predefined options" },
    { value: "TIME", label: "Time Poll", icon: Clock, description: "Find the best time for everyone (like When2meet)" },
    { value: "ANONYMOUS", label: "Anonymous Poll", icon: EyeOff, description: "Votes are hidden from other users" },
];

const TIME_SLOT_INTERVALS = [15, 30, 60, 90, 120];
const WEEKDAY_OPTIONS = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
];
const MAX_TIME_POLL_SLOTS = 400;

interface DayTimeWindow {
    enabled: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
}

type DayTimeWindows = Record<number, DayTimeWindow>;

function parseDiscordTimestampMarkup(value: string): Date | null {
    const match = value.match(/<t:(\d+):[tTdDfFR]>/);
    if (!match) return null;
    const unix = Number.parseInt(match[1], 10);
    if (!Number.isFinite(unix)) return null;
    const parsed = new Date(unix * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimePollOptionDate(option: PollOption): Date | null {
    if (option.dateTimeValue) {
        const fromDateValue = new Date(option.dateTimeValue);
        if (!Number.isNaN(fromDateValue.getTime())) {
            return fromDateValue;
        }
    }

    const fromMarkup = parseDiscordTimestampMarkup(option.text);
    if (fromMarkup) return fromMarkup;

    const fromText = new Date(option.text);
    return Number.isNaN(fromText.getTime()) ? null : fromText;
}

function getTimePollOptionLabel(poll: Pick<Poll, "type">, option: PollOption): string {
    if (poll.type !== "TIME") {
        return option.text;
    }

    const parsed = parseTimePollOptionDate(option);
    if (!parsed) {
        return option.text;
    }

    return format(parsed, "EEE, MMM d h:mm a");
}

function parseTimeInput(value: string): { hour: number; minute: number } | null {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
}

function formatTimeInput(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function createDefaultDayWindows(
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number
): DayTimeWindows {
    const windows: DayTimeWindows = {};
    for (const weekday of WEEKDAY_OPTIONS) {
        windows[weekday.value] = {
            enabled: true,
            startHour,
            startMinute,
            endHour,
            endMinute,
        };
    }
    return windows;
}

function inferDayWindowsFromSlots(slots: Date[], fallbackIntervalMinutes: number): DayTimeWindows {
    const windows = createDefaultDayWindows(9, 0, 21, 0);
    for (const weekday of WEEKDAY_OPTIONS) {
        windows[weekday.value].enabled = false;
    }

    const grouped = new Map<number, Date[]>();
    for (const slot of slots) {
        const day = slot.getDay();
        if (!grouped.has(day)) {
            grouped.set(day, []);
        }
        grouped.get(day)?.push(slot);
    }

    for (const [day, daySlots] of grouped.entries()) {
        if (!daySlots.length) continue;
        daySlots.sort((a, b) => a.getTime() - b.getTime());
        const first = daySlots[0];
        const last = daySlots[daySlots.length - 1];
        const inferredEnd = addMinutes(last, fallbackIntervalMinutes);
        windows[day] = {
            enabled: true,
            startHour: first.getHours(),
            startMinute: first.getMinutes(),
            endHour: inferredEnd.getHours(),
            endMinute: inferredEnd.getMinutes(),
        };
    }

    return windows;
}

function inferIncludedWeekdaysFromSlots(slots: Date[]): number[] {
    const weekdays = new Set<number>();
    for (const slot of slots) {
        weekdays.add(slot.getDay());
    }
    return [...weekdays].sort((a, b) => a - b);
}

function getEnabledDayWindows(windows: DayTimeWindows): DayTimeWindow[] {
    return WEEKDAY_OPTIONS
        .map((weekday) => windows[weekday.value])
        .filter((window): window is DayTimeWindow => Boolean(window?.enabled));
}

function areEnabledDayWindowsUniform(windows: DayTimeWindows): boolean {
    const enabled = getEnabledDayWindows(windows);
    if (enabled.length <= 1) return true;
    const [first] = enabled;
    return enabled.every((window) =>
        window.startHour === first.startHour &&
        window.startMinute === first.startMinute &&
        window.endHour === first.endHour &&
        window.endMinute === first.endMinute
    );
}

function formatTwelveHourTime(hour: number, minute: number): string {
    const period = hour < 12 ? "am" : "pm";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, "0")}${period}`;
}

const POLL_TABS = ["active", "ended", "templates"] as const;
type PollTab = (typeof POLL_TABS)[number];

export default function PollsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: PollTab =
        requestedTab && POLL_TABS.includes(requestedTab as PollTab)
            ? (requestedTab as PollTab)
            : "active";
    const [activeTab, setActiveTab] = useState<PollTab>(resolvedTab);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-8 w-8 text-emerald-500" />
                    Polls
                </h1>
                <p className="text-muted-foreground">
                    Create polls to gather opinions, schedule events, or make decisions.
                </p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as PollTab)}
                className="space-y-4"
            >
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="ended">Ended</TabsTrigger>
                        <TabsTrigger value="templates">Templates</TabsTrigger>
                    </TabsList>

                    {activeTab === "active" && <CreatePollButton guildId={guildId} onSuccess={() => setRefreshKey(k => k + 1)} />}
                </div>

                <TabsContent value="active" className="space-y-4">
                    <PollsList key={refreshKey} guildId={guildId} status="active" />
                </TabsContent>

                <TabsContent value="ended" className="space-y-4">
                    <PollsList guildId={guildId} status="ended" />
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                    <PollTemplatesTab guildId={guildId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function CreatePollButton({ guildId, onSuccess }: { guildId: string; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const [pollType, setPollType] = useState<"STANDARD" | "TIME" | "ANONYMOUS">("STANDARD");

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Poll
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="p-6">
                <DialogHeader>
                    <DialogTitle>Create New Poll</DialogTitle>
                    <DialogDescription>
                        Choose the type of poll you want to create.
                    </DialogDescription>
                </DialogHeader>

                {/* Poll Type Selection */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {POLL_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                            <button
                                key={type.value}
                                onClick={() => setPollType(type.value as any)}
                                className={`p-4 rounded-lg border text-left transition-all ${
                                    pollType === type.value
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                }`}
                            >
                                <Icon className={`h-6 w-6 mb-2 ${pollType === type.value ? "text-primary" : ""}`} />
                                <div className="font-medium">{type.label}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {type.description}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {pollType === "TIME" ? (
                    <TimePollForm guildId={guildId} onSuccess={() => { setOpen(false); onSuccess?.(); }} />
                ) : (
                    <StandardPollForm guildId={guildId} pollType={pollType} onSuccess={() => { setOpen(false); onSuccess?.(); }} />
                )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StandardPollForm({
    guildId,
    poll,
    pollType,
    onSuccess,
}: {
    guildId: string;
    poll?: Poll;
    pollType: "STANDARD" | "ANONYMOUS";
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [templates, setTemplates] = useState<PollTemplate[]>([]);
    const [options, setOptions] = useState<{ text: string; emoji: string }[]>(
        poll?.options?.map((o) => ({ text: o.text, emoji: o.emoji || "" })) || [
            { text: "", emoji: "" },
            { text: "", emoji: "" },
        ]
    );
    const [formData, setFormData] = useState({
        question: poll?.question || "",
        description: poll?.description || "",
        channelId: poll?.channelId || "",
        type: poll?.type || pollType,
        allowMultipleVotes: poll?.allowMultipleVotes ?? false,
        maxVotesPerUser: poll?.maxVotesPerUser || null,
        allowCustomOptions: poll?.allowCustomOptions ?? false,
        isAnonymous: poll?.isAnonymous || pollType === "ANONYMOUS",
        endTime: poll?.endTime ? new Date(poll.endTime) : null,
        allowedRoleIds: poll?.allowedRoleIds || [],
        mentionRoleIds: poll?.mentionRoleIds || [],
        mentionOnCreate: poll?.mentionOnCreate ?? false,
    });

    useEffect(() => {
        fetchTemplates();
    }, [guildId]);

    async function fetchTemplates() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/polls/templates`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        }
    }

    function applyTemplate(templateId: string) {
        const template = templates.find((t) => t.id === templateId);
        if (!template) return;

        setFormData((prev) => ({
            ...prev,
            question: template.question || prev.question,
            description: template.pollDescription || prev.description,
            type: template.type,
            allowMultipleVotes: template.allowMultipleVotes,
            maxVotesPerUser: template.maxVotesPerUser,
            allowCustomOptions: template.allowCustomOptions,
        }));

        if (template.defaultOptions) {
            setOptions(template.defaultOptions.map((text) => ({ text, emoji: "" })));
        }
    }

    function addOption() {
        setOptions([...options, { text: "", emoji: "" }]);
    }

    function removeOption(index: number) {
        if (options.length <= 2) {
            toast.error("Poll must have at least 2 options");
            return;
        }
        setOptions(options.filter((_, i) => i !== index));
    }

    function updateOption(index: number, field: "text" | "emoji", value: string) {
        const newOptions = [...options];
        newOptions[index][field] = value;
        setOptions(newOptions);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validation
        if (!formData.question.trim()) {
            toast.error("Question is required");
            return;
        }
        if (!formData.channelId) {
            toast.error("Channel is required");
            return;
        }
        const validOptions = options.filter((o) => o.text.trim());
        if (validOptions.length < 2) {
            toast.error("At least 2 options are required");
            return;
        }

        setSaving(true);

        try {
            const url = poll
                ? `/api/guilds/${guildId}/polls/${poll.id}`
                : `/api/guilds/${guildId}/polls`;
            const method = poll ? "PATCH" : "POST";

            const payload = {
                question: formData.question,
                description: formData.description || undefined,
                channelId: formData.channelId,
                type: formData.type,
                allowMultipleVotes: formData.allowMultipleVotes,
                maxVotesPerUser: formData.maxVotesPerUser || undefined,
                allowCustomOptions: formData.allowCustomOptions,
                isAnonymous: formData.isAnonymous,
                endTime: formData.endTime?.toISOString() || undefined,
                allowedRoleIds: formData.allowedRoleIds.length > 0 ? formData.allowedRoleIds : undefined,
                mentionRoleIds: formData.mentionRoleIds.length > 0 ? formData.mentionRoleIds : undefined,
                mentionOnCreate: formData.mentionOnCreate,
                options: validOptions,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to save poll");
                return;
            }

            toast.success(poll ? "Poll updated" : "Poll created");
            onSuccess();
        } catch (error) {
            console.error("Error saving poll:", error);
            toast.error("Failed to save poll");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Template Selector */}
            {!poll && templates.length > 0 && (
                <div className="space-y-2">
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

            {/* Question */}
            <div className="space-y-2">
                <Label htmlFor="question">
                    Question <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="question"
                    value={formData.question}
                    onChange={(e) =>
                        setFormData({ ...formData, question: e.target.value })
                    }
                    placeholder="e.g., What's your favorite color?"
                    required
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Add more context to your question..."
                    rows={2}
                />
            </div>

            {/* Channel */}
            <div className="space-y-2">
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

            {/* Options */}
            <div className="space-y-3">
                <Label>
                    Options <span className="text-red-500">*</span>
                </Label>
                <HelperText>Add at least 2 options for people to vote on.</HelperText>
                
                {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0 w-10">
                                    {option.emoji ? (
                                        <span className="text-lg">{option.emoji}</span>
                                    ) : (
                                        <SmilePlus className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Picker
                                    data={data}
                                    onEmojiSelect={(emoji: any) =>
                                        updateOption(index, "emoji", emoji.native)
                                    }
                                    theme="light"
                                />
                            </PopoverContent>
                        </Popover>
                        <Input
                            placeholder={`Option ${index + 1}`}
                            value={option.text}
                            onChange={(e) =>
                                updateOption(index, "text", e.target.value)
                            }
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                
                <Button type="button" variant="outline" onClick={addOption} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                </Button>
            </div>

            {/* Poll Settings */}
            <div className="space-y-4 border-t pt-4">
                <Label className="text-base">Poll Settings</Label>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Allow Multiple Votes</Label>
                        <HelperText>Users can vote for more than one option</HelperText>
                    </div>
                    <Switch
                        checked={formData.allowMultipleVotes}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, allowMultipleVotes: checked })
                        }
                    />
                </div>

                {formData.allowMultipleVotes && (
                    <div className="space-y-2 pl-6">
                        <Label>Max Votes Per User</Label>
                        <Input
                            type="number"
                            min={1}
                            max={options.length}
                            value={formData.maxVotesPerUser || ""}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    maxVotesPerUser: e.target.value
                                        ? parseInt(e.target.value)
                                        : null,
                                })
                            }
                            placeholder="Leave empty for unlimited"
                            className="w-48"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Allow Custom Options</Label>
                        <HelperText>Users can add their own options</HelperText>
                    </div>
                    <Switch
                        checked={formData.allowCustomOptions}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, allowCustomOptions: checked })
                        }
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4" />
                            Anonymous Voting
                        </Label>
                        <HelperText>Hide who voted for what</HelperText>
                    </div>
                    <Switch
                        checked={formData.isAnonymous}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, isAnonymous: checked })
                        }
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Mention on Create</Label>
                        <HelperText>Send a mention when the poll is posted</HelperText>
                    </div>
                    <Switch
                        checked={formData.mentionOnCreate}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, mentionOnCreate: checked })
                        }
                    />
                </div>

                {formData.mentionOnCreate && (
                    <div className="space-y-2 pl-6">
                        <Label>Mention Roles</Label>
                        <RoleMultiSelect
                            guildId={guildId}
                            values={formData.mentionRoleIds}
                            onChange={(values) =>
                                setFormData({
                                    ...formData,
                                    mentionRoleIds: values,
                                })
                            }
                            placeholder="Select roles to mention..."
                        />
                    </div>
                )}
            </div>

            {/* End Time */}
            <div className="space-y-2 border-t pt-4">
                <Label>
                    <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        End Time (optional)
                    </span>
                </Label>
                <HelperText>Set when voting should automatically close</HelperText>
                <DateTimePicker
                    value={formData.endTime}
                    onChange={(date) =>
                        setFormData({ ...formData, endTime: date })
                    }
                    placeholder="Select end date and time"
                />
            </div>

            {/* Role Restrictions */}
            <div className="space-y-2 border-t pt-4">
                <LabelWithTooltip
                    label="Restrict to Roles"
                    tooltip="Only members with these roles can vote"
                />
                <RoleMultiSelect
                    guildId={guildId}
                    values={formData.allowedRoleIds}
                    onChange={(values) =>
                        setFormData({
                            ...formData,
                            allowedRoleIds: values,
                        })
                    }
                    placeholder="No restrictions..."
                />
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : poll ? "Update Poll" : "Create Poll"}
                </Button>
            </DialogFooter>
        </form>
    );
}

function TimePollForm({
    guildId,
    poll,
    onSuccess,
}: {
    guildId: string;
    poll?: Poll;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const parsedDatesFromPoll = (poll?.options || [])
        .map((option) => parseTimePollOptionDate(option))
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => a.getTime() - b.getTime());
    const firstPollSlot = parsedDatesFromPoll[0] ?? null;
    const lastPollSlot = parsedDatesFromPoll[parsedDatesFromPoll.length - 1] ?? null;
    const inferredEndForRange = lastPollSlot ? addDays(startOfDay(lastPollSlot), 1) : null;
    const inferredWeekdays = parsedDatesFromPoll.length
        ? inferIncludedWeekdaysFromSlots(parsedDatesFromPoll)
        : [0, 1, 2, 3, 4, 5, 6];
    const inferredDayWindows = parsedDatesFromPoll.length
        ? inferDayWindowsFromSlots(parsedDatesFromPoll, 60)
        : createDefaultDayWindows(9, 0, 21, 0);
    const inferredUseCustomDailyWindows =
        parsedDatesFromPoll.length > 0 && !areEnabledDayWindowsUniform(inferredDayWindows);

    const [formData, setFormData] = useState({
        question: poll?.question || "When works best for everyone?",
        description: poll?.description || "Select all times that work for you",
        channelId: poll?.channelId || "",
        durationMinutes: 60,
        startDate: firstPollSlot ? startOfDay(firstPollSlot) : new Date(),
        endDate: inferredEndForRange || addDays(new Date(), 7),
        startHour: firstPollSlot ? firstPollSlot.getHours() : 9,
        startMinute: firstPollSlot ? firstPollSlot.getMinutes() : 0,
        endHour: lastPollSlot ? addMinutes(lastPollSlot, 60).getHours() : 21,
        endMinute: lastPollSlot ? addMinutes(lastPollSlot, 60).getMinutes() : 0,
        slotIntervalMinutes: 60,
        includeWeekdays: inferredWeekdays,
        useCustomDailyWindows: inferredUseCustomDailyWindows,
        dayWindows: inferredDayWindows as DayTimeWindows,
        timeSlots: [] as string[],
        allowMultipleVotes: true,
        maxVotesPerUser: null as number | null,
        isAnonymous: false,
        endTime: poll?.endTime ? new Date(poll.endTime) : null,
        mentionOnCreate: poll?.mentionOnCreate ?? false,
        mentionRoleIds: poll?.mentionRoleIds || [] as string[],
        allowedRoleIds: poll?.allowedRoleIds || [] as string[],
    });

    // Generate time slots based on settings
    function generateTimeSlots(): string[] {
        const slots: string[] = [];
        const start = startOfDay(formData.startDate);
        const end = startOfDay(formData.endDate);

        for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
            const dayOfWeek = d.getDay();
            let window: DayTimeWindow | null = null;

            if (formData.useCustomDailyWindows) {
                const configured = formData.dayWindows[dayOfWeek];
                if (!configured?.enabled) {
                    continue;
                }
                window = configured;
            } else {
                if (!formData.includeWeekdays.includes(dayOfWeek)) {
                    continue;
                }
                window = {
                    enabled: true,
                    startHour: formData.startHour,
                    startMinute: formData.startMinute,
                    endHour: formData.endHour,
                    endMinute: formData.endMinute,
                };
            }

            const startMinutes = window.startHour * 60 + window.startMinute;
            const endMinutes = window.endHour * 60 + window.endMinute;
            if (endMinutes <= startMinutes) {
                continue;
            }

            let cursor = setMinutes(setHours(new Date(d), window.startHour), window.startMinute);
            const limit = setMinutes(setHours(new Date(d), window.endHour), window.endMinute);
            while (cursor < limit) {
                slots.push(cursor.toISOString());
                if (slots.length >= MAX_TIME_POLL_SLOTS) {
                    return slots;
                }
                cursor = addMinutes(cursor, formData.slotIntervalMinutes);
            }
        }
        return slots;
    }

    // Calculate days between start and end dates
    const daysBetween = Math.ceil(
        (formData.endDate.getTime() - formData.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
    ) + 1;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.channelId) {
            toast.error("Channel is required");
            return;
        }

        if (formData.useCustomDailyWindows) {
            const enabledWindows = Object.values(formData.dayWindows).filter((window) => window.enabled);
            if (enabledWindows.length === 0) {
                toast.error("Enable at least one weekday window");
                return;
            }
            const invalidWindow = enabledWindows.find((window) => {
                const startMinutes = window.startHour * 60 + window.startMinute;
                const endMinutes = window.endHour * 60 + window.endMinute;
                return endMinutes <= startMinutes;
            });
            if (invalidWindow) {
                toast.error("Each enabled weekday must have an end time after start time");
                return;
            }
        } else {
            if (formData.includeWeekdays.length === 0) {
                toast.error("Select at least one day of the week");
                return;
            }

            const startMinutes = formData.startHour * 60 + formData.startMinute;
            const endMinutes = formData.endHour * 60 + formData.endMinute;
            if (endMinutes <= startMinutes) {
                toast.error("Latest time must be after earliest time");
                return;
            }
        }

        setSaving(true);

        try {
            const timeSlots = generateTimeSlots();
            if (timeSlots.length === 0) {
                toast.error("No time slots generated. Adjust date/time settings.");
                setSaving(false);
                return;
            }
            if (timeSlots.length >= MAX_TIME_POLL_SLOTS) {
                toast.error(`Too many slots generated (max ${MAX_TIME_POLL_SLOTS}). Narrow the range or increase interval.`);
                setSaving(false);
                return;
            }
            
            const url = poll
                ? `/api/guilds/${guildId}/polls/${poll.id}`
                : `/api/guilds/${guildId}/polls`;
            const method = poll ? "PATCH" : "POST";

            const payload = {
                question: formData.question,
                description: formData.description,
                channelId: formData.channelId,
                type: "TIME",
                allowMultipleVotes: formData.allowMultipleVotes,
                maxVotesPerUser: formData.allowMultipleVotes ? formData.maxVotesPerUser || undefined : undefined,
                isAnonymous: formData.isAnonymous,
                mentionOnCreate: formData.mentionOnCreate,
                mentionRoleIds: formData.mentionRoleIds.length > 0 ? formData.mentionRoleIds : undefined,
                allowedRoleIds: formData.allowedRoleIds.length > 0 ? formData.allowedRoleIds : undefined,
                endTime: formData.endTime?.toISOString() || undefined,
                timeSlots,
                durationMinutes: formData.durationMinutes,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to save time poll");
                return;
            }

            toast.success(poll ? "Time poll updated" : "Time poll created");
            onSuccess();
        } catch (error) {
            console.error("Error saving time poll:", error);
            toast.error("Failed to save time poll");
        } finally {
            setSaving(false);
        }
    }

    const previewSlots = generateTimeSlots();
    const enabledCustomWindows = WEEKDAY_OPTIONS
        .filter((weekday) => formData.dayWindows[weekday.value]?.enabled)
        .map((weekday) => ({
            label: weekday.label,
            window: formData.dayWindows[weekday.value],
        }));

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
                <div className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <p className="font-medium text-blue-900 dark:text-blue-200">
                            Time Poll
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Find the best time for your event. Members can select all times that work for them.
                            The system will show which time works for the most people.
                        </p>
                    </div>
                </div>
            </div>

            {/* Question */}
            <div className="space-y-2">
                <Label htmlFor="time-question">Question</Label>
                <Input
                    id="time-question"
                    value={formData.question}
                    onChange={(e) =>
                        setFormData({ ...formData, question: e.target.value })
                    }
                    placeholder="When works best for everyone?"
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="time-description">Description</Label>
                <Textarea
                    id="time-description"
                    value={formData.description}
                    onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Select all times that work for you"
                    rows={2}
                />
            </div>

            {/* Channel */}
            <div className="space-y-2">
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

            {/* Duration */}
            <div className="space-y-2">
                <Label>Event Duration</Label>
                <Select
                    value={formData.durationMinutes.toString()}
                    onValueChange={(value) =>
                        setFormData({
                            ...formData,
                            durationMinutes: parseInt(value),
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Start Date</Label>
                    <DatePicker
                        value={formData.startDate}
                        onChange={(date) =>
                            setFormData({ ...formData, startDate: date || new Date() })
                        }
                        placeholder="Select start date"
                    />
                </div>
                <div className="space-y-2">
                    <Label>End Date</Label>
                    <DatePicker
                        value={formData.endDate}
                        onChange={(date) =>
                            setFormData({ ...formData, endDate: date || addDays(new Date(), 7) })
                        }
                        placeholder="Select end date"
                        minDate={formData.startDate}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                    <Label>Different Times Per Day</Label>
                    <HelperText>
                        Configure separate time windows for each weekday.
                    </HelperText>
                </div>
                <Switch
                    checked={formData.useCustomDailyWindows}
                    onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                            ...prev,
                            useCustomDailyWindows: checked,
                            dayWindows: checked
                                ? prev.dayWindows
                                : createDefaultDayWindows(
                                    prev.startHour,
                                    prev.startMinute,
                                    prev.endHour,
                                    prev.endMinute
                                ),
                        }))
                    }
                />
            </div>

            {!formData.useCustomDailyWindows ? (
                <>
                    {/* Time Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Earliest Time</Label>
                            <Select
                                value={formData.startHour.toString()}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        startHour: parseInt(value, 10),
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Latest Time</Label>
                            <Select
                                value={formData.endHour.toString()}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        endHour: parseInt(value, 10),
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Minute</Label>
                            <Select
                                value={formData.startMinute.toString()}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        startMinute: parseInt(value, 10),
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">:00</SelectItem>
                                    <SelectItem value="15">:15</SelectItem>
                                    <SelectItem value="30">:30</SelectItem>
                                    <SelectItem value="45">:45</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>End Minute</Label>
                            <Select
                                value={formData.endMinute.toString()}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        endMinute: parseInt(value, 10),
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">:00</SelectItem>
                                    <SelectItem value="15">:15</SelectItem>
                                    <SelectItem value="30">:30</SelectItem>
                                    <SelectItem value="45">:45</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Days of Week</Label>
                        <div className="flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((weekday) => {
                                const selected = formData.includeWeekdays.includes(weekday.value);
                                return (
                                    <Button
                                        key={weekday.value}
                                        type="button"
                                        size="sm"
                                        variant={selected ? "default" : "outline"}
                                        onClick={() => {
                                            const current = new Set(formData.includeWeekdays);
                                            if (current.has(weekday.value)) {
                                                current.delete(weekday.value);
                                            } else {
                                                current.add(weekday.value);
                                            }
                                            setFormData({
                                                ...formData,
                                                includeWeekdays: [...current].sort((a, b) => a - b),
                                            });
                                        }}
                                    >
                                        {weekday.label}
                                    </Button>
                                );
                            })}
                        </div>
                        <HelperText>
                            Pick which days should appear in the poll.
                        </HelperText>
                    </div>
                </>
            ) : (
                <div className="space-y-2">
                    <Label>Daily Time Windows</Label>
                    <div className="space-y-2 rounded-md border p-3">
                        {WEEKDAY_OPTIONS.map((weekday) => {
                            const window = formData.dayWindows[weekday.value];
                            return (
                                <div key={weekday.value} className="grid grid-cols-[90px_1fr_1fr] items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={window.enabled}
                                            onCheckedChange={(checked) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    dayWindows: {
                                                        ...prev.dayWindows,
                                                        [weekday.value]: {
                                                            ...prev.dayWindows[weekday.value],
                                                            enabled: checked,
                                                        },
                                                    },
                                                }))
                                            }
                                        />
                                        <span className="text-sm font-medium">{weekday.label}</span>
                                    </div>
                                    <TimePicker
                                        value={formatTimeInput(window.startHour, window.startMinute)}
                                        disabled={!window.enabled}
                                        onChange={(value) => {
                                            const parsed = parseTimeInput(value ?? "");
                                            if (!parsed) return;
                                            setFormData((prev) => ({
                                                ...prev,
                                                dayWindows: {
                                                    ...prev.dayWindows,
                                                    [weekday.value]: {
                                                        ...prev.dayWindows[weekday.value],
                                                        startHour: parsed.hour,
                                                        startMinute: parsed.minute,
                                                    },
                                                },
                                            }));
                                        }}
                                        placeholder="Start"
                                    />
                                    <TimePicker
                                        value={formatTimeInput(window.endHour, window.endMinute)}
                                        disabled={!window.enabled}
                                        onChange={(value) => {
                                            const parsed = parseTimeInput(value ?? "");
                                            if (!parsed) return;
                                            setFormData((prev) => ({
                                                ...prev,
                                                dayWindows: {
                                                    ...prev.dayWindows,
                                                    [weekday.value]: {
                                                        ...prev.dayWindows[weekday.value],
                                                        endHour: parsed.hour,
                                                        endMinute: parsed.minute,
                                                    },
                                                },
                                            }));
                                        }}
                                        placeholder="End"
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <HelperText>
                        Example: Monday 21:00-22:00, Tuesday 20:00-23:00, Wednesday 17:00-19:00.
                    </HelperText>
                </div>
            )}

            <div className="space-y-2">
                <Label>Slot Interval</Label>
                <Select
                    value={formData.slotIntervalMinutes.toString()}
                    onValueChange={(value) =>
                        setFormData({
                            ...formData,
                            slotIntervalMinutes: parseInt(value, 10),
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TIME_SLOT_INTERVALS.map((interval) => (
                            <SelectItem key={interval} value={interval.toString()}>
                                Every {interval} min
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-4 bg-muted/50">
                <Label className="mb-2 block">Preview</Label>
                <p className="text-sm text-muted-foreground">
                    This will create a poll with{" "}
                    <strong>{previewSlots.length} time slots</strong> across{" "}
                    {daysBetween}{" "}
                    days
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    From {format(formData.startDate, "MMM d")} to{" "}
                    {format(formData.endDate, "MMM d")}
                    {formData.useCustomDailyWindows
                        ? `, custom weekday windows, every ${formData.slotIntervalMinutes} minutes`
                        : `, ${formatTwelveHourTime(formData.startHour, formData.startMinute)} - ${formatTwelveHourTime(formData.endHour, formData.endMinute)}, every ${formData.slotIntervalMinutes} minutes`}
                </p>
                {formData.useCustomDailyWindows && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {enabledCustomWindows.length > 0
                            ? enabledCustomWindows
                                  .map(({ label, window }) =>
                                      `${label} ${formatTwelveHourTime(window.startHour, window.startMinute)}-${formatTwelveHourTime(window.endHour, window.endMinute)}`
                                  )
                                  .join(" | ")
                            : "No weekdays enabled"}
                    </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                    Discord timestamps are used in poll options so each viewer sees their own local time.
                </p>
            </div>

            {/* Settings */}
            <div className="space-y-4 border-t pt-4">
                <Label className="text-base">Settings</Label>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Allow Multiple Selections</Label>
                        <HelperText>Let voters pick more than one time slot</HelperText>
                    </div>
                    <Switch
                        checked={formData.allowMultipleVotes}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, allowMultipleVotes: checked })
                        }
                    />
                </div>

                {formData.allowMultipleVotes && (
                    <div className="space-y-2 pl-6">
                        <Label>Max Votes Per User (optional)</Label>
                        <Input
                            type="number"
                            min={1}
                            max={25}
                            value={formData.maxVotesPerUser || ""}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    maxVotesPerUser: e.target.value ? parseInt(e.target.value, 10) : null,
                                })
                            }
                            placeholder="Leave empty for unlimited"
                            className="w-48"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Anonymous Voting</Label>
                        <HelperText>Hide who voted for what</HelperText>
                    </div>
                    <Switch
                        checked={formData.isAnonymous}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, isAnonymous: checked })
                        }
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Mention on Create</Label>
                        <HelperText>Send a mention when the poll is posted</HelperText>
                    </div>
                    <Switch
                        checked={formData.mentionOnCreate}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, mentionOnCreate: checked })
                        }
                    />
                </div>

                {formData.mentionOnCreate && (
                    <div className="space-y-2 pl-6">
                        <Label>Mention Roles</Label>
                        <RoleMultiSelect
                            guildId={guildId}
                            values={formData.mentionRoleIds}
                            onChange={(values) =>
                                setFormData({ ...formData, mentionRoleIds: values })
                            }
                            placeholder="Select roles to mention..."
                        />
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t pt-4">
                <Label>
                    <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Voting End Time (optional)
                    </span>
                </Label>
                <DateTimePicker
                    value={formData.endTime}
                    onChange={(date) =>
                        setFormData({ ...formData, endTime: date })
                    }
                    placeholder="Select end date and time"
                />
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : poll ? "Update Time Poll" : "Create Time Poll"}
                </Button>
            </DialogFooter>
        </form>
    );
}

function PollsList({ guildId, status }: { guildId: string; status: "active" | "ended" }) {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
    const [viewingPoll, setViewingPoll] = useState<Poll | null>(null);

    useEffect(() => {
        fetchPolls();
    }, [guildId, status]);

    async function fetchPolls() {
        try {
            const params = new URLSearchParams();
            params.set("status", status);

            const res = await fetch(`/api/guilds/${guildId}/polls?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPolls(data);
            }
        } catch (error) {
            console.error("Error fetching polls:", error);
        } finally {
            setLoading(false);
        }
    }

    async function deletePoll(pollId: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/polls/${pollId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setPolls(polls.filter((p) => p.id !== pollId));
                toast.success("Poll deleted");
            } else {
                toast.error("Failed to delete poll");
            }
        } catch (error) {
            console.error("Error deleting poll:", error);
            toast.error("Failed to delete poll");
        }
    }

    async function closePoll(pollId: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/polls/${pollId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ closed: true }),
            });
            if (res.ok) {
                toast.success("Poll closed");
                fetchPolls();
            } else {
                toast.error("Failed to close poll");
            }
        } catch (error) {
            console.error("Error closing poll:", error);
            toast.error("Failed to close poll");
        }
    }

    const filteredPolls = polls.filter(
        (p) =>
            p.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading polls...
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
                                {status === "active" ? "Active Polls" : "Ended Polls"}
                            </CardTitle>
                            <CardDescription>
                                {polls.length} poll{polls.length !== 1 ? "s" : ""}
                            </CardDescription>
                        </div>
                        <Input
                            placeholder="Search polls..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredPolls.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">
                                {searchTerm
                                    ? "No polls match your search"
                                    : status === "active"
                                    ? "No active polls"
                                    : "No ended polls"}
                            </p>
                            <p className="text-sm">
                                {searchTerm
                                    ? "Try a different search term"
                                    : status === "active"
                                    ? "Create your first poll to get started"
                                    : "Closed polls will appear here"}
                            </p>
                        </div>
                    ) : (
                        <FadeInStagger className="space-y-4">
                            {filteredPolls.map((poll) => (
                                <FadeInItem key={poll.id}>
                                    <PollCard
                                        poll={poll}
                                        onEdit={() => setEditingPoll(poll)}
                                        onDelete={() => deletePoll(poll.id)}
                                        onClose={() => closePoll(poll.id)}
                                        onView={() => setViewingPoll(poll)}
                                    />
                                </FadeInItem>
                            ))}
                        </FadeInStagger>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog
                open={!!editingPoll}
                onOpenChange={(open) => !open && setEditingPoll(null)}
            >
                <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6">
                    <DialogHeader>
                        <DialogTitle>Edit Poll</DialogTitle>
                    </DialogHeader>
                    {editingPoll && (
                        editingPoll.type === "TIME" ? (
                            <TimePollForm
                                guildId={guildId}
                                poll={editingPoll}
                                onSuccess={() => {
                                    setEditingPoll(null);
                                    fetchPolls();
                                }}
                            />
                        ) : (
                            <StandardPollForm
                                guildId={guildId}
                                poll={editingPoll}
                                pollType={editingPoll.type === "ANONYMOUS" ? "ANONYMOUS" : "STANDARD"}
                                onSuccess={() => {
                                    setEditingPoll(null);
                                    fetchPolls();
                                }}
                            />
                        )
                    )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Results Dialog */}
            <Dialog
                open={!!viewingPoll}
                onOpenChange={(open) => !open && setViewingPoll(null)}
            >
                <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6">
                    <DialogHeader>
                        <DialogTitle>Poll Results</DialogTitle>
                        <DialogDescription>{viewingPoll?.question}</DialogDescription>
                    </DialogHeader>
                    {viewingPoll && <PollResults poll={viewingPoll} />}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function PollCard({
    poll,
    onEdit,
    onDelete,
    onClose,
    onView,
}: {
    poll: Poll;
    onEdit: () => void;
    onDelete: () => void;
    onClose: () => void;
    onView: () => void;
}) {
    const isEnded = poll.endTime && new Date(poll.endTime) < new Date();
    const { rolesById } = useDiscordData(poll.guildId);

    return (
        <Card className="overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg truncate">
                                {poll.question}
                            </h3>
                            <Badge
                                variant={poll.type === "TIME" ? "default" : "secondary"}
                            >
                                {poll.type === "TIME"
                                    ? "Time Poll"
                                    : poll.type === "ANONYMOUS"
                                    ? "Anonymous"
                                    : "Standard"}
                            </Badge>
                            {poll.isAnonymous && (
                                <Badge variant="outline" className="gap-1">
                                    <EyeOff className="h-3 w-3" />
                                    Hidden
                                </Badge>
                            )}
                            {isEnded && <Badge variant="destructive">Ended</Badge>}
                        </div>

                        {poll.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {poll.description}
                            </p>
                        )}
                        
                        {poll.allowedRoleIds && poll.allowedRoleIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-2">
                                <span className="text-xs text-muted-foreground mr-1">Restricted to:</span>
                                {poll.allowedRoleIds.map(roleId => {
                                    const role = rolesById.get(roleId);
                                    const color = role?.color ?? '#000000';
                                    const textColor = color !== '#000000' ? String(color) : undefined;
                                    return (
                                        <Badge key={roleId} variant="secondary" className="text-xs font-normal" style={{ backgroundColor: textColor ? `${textColor}20` : undefined, color: textColor }}>
                                            {role?.name || roleId}
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(poll.createdAt), "MMM d, yyyy")}
                            </span>
                            {poll.endTime && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    Ends {format(new Date(poll.endTime), "MMM d, h:mm a")}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {poll.voteCount || 0} votes
                            </span>
                        </div>

                            {poll.options && poll.options.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {poll.options.slice(0, 3).map((option) => (
                                    <Badge key={option.id} variant="outline">
                                        {option.emoji && <span className="mr-1">{option.emoji}</span>}
                                        {getTimePollOptionLabel(poll, option)}
                                    </Badge>
                                ))}
                                {poll.options.length > 3 && (
                                    <Badge variant="outline">
                                        +{poll.options.length - 3} more
                                    </Badge>
                                )}
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
                            <DropdownMenuItem onClick={onView}>
                                <BarChart className="h-4 w-4 mr-2" />
                                View Results
                            </DropdownMenuItem>
                            {!isEnded && (
                                <DropdownMenuItem onClick={onEdit}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                            )}
                            {!isEnded && (
                                <DropdownMenuItem onClick={onClose}>
                                    <Lock className="h-4 w-4 mr-2" />
                                    Close Poll
                                </DropdownMenuItem>
                            )}
                            <ConfirmDeleteDialog
                                onConfirm={onDelete}
                                title="Delete Poll?"
                                description="Are you sure you want to delete this poll? This action cannot be undone."
                                confirmText="Delete Poll"
                            >
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
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

function PollResults({ poll }: { poll: Poll }) {
    const [results, setResults] = useState<{
        option: PollOption;
        votes: number;
        voterUsers?: { userId: string; displayName: string; avatarUrl: string | null }[];
    }[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);
    const [showVoters, setShowVoters] = useState(poll.type !== "ANONYMOUS");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResults();
    }, [poll.id]);

    async function fetchResults() {
        try {
            const res = await fetch(`/api/guilds/${poll.guildId}/polls/${poll.id}/results`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results);
                setTotalVotes(data.totalVotes);
                setShowVoters(data.showVoters ?? poll.type !== "ANONYMOUS");
            }
        } catch (error) {
            console.error("Error fetching results:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="py-8 text-center">Loading results...</div>;
    }

    const maxVotes = Math.max(...results.map((r) => r.votes), 1);

    return (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
                Total votes: <strong>{totalVotes}</strong>
            </div>

            <div className="space-y-3">
                {results.map((result) => {
                    const percentage = totalVotes > 0 ? (result.votes / totalVotes) * 100 : 0;
                    const isWinner = result.votes === maxVotes && result.votes > 0;

                    return (
                        <div key={result.option.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    {result.option.emoji && <span>{result.option.emoji}</span>}
                                    {getTimePollOptionLabel(poll, result.option)}
                                    {isWinner && <Badge className="ml-2">Winner</Badge>}
                                </span>
                                <span className="text-muted-foreground">
                                    {result.votes} votes ({percentage.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${
                                        isWinner ? "bg-primary" : "bg-muted-foreground/50"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            {showVoters && result.voterUsers && result.voterUsers.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                    Voters: {result.voterUsers.slice(0, 8).map((user) => user.displayName).join(", ")}
                                    {result.voterUsers.length > 8 ? ` +${result.voterUsers.length - 8} more` : ""}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {results.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No votes yet
                </div>
            )}
        </div>
    );
}

function PollTemplatesTab({ guildId }: { guildId: string }) {
    const [templates, setTemplates] = useState<PollTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<PollTemplate | null>(null);
    const [savingTemplate, setSavingTemplate] = useState(false);

    useEffect(() => {
        fetchTemplates();
    }, [guildId]);

    async function fetchTemplates() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/polls/templates`);
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
            const res = await fetch(`/api/guilds/${guildId}/polls/templates/${templateId}`, {
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
            const res = await fetch(`/api/guilds/${guildId}/polls/templates/${editingTemplate.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingTemplate),
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
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Poll Templates</CardTitle>
                            <CardDescription>
                                Save common poll configurations for quick creation.
                            </CardDescription>
                        </div>
                        <Button onClick={() => setShowCreate(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Template
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {templates.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No templates yet.</p>
                            <p className="text-sm">
                                Create a template to quickly make similar polls.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead>Options</TableHead>
                                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">
                                            {template.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {template.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{template.question || "-"}</TableCell>
                                        <TableCell>
                                            {template.defaultOptions?.length || 0} options
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

            {/* Create Template Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Poll Template</DialogTitle>
                    </DialogHeader>
                    <CreateTemplateForm
                        guildId={guildId}
                        onSuccess={() => {
                            setShowCreate(false);
                            fetchTemplates();
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Poll Template</DialogTitle>
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
                                <Input
                                    value={editingTemplate.description ?? ""}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Question</Label>
                                <Input
                                    value={editingTemplate.question ?? ""}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, question: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                    value={editingTemplate.type}
                                    onValueChange={(value: "STANDARD" | "TIME" | "ANONYMOUS") =>
                                        setEditingTemplate({ ...editingTemplate, type: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="STANDARD">Standard</SelectItem>
                                        <SelectItem value="TIME">Time</SelectItem>
                                        <SelectItem value="ANONYMOUS">Anonymous</SelectItem>
                                    </SelectContent>
                                </Select>
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

function CreateTemplateForm({
    guildId,
    onSuccess,
}: {
    guildId: string;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        question: "",
        pollDescription: "",
        type: "STANDARD" as const,
        allowMultipleVotes: false,
        maxVotesPerUser: null as number | null,
        allowCustomOptions: false,
        defaultOptions: ["", ""],
    });

    function addOption() {
        setFormData({
            ...formData,
            defaultOptions: [...formData.defaultOptions, ""],
        });
    }

    function updateOption(index: number, value: string) {
        const newOptions = [...formData.defaultOptions];
        newOptions[index] = value;
        setFormData({ ...formData, defaultOptions: newOptions });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Template name is required");
            return;
        }

        setSaving(true);

        try {
            const res = await fetch(`/api/guilds/${guildId}/polls/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    defaultOptions: formData.defaultOptions.filter((o) => o.trim()),
                }),
            });

            if (res.ok) {
                toast.success("Template created");
                onSuccess();
            } else {
                toast.error("Failed to create template");
            }
        } catch (error) {
            console.error("Error creating template:", error);
            toast.error("Failed to create template");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="template-name">
                    Template Name <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Meeting Time Poll"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="template-desc">Description</Label>
                <Input
                    id="template-desc"
                    value={formData.description}
                    onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="What this template is for..."
                />
            </div>

            <div className="space-y-2">
                <Label>Poll Type</Label>
                <Select
                    value={formData.type}
                    onValueChange={(value) =>
                        setFormData({ ...formData, type: value as any })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="ANONYMOUS">Anonymous</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Default Question</Label>
                <Input
                    value={formData.question}
                    onChange={(e) =>
                        setFormData({ ...formData, question: e.target.value })
                    }
                    placeholder="e.g., What's your preference?"
                />
            </div>

            <div className="space-y-2">
                <Label>Default Options</Label>
                {formData.defaultOptions.map((option, index) => (
                    <Input
                        key={index}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                    />
                ))}
                <Button type="button" variant="outline" onClick={addOption} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                </Button>
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
