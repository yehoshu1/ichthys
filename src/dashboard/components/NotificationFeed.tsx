'use client';

/**
 * Notification Feed Component
 * 
 * Displays real-time notification stream with filtering and preferences
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Clock,
    Info,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';


interface Notification {
    id: string;
    eventType: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    title: string;
    body: string | null;
    actorUserId: string | null;
    targetUserId: string | null;
    occurredAt: string;
}

interface NotificationFeedProps {
    guildId: string;
}

function SeverityIcon({ severity }: { severity: Notification['severity'] }) {
    switch (severity) {
        case 'SUCCESS':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'WARNING':
            return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        case 'ERROR':
            return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
            return <Info className="h-4 w-4 text-blue-500" />;
    }
}

function NotificationItem({ 
    notification 
}: { 
    notification: Notification;
}) {
    return (
        <div className="flex items-start gap-4 p-4 border-b last:border-0 transition-colors">
            <div className="mt-1">
                <SeverityIcon severity={notification.severity} />
            </div>
            
            <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{notification.title}</h4>
                </div>
                
                {notification.body && (
                    <p className="text-sm text-muted-foreground">{notification.body}</p>
                )}
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                        {notification.eventType}
                    </Badge>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{new Date(notification.occurredAt).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

export function NotificationFeed({ guildId }: NotificationFeedProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, [guildId]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50' });
            
            const response = await fetch(`/api/guilds/${guildId}/notifications?${params}`);
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.items || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Log Stream</CardTitle>
                    <CardDescription>
                        Recent bot events and actions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No logs found</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div>
                                {notifications.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
