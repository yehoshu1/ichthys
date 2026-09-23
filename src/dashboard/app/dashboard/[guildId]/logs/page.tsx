/**
 * Action Logs Page
 * 
 * Displays audit trail of automated actions executed by the bot
 * (role actions, scheduled actions, automated tasks)
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@shared/database/client';
import { actionLog, discordUserCache } from '@shared/database/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Clock, User, AlertCircle } from 'lucide-react';

interface LogsPageProps {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ type?: string; success?: string; page?: string }>;
}

async function getActionLogs(guildId: string, filters: { type?: string; success?: string }, page: number = 1) {
    const limit = 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(actionLog.guildId, guildId)];

    if (filters.type) {
        conditions.push(eq(actionLog.actionType, filters.type));
    }

    if (filters.success === 'true') {
        conditions.push(eq(actionLog.success, true));
    } else if (filters.success === 'false') {
        conditions.push(eq(actionLog.success, false));
    }

    const logs = await db
        .select({
            id: actionLog.id,
            actionType: actionLog.actionType,
            targetUserId: actionLog.targetUserId,
            executedAt: actionLog.executedAt,
            success: actionLog.success,
            errorMessage: actionLog.errorMessage,
            metadata: actionLog.metadata,
        })
        .from(actionLog)
        .where(and(...conditions))
        .orderBy(desc(actionLog.executedAt))
        .limit(limit)
        .offset(offset);

    // Get unique user IDs
    const userIds = [...new Set(logs.map(log => log.targetUserId))];
    
    // Fetch cached user data
    const users = await db
        .select()
        .from(discordUserCache)
        .where(sql`${discordUserCache.userId} = ANY(${userIds})`);

    const userMap = new Map(users.map(u => [u.userId, u]));

    return logs.map(log => ({
        ...log,
        targetUser: userMap.get(log.targetUserId),
    }));
}

function ActionTypeIcon({ type }: { type: string }) {
    const iconClass = "h-4 w-4";
    
    if (type.includes('role')) return <User className={iconClass} />;
    if (type.includes('kick') || type.includes('ban')) return <AlertCircle className={iconClass} />;
    return <Clock className={iconClass} />;
}

function ActionLogItem({ log }: { log: any }) {
    const userName = log.targetUser?.globalName || log.targetUser?.username || log.targetUserId;
    
    return (
        <div className="flex items-start gap-4 border-b pb-4 last:border-0">
            <div className="mt-1">
                {log.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                )}
            </div>
            
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="gap-1">
                        <ActionTypeIcon type={log.actionType} />
                        {log.actionType}
                    </Badge>
                    <span className="text-sm text-muted-foreground">→</span>
                    <span className="text-sm font-medium">{userName}</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                    {new Date(log.executedAt).toLocaleString()}
                </div>
                
                {!log.success && log.errorMessage && (
                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                        Error: {log.errorMessage}
                    </div>
                )}
                
                {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata).length > 0 && (
                    <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View metadata
                        </summary>
                        <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
}

export default async function LogsPage({ params, searchParams }: LogsPageProps) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect('/');
    }

    const { guildId } = await params;
    const filters = await searchParams;
    const page = parseInt(filters.page || '1');

    const logs = await getActionLogs(guildId, filters, page);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Action Logs</h1>
                <p className="text-muted-foreground">
                    View automated actions executed by the bot
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Actions</CardTitle>
                    <CardDescription>
                        Showing the last 50 automated actions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No action logs found</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-4 pr-4">
                                {logs.map((log) => (
                                    <ActionLogItem key={log.id} log={log} />
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
