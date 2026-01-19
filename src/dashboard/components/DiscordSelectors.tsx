"use client";

import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";

interface Role {
    id: string;
    name: string;
    color: number;
    position: number;
}

interface Channel {
    id: string;
    name: string;
    type: number;
    position: number;
}

interface DiscordData {
    roles: Role[];
    channels: Channel[];
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
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDiscordData();
    }, [guildId]);

    async function fetchDiscordData() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/discord-data`);
            if (res.ok) {
                const data: DiscordData = await res.json();
                setRoles(data.roles);
            }
        } catch (error) {
            console.error("Failed to fetch roles:", error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={loading || disabled}
        >
            <SelectTrigger className={cn("w-full", className)}>
                <SelectValue placeholder={loading ? "Loading roles..." : placeholder} />
            </SelectTrigger>
            <SelectContent>
                {allowNone && <SelectItem value=" ">None</SelectItem>}
                {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                        {role.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

interface ChannelSelectProps {
    guildId: string;
    value: string;
    onChange: (value: string) => void;
    allowNone?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function ChannelSelect({
    guildId,
    value,
    onChange,
    allowNone = true,
    placeholder = "Select a channel",
    disabled = false,
    className
}: ChannelSelectProps) {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDiscordData();
    }, [guildId]);

    async function fetchDiscordData() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/discord-data`);
            if (res.ok) {
                const data: DiscordData = await res.json();
                setChannels(data.channels);
            }
        } catch (error) {
            console.error("Failed to fetch channels:", error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={loading || disabled}
        >
            <SelectTrigger className={cn("w-full", className)}>
                <SelectValue placeholder={loading ? "Loading channels..." : placeholder} />
            </SelectTrigger>
            <SelectContent>
                {allowNone && <SelectItem value=" ">None</SelectItem>}
                {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
