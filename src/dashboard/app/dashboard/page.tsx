'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'authenticated') {
            router.replace('/guilds');
        } else if (status === 'unauthenticated') {
            router.replace('/');
        }
    }, [status, router]);

    if (status === 'loading') {
        return <div>Loading...</div>;
    }
    if (!session) {
        return null;
    }
    return null;
}
