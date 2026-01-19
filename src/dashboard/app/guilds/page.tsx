"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

interface Guild {
    id: string;
    name: string;
    icon: string | null;
    iconUrl: string | null;
    hasManagePermission: boolean;
    botPresent: boolean;
}

export default function GuildsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
            return;
        }

        if (status === "authenticated") {
            fetchGuilds();
        }
    }, [status, router]);

    async function fetchGuilds() {
        try {
            const res = await fetch("/api/guilds");
            if (!res.ok) {
                throw new Error("Failed to fetch guilds");
            }
            const data = await res.json();
            setGuilds(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    if (status === "loading" || loading) {
        return (
            <main style={styles.container}>
                <p style={styles.loadingText}>Loading your servers...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main style={styles.container}>
                <p style={styles.errorText}>Error: {error}</p>
            </main>
        );
    }

    return (
        <main style={styles.container}>
            <h1 style={styles.title}>Select a Server</h1>
            <p style={styles.subtitle}>Choose a server to manage with ΙΧΘΥΣ</p>

            <div style={styles.grid}>
                {guilds.map((guild) => (
                    <div
                        key={guild.id}
                        style={styles.card}
                        onClick={() => router.push(`/dashboard/${guild.id}`)}
                    >
                        {guild.iconUrl ? (
                            <Image
                                src={guild.iconUrl}
                                alt={guild.name}
                                width={64}
                                height={64}
                                style={styles.guildIcon}
                            />
                        ) : (
                            <div style={styles.guildIconPlaceholder}>
                                {guild.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <h3 style={styles.guildName}>{guild.name}</h3>
                        <button style={styles.manageButton}>
                            {guild.botPresent ? "Manage" : "Setup"}
                        </button>
                    </div>
                ))}
            </div>

            {guilds.length === 0 && (
                <p style={styles.emptyText}>
                    No servers found. Make sure you have Manage Server permissions.
                </p>
            )}
        </main>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: "100vh",
        padding: "40px 20px",
        maxWidth: "1200px",
        margin: "0 auto",
    },
    title: {
        fontSize: "2rem",
        fontWeight: "bold",
        marginBottom: "8px",
        textAlign: "center",
    },
    subtitle: {
        color: "#B9BBBE",
        textAlign: "center",
        marginBottom: "40px",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "20px",
    },
    card: {
        backgroundColor: "#2F3136",
        borderRadius: "12px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        transition: "transform 0.2s, background-color 0.2s",
    },
    guildIcon: {
        borderRadius: "50%",
        marginBottom: "12px",
    },
    guildIconPlaceholder: {
        width: "64px",
        height: "64px",
        borderRadius: "50%",
        backgroundColor: "#5865F2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
        fontWeight: "bold",
        marginBottom: "12px",
    },
    guildName: {
        fontSize: "1rem",
        fontWeight: "600",
        marginBottom: "12px",
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
    },
    manageButton: {
        backgroundColor: "#5865F2",
        color: "white",
        border: "none",
        borderRadius: "4px",
        padding: "8px 16px",
        cursor: "pointer",
        fontSize: "0.875rem",
        fontWeight: "500",
    },
    loadingText: {
        textAlign: "center",
        color: "#B9BBBE",
        marginTop: "100px",
    },
    errorText: {
        textAlign: "center",
        color: "#ED4245",
        marginTop: "100px",
    },
    emptyText: {
        textAlign: "center",
        color: "#B9BBBE",
        marginTop: "40px",
    },
};
