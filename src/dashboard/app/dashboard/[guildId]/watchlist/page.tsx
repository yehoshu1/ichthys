"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Badge } from "../../../../components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../../components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "../../../../components/ui/dialog";
import {
    Eye,
    Plus,
    Trash2,
    Pencil,
    Search,
    AlertTriangle,
    ShieldAlert,
    Info,
    Loader2,
    User,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Severity = "LOW" | "MEDIUM" | "HIGH";

interface WatchlistUser {
    userId: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
}

interface WatchlistEntry {
    id: string;
    guildId: string;
    userId: string;
    addedBy: string;
    reason: string;
    notes: string | null;
    severity: Severity;
    createdAt: string;
    updatedAt: string;
    user: WatchlistUser | null;
    addedByUser: WatchlistUser | null;
}

const SEVERITY_CONFIG: Record<
    Severity,
    { label: string; color: string; icon: React.FC<{ className?: string }> }
> = {
    LOW: {
        label: "Low",
        color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
        icon: Info,
    },
    MEDIUM: {
        label: "Medium",
        color: "bg-orange-500/15 text-orange-600 border-orange-500/30",
        icon: AlertTriangle,
    },
    HIGH: {
        label: "High",
        color: "bg-red-500/15 text-red-600 border-red-500/30",
        icon: ShieldAlert,
    },
};

function SeverityBadge({ severity }: { severity: Severity }) {
    const cfg = SEVERITY_CONFIG[severity];
    const Icon = cfg.icon;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
        >
            <Icon className="h-3 w-3" />
            {cfg.label}
        </span>
    );
}

function UserAvatar({
    user,
    userId: _userId,
}: {
    user: WatchlistUser | null;
    userId: string;
}) {
    if (user?.avatarUrl) {
        return (
            <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-8 w-8 rounded-full"
            />
        );
    }
    return (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
        </div>
    );
}

function displayName(user: WatchlistUser | null, userId: string): string {
    if (!user) return userId;
    return user.globalName ?? user.username;
}

