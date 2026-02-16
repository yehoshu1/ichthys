import { GuildMember } from 'discord.js';

export interface CreatorOrAdminAccessInput {
    member: GuildMember;
    creatorUserId: string;
    adminPermissions: bigint[];
}

export function canMemberManageCreatorOwnedResource(
    input: CreatorOrAdminAccessInput
): boolean {
    const isCreator = input.member.id === input.creatorUserId;
    if (isCreator) return true;

    return input.adminPermissions.some((permission) =>
        input.member.permissions.has(permission)
    );
}
