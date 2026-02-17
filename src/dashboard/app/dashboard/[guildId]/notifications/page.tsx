import { redirect } from "next/navigation";

interface NotificationsPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/settings?module=notifications`);
}
