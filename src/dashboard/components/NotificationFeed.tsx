'use client';

/**
 * Notification Feed Component
 * 
 * Displays real-time notification stream with filtering and preferences
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    BellOff, 
    CheckCheck, 
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
    unread: boolean;
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
    notification, 
    onMarkRead 
}: { 
    notification: Notification;
    onMarkRead: (id: string) => void;
}) {
    return (
        <div 
            className={`flex items-start gap-4 p-4 border-b last:border-0 transition-colors ${
                notification.unread ? 'bg-accent/50' : ''
            }`}
        >
            <div className="mt-1">
                <SeverityIcon severity={notification.severity} />
            </div>
            
            <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{notification.title}</h4>
                    {notification.unread && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onMarkRead(notification.id)}
                            className="h-6 px-2 text-xs"
                        >
                            Mark read
                        </Button>
                    )}
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
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchNotifications();
        fetchUnreadCount();
    }, [guildId, filter]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50' });
            if (filter === 'unread') {
                params.append('unreadOnly', 'true');
            }
            
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

    const fetchUnreadCount = async () => {
        try {
            const response = await fetch(`/api/guilds/${guildId}/notifications/unread-count`);
            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.count || 0);
            }
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            const response = await fetch(`/api/guilds/${guildId}/notifications/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: [notificationId] }),
            });

            if (response.ok) {
                setNotifications(prev =>
                    prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => n.unread).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            const response = await fetch(`/api/guilds/${guildId}/notifications/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: unreadIds }),
            });

            if (response.ok) {
                setNotifications(prev =>
                    prev.map(n => ({ ...n, unread: false }))
                );
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
                    <TabsList>
                        <TabsTrigger value="all">
                            All
                        </TabsTrigger>
                        <TabsTrigger value="unread">
                            Unread {unreadCount > 0 && `(${unreadCount})`}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark all read
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Notification Stream</CardTitle>
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
                            <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No notifications found</p>
                            {filter === 'unread' && (
                                <p className="text-sm mt-2">You're all caught up!</p>
                            )}
                        </div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div>
                                {notifications.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        onMarkRead={markAsRead}
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