export default function WatchlistPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [entries, setEntries] = useState<WatchlistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [severityFilter, setSeverityFilter] = useState<Severity | "ALL">("ALL");

    // Add dialog
    const [addOpen, setAddOpen] = useState(false);
    const [addUserId, setAddUserId] = useState("");
    const [addReason, setAddReason] = useState("");
    const [addNotes, setAddNotes] = useState("");
    const [addSeverity, setAddSeverity] = useState<Severity>("LOW");
    const [adding, setAdding] = useState(false);

    // Edit dialog
    const [editEntry, setEditEntry] = useState<WatchlistEntry | null>(null);
    const [editReason, setEditReason] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editSeverity, setEditSeverity] = useState<Severity>("LOW");
    const [editing, setEditing] = useState(false);

    // Delete dialog state no longer needed because of ConfirmDeleteDialog
    const [deleting, setDeleting] = useState(false);

    const fetchEntries = useCallback(async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/watchlist`);
            if (res.ok) {
                setEntries(await res.json());
            }
        } catch {
            toast.error("Failed to load watchlist");
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const filteredEntries = entries.filter((e) => {
        const matchesSeverity =
            severityFilter === "ALL" || e.severity === severityFilter;
        const query = search.toLowerCase();
        const matchesSearch =
            !query ||
            e.userId.includes(query) ||
            displayName(e.user, e.userId).toLowerCase().includes(query) ||
            e.reason.toLowerCase().includes(query) ||
            (e.notes ?? "").toLowerCase().includes(query);
        return matchesSeverity && matchesSearch;
    });

    async function handleAdd() {
        if (!addUserId.trim() || !addReason.trim()) return;
        setAdding(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/watchlist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: addUserId.trim(),
                    reason: addReason.trim(),
                    notes: addNotes.trim() || undefined,
                    severity: addSeverity,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error ?? "Failed to add member");
                return;
            }
            toast.success("Member added to watchlist");
            setAddOpen(false);
            setAddUserId("");
            setAddReason("");
            setAddNotes("");
            setAddSeverity("LOW");
            await fetchEntries();
        } finally {
            setAdding(false);
        }
    }

    function openEdit(entry: WatchlistEntry) {
        setEditEntry(entry);
        setEditReason(entry.reason);
        setEditNotes(entry.notes ?? "");
        setEditSeverity(entry.severity);
    }

    async function handleEdit() {
        if (!editEntry) return;
        setEditing(true);
        try {
            const res = await fetch(
                `/api/guilds/${guildId}/watchlist/${editEntry.userId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        reason: editReason.trim(),
                        notes: editNotes.trim() || null,
                        severity: editSeverity,
                    }),
                }
            );
            if (!res.ok) {
                toast.error("Failed to update entry");
                return;
            }
            toast.success("Watchlist entry updated");
            setEditEntry(null);
            await fetchEntries();
        } finally {
            setEditing(false);
        }
    }

    async function handleDelete(entry: WatchlistEntry) {
        setDeleting(true);
        try {
            const res = await fetch(
                `/api/guilds/${guildId}/watchlist/${entry.userId}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                toast.error("Failed to remove member");
                return;
            }
            toast.success("Member removed from watchlist");
            await fetchEntries();
        } finally {
            setDeleting(false);
        }
    }

    const counts: Record<Severity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const e of entries) counts[e.severity]++;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Eye className="h-6 w-6 text-primary" />
                        Watchlist
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Track suspicious or concerning members for staff review
                    </p>
                </div>
                <Button onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                {(["LOW", "MEDIUM", "HIGH"] as Severity[]).map((sev) => {
                    const cfg = SEVERITY_CONFIG[sev];
                    const Icon = cfg.icon;
                    return (
                        <Card
                            key={sev}
                            className="cursor-pointer hover:bg-accent/50 transition-colors"
                            onClick={() =>
                                setSeverityFilter((prev) =>
                                    prev === sev ? "ALL" : sev
                                )
                            }
                        >
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {cfg.label} Severity
                                        </p>
                                        <p className="text-2xl font-bold">
                                            {counts[sev]}
                                        </p>
                                    </div>
                                    <div
                                        className={`p-2 rounded-lg ${cfg.color}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by user ID, name, or reason…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select
                    value={severityFilter}
                    onValueChange={(v) =>
                        setSeverityFilter(v as Severity | "ALL")
                    }
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All severities</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        Watched Members{" "}
                        <Badge variant="secondary" className="ml-2">
                            {filteredEntries.length}
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Members flagged for monitoring. Only visible to staff
                        with Manage Server permission.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Eye className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">No members on watchlist</p>
                            <p className="text-sm">
                                {entries.length > 0
                                    ? "Try adjusting your filters"
                                    : "Add suspicious members to keep an eye on them"}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredEntries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="py-4 flex flex-col sm:flex-row sm:items-start gap-3"
                                >
                                    {/* Avatar + Name */}
                                    <div className="flex items-center gap-3 sm:w-48 shrink-0">
                                        <UserAvatar
                                            user={entry.user}
                                            userId={entry.userId}
                                        />
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">
                                                {displayName(
                                                    entry.user,
                                                    entry.userId
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {entry.userId}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <SeverityBadge
                                                severity={entry.severity}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                Added by{" "}
                                                <span className="font-medium text-foreground">
                                                    {displayName(
                                                        entry.addedByUser,
                                                        entry.addedBy
                                                    )}
                                                </span>{" "}
                                                on{" "}
                                                {format(
                                                    new Date(entry.createdAt),
                                                    "MMM d, yyyy"
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-sm">
                                            <span className="font-medium">
                                                Reason:{" "}
                                            </span>
                                            {entry.reason}
                                        </p>
                                        {entry.notes && (
                                            <p className="text-sm text-muted-foreground">
                                                <span className="font-medium text-foreground">
                                                    Notes:{" "}
                                                </span>
                                                {entry.notes}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEdit(entry)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                            <span className="sr-only">Edit</span>
                                        </Button>
                                        <ConfirmDeleteDialog
                                            onConfirm={() => handleDelete(entry)}
                                            title="Remove from Watchlist"
                                            description={`Are you sure you want to remove ${displayName(entry.user, entry.userId)} from the watchlist? This action cannot be undone.`}
                                            confirmText="Remove"
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                {deleting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                                <span className="sr-only">
                                                    Remove
                                                </span>
                                            </Button>
                                        </ConfirmDeleteDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Add to Watchlist
                        </DialogTitle>
                        <DialogDescription>
                            Flag a member for staff monitoring. They will not be
                            notified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-userId">Member ID</Label>
                            <Input
                                id="add-userId"
                                placeholder="Discord User ID (e.g. 123456789012345678)"
                                value={addUserId}
                                onChange={(e) => setAddUserId(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Right-click a user in Discord → Copy User ID
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="add-severity">Severity</Label>
                            <Select
                                value={addSeverity}
                                onValueChange={(v) =>
                                    setAddSeverity(v as Severity)
                                }
                            >
                                <SelectTrigger id="add-severity">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">
                                        🟡 Low — keep an eye on
                                    </SelectItem>
                                    <SelectItem value="MEDIUM">
                                        🟠 Medium — moderately suspicious
                                    </SelectItem>
                                    <SelectItem value="HIGH">
                                        🔴 High — immediate concern
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="add-reason">Reason</Label>
                            <Input
                                id="add-reason"
                                placeholder="Why is this member being watched?"
                                value={addReason}
                                onChange={(e) => setAddReason(e.target.value)}
                                maxLength={500}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="add-notes">
                                Notes{" "}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Textarea
                                id="add-notes"
                                placeholder="Additional context, links to incidents, etc."
                                value={addNotes}
                                onChange={(e) => setAddNotes(e.target.value)}
                                maxLength={1000}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAddOpen(false)}
                            disabled={adding}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAdd}
                            disabled={
                                adding ||
                                !addUserId.trim() ||
                                !addReason.trim()
                            }
                        >
                            {adding && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Add to Watchlist
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog
                open={!!editEntry}
                onOpenChange={(open) => !open && setEditEntry(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5" />
                            Edit Watchlist Entry
                        </DialogTitle>
                        <DialogDescription>
                            Update the reason, notes, or severity for{" "}
                            <span className="font-medium text-foreground">
                                {editEntry
                                    ? displayName(editEntry.user, editEntry.userId)
                                    : ""}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Severity</Label>
                            <Select
                                value={editSeverity}
                                onValueChange={(v) =>
                                    setEditSeverity(v as Severity)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">
                                        🟡 Low
                                    </SelectItem>
                                    <SelectItem value="MEDIUM">
                                        🟠 Medium
                                    </SelectItem>
                                    <SelectItem value="HIGH">
                                        🔴 High
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reason</Label>
                            <Input
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                maxLength={500}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>
                                Notes{" "}
                                <span className="text-muted-foreground font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                maxLength={1000}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditEntry(null)}
                            disabled={editing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEdit}
                            disabled={editing || !editReason.trim()}
                        >
                            {editing && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
