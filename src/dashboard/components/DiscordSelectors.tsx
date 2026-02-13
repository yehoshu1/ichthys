"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { MultiSelect } from "./ui/multi-select";
import { cn } from "@/lib/utils";
import { useDiscordData } from "./useDiscordData";
import { AlertCircle } from "lucide-react";

function ErrorDisplay({ error, className }: { error: string; className?: string }) {
    const isBotNotInServer = error.includes("Bot is not in this server") || error.includes("404");
    
    return (
        <div className={cn(
            "w-full rounded-md px-3 py-2 text-sm",
            isBotNotInServer 
                ? "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
                : "bg-destructive/10 border border-destructive/20 text-destructive",
            className
        )}>
            <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    {isBotNotInServer ? (
                        <>
                            <p className="font-medium">Bot not in server</p>
                            <p className="text-xs mt-1 opacity-90">
                                The bot needs to be added to this server to fetch roles and channels.
                            </p>
                        </>
                    ) : (
                        <p className="font-medium">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

const NONE_OPTION = "__none__";

function normalizeId(value: string | null | undefined): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeIdList(values: Array<string | null | undefined>): string[] {
    const unique = new Set<string>();
    for (const value of values) {
        const normalized = normalizeId(value);
        if (!normalized) continue;
        unique.add(normalized);
    }
    return [...unique];
}

function toSelectValue(value: string): string {
    const normalized = normalizeId(value);
    return normalized || NONE_OPTION;
}

function fromSelectValue(value: string): string {
    return value === NONE_OPTION ? "" : normalizeId(value);
}

const TEXT_CHANNEL_TYPES = [0, 5, 10, 11, 12];
const VOICE_CHANNEL_TYPES = [2, 13];

function formatChannelLabel(channel: { name: string; type: number }): string {
    if (channel.type === 13) {
        return `🎤 ${channel.name}`;
    }
    if (VOICE_CHANNEL_TYPES.includes(channel.type)) {
        return `🔊 ${channel.name}`;
    }
    return `#${channel.name}`;
}

interface RoleSelectProps {
    guildId: string;
    value: string;
    onChange: (value: string) => void;
    allowNone?: boolean;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function RoleSelect({
    guildId,
    value,
    onChange,
    allowNone = true,
    placeholder = "Select a role",
    disabled = false,
    className
}: RoleSelectProps) {
    const { data, loading, error, rolesById } = useDiscordData(guildId);
    const roles = data.roles;
    const normalizedValue = allowNone ? toSelectValue(value) : normalizeId(value);

    // Find the selected role name for display
    const selectedRole = rolesById.get(normalizedValue);
    const displayValue = normalizedValue === NONE_OPTION 
        ? "None" 
        : selectedRole?.name;

    if (error) {
        return <ErrorDisplay error={error} className={className} />;
    }

    return (
        <Select
            value={normalizedValue}
            onValueChange={(nextValue) => onChange(fromSelectValue(nextValue))}
            disabled={loading || disabled}
        >
            <SelectTrigger className={cn("w-full", className)}>
                <SelectValue placeholder={loading ? "Loading roles..." : placeholder}>
                    {displayValue || placeholder}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {allowNone && <SelectItem value={NONE_OPTION}>None</SelectItem>}
                {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                        {role.name}
                    </SelectItem>
                ))}
                {roles.length === 0 && !loading && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No roles found
                    </div>
                )}
            </SelectContent>
        </Select>
    );
}

interface ChannelSelectProps {
    guildId: string;
    value: string;
    onChange: (value: string) => void;
    channelTypes?: number[];
    allowNone?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function ChannelSelect({
    guildId,
    value,
    onChange,
    channelTypes = TEXT_CHANNEL_TYPES,
    allowNone = true,
    placeholder = "Select a channel",
    disabled = false,
    className
}: ChannelSelectProps) {
    const { data, loading, error, channelsById } = useDiscordData(guildId);
    const channels = data.channels.filter((channel) => channelTypes.includes(channel.type));
    const normalizedValue = allowNone ? toSelectValue(value) : normalizeId(value);

    // Find the selected channel name for display
    const selectedChannel = channelsById.get(normalizedValue);
    const displayValue = normalizedValue === NONE_OPTION 
        ? "None" 
        : selectedChannel ? formatChannelLabel(selectedChannel) : undefined;

    if (error) {
        return <ErrorDisplay error={error} className={className} />;
    }

    return (
        <Select
            value={normalizedValue}
            onValueChange={(nextValue) => onChange(fromSelectValue(nextValue))}
            disabled={loading || disabled}
        >
            <SelectTrigger className={cn("w-full", className)}>
                <SelectValue placeholder={loading ? "Loading channels..." : placeholder}>
                    {displayValue || placeholder}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {allowNone && <SelectItem value={NONE_OPTION}>None</SelectItem>}
                {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                        {formatChannelLabel(channel)}
                    </SelectItem>
                ))}
                {channels.length === 0 && !loading && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No channels found
                    </div>
                )}
            </SelectContent>
        </Select>
    );
}

interface MultiSelectProps {
    guildId: string;
    values: string[];
    onChange: (values: string[]) => void;
    channelTypes?: number[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function RoleMultiSelect({
    guildId,
    values,
    onChange,
    placeholder = "Select roles",
    disabled = false,
    className,
}: MultiSelectProps) {
    const { data, loading, error } = useDiscordData(guildId);
    const options = data.roles.map((role) => ({ value: role.id, label: role.name }));

    if (error) {
        return <ErrorDisplay error={error} className={className} />;
    }

    return (
        <MultiSelect
            options={options}
            values={normalizeIdList(values)}
            onChange={(nextValues) => onChange(normalizeIdList(nextValues))}
            placeholder={placeholder}
            searchPlaceholder="Search roles..."
            emptyText="No roles found."
            loading={loading}
            disabled={disabled}
            className={className}
        />
    );
}

export function ChannelMultiSelect({
    guildId,
    values,
    onChange,
    channelTypes = TEXT_CHANNEL_TYPES,
    placeholder = "Select channels",
    disabled = false,
    className,
}: MultiSelectProps) {
    const { data, loading, error } = useDiscordData(guildId);
    const options = data.channels
        .filter((channel) => channelTypes.includes(channel.type))
        .map((channel) => ({ value: channel.id, label: formatChannelLabel(channel) }));

    if (error) {
        return <ErrorDisplay error={error} className={className} />;
    }

    return (
        <MultiSelect
            options={options}
            values={normalizeIdList(values)}
            onChange={(nextValues) => onChange(normalizeIdList(nextValues))}
            placeholder={placeholder}
            searchPlaceholder="Search channels..."
            emptyText="No channels found."
            loading={loading}
            disabled={disabled}
            className={className}
        />
    );
}

export function VoiceChannelSelect(props: Omit<ChannelSelectProps, "channelTypes">) {
    return <ChannelSelect {...props} channelTypes={VOICE_CHANNEL_TYPES} />;
}
