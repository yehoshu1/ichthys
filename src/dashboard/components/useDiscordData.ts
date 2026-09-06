"use client";

import { useEffect, useMemo, useState } from "react";

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

const EMPTY_DISCORD_DATA: DiscordData = { roles: [], channels: [] };
const CLIENT_CACHE_TTL_MS = 60_000;
const discordDataCache = new Map<string, { data: DiscordData; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<DiscordData>>();

function getCachedDiscordData(guildId: string): DiscordData | null {
    const cached = discordDataCache.get(guildId);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
        discordDataCache.delete(guildId);
        return null;
    }

    return cached.data;
}

async function fetchDiscordData(guildId: string): Promise<DiscordData> {
    const cached = getCachedDiscordData(guildId);
    if (cached) {
        return cached;
    }

    const existingRequest = inFlightRequests.get(guildId);
    if (existingRequest) {
        return existingRequest;
    }

    const request = (async () => {
        const res = await fetch(`/api/guilds/${guildId}/discord-data`, {
            cache: "no-store",
        });

        if (!res.ok) {
            let errorMessage = `Failed to fetch discord data (${res.status})`;
            try {
                const payload = await res.json() as { error?: string };
                if (payload.error) {
                    errorMessage = payload.error;
                }
            } catch {
                // Use default status-based message.
            }
            throw new Error(errorMessage);
        }

        const payload = await res.json() as DiscordData;
        const normalizedPayload: DiscordData = {
            roles: Array.isArray(payload.roles) ? payload.roles : [],
            channels: Array.isArray(payload.channels) ? payload.channels : [],
        };

        discordDataCache.set(guildId, {
            data: normalizedPayload,
            expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
        });

        return normalizedPayload;
    })().finally(() => {
        inFlightRequests.delete(guildId);
    });

    inFlightRequests.set(guildId, request);
    return request;
}

export function useDiscordData(guildId: string) {
    const [data, setData] = useState<DiscordData>(EMPTY_DISCORD_DATA);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!guildId) {
            setData(EMPTY_DISCORD_DATA);
            setError(null);
            setLoading(false);
            return;
        }

        const cached = getCachedDiscordData(guildId);
        if (cached) {
            setData(cached);
            setError(null);
            setLoading(false);
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);

        fetchDiscordData(guildId)
            .then((payload) => {
                if (!active) return;
                setData(payload);
                setError(null);
            })
            .catch((requestError) => {
                if (!active) return;
                const message = requestError instanceof Error
                    ? requestError.message
                    : "Failed to fetch discord data";
                setError(message);
                setData(EMPTY_DISCORD_DATA);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [guildId]);

    const rolesById = useMemo(() => {
        return new Map(data.roles.map((role) => [role.id, role]));
    }, [data.roles]);

    const channelsById = useMemo(() => {
        return new Map(data.channels.map((channel) => [channel.id, channel]));
    }, [data.channels]);

    return { data, rolesById, channelsById, loading, error };
}
