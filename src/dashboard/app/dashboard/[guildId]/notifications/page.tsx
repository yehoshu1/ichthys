/**
 * Logs Page
 *
 * Display and manage the in-app activity feed for bot events and actions.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { NotificationFeed } from '@/components/NotificationFeed';

interface NotificationsPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect('/');
    }

    const { guildId } = await params;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
                <p className="text-muted-foreground">
                    Review the in-app activity feed for bot events and actions
                </p>
            </div>

            <NotificationFeed guildId={guildId} />
        </div>
    );
}
