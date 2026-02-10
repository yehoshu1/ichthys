import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

const userSetupSections = [
    {
        title: "1) Add Ixoye to Your Server",
        bullets: [
            "Invite the bot with permissions required for your modules (Manage Roles, Manage Messages, Moderate Members, View Channels, Send Messages).",
            "Place the bot role above roles it must assign (verification, leveling rewards, booster role, mute role).",
            "Confirm channel permissions for every module output channel (welcome, logs, announcements).",
        ],
    },
    {
        title: "2) Open the Dashboard",
        bullets: [
            "Sign in with Discord using an account that has management permissions in your guild.",
            "Open your guild from /guilds.",
            "Start from each module page under /dashboard/[guildId]/... to configure settings.",
        ],
    },
    {
        title: "3) Recommended First-Time Order",
        bullets: [
            "Set base feature toggles in Config/Setup command and dashboard settings.",
            "Configure Verification before advanced automations so member states are reliable.",
            "Configure Welcome templates and triggers.",
            "Configure Leveling and rewards.",
            "Configure Moderation and Role Actions last to avoid accidental automations during setup.",
        ],
    },
    {
        title: "4) Staff Onboarding Checklist",
        bullets: [
            "Train staff on /verify, moderation commands, and your escalation policy.",
            "Review /cases output format and logs workflow.",
            "Document which staff role can run high-impact commands like /ban and /clear.",
        ],
    },
    {
        title: "5) Operational Tips",
        bullets: [
            "Use /docs/modules for per-feature workflows and known failure patterns.",
            "Use /docs/commands for exact options and examples before training moderators.",
            "Use /docs/dev only if you are hosting or maintaining the application yourself.",
        ],
    },
];

export default function DocsSetupPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Getting Started for Server Managers</CardTitle>
                    <CardDescription>
                        A practical setup sequence for communities that are using Ixoye, not hosting it.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {userSetupSections.map((section) => (
                    <Card key={section.title}>
                        <CardHeader>
                            <CardTitle className="text-base">{section.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                                {section.bullets.map((bullet) => (
                                    <li key={bullet}>{bullet}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
