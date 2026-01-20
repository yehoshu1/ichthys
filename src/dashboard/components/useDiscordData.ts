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

export function useDiscordData(guildId: string) {
    const [data, setData] = useState<DiscordData>({ roles: [], channels: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!guildId) return;
        let active = true;
        setLoading(true);
        fetch(`/api/guilds/${guildId}/discord-data`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch discord data");
                return res.json();
            })
            .then((payload) => {
                if (!active) return;
                setData(payload);
            })
            .catch((error) => {
                console.error("Failed to fetch discord data:", error);
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

    return { data, rolesById, channelsById, loading };
}
