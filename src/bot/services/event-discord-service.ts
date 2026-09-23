import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    Guild,
    Message,
    Client,
} from 'discord.js';
import { eventService } from './event-service';
import { Event } from '@shared/database/schema';
import { formatDistanceToNow } from 'date-fns';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT DISCORD SERVICE
// Handles Discord embeds and RSVP buttons for events
// ═══════════════════════════════════════════════════════════════════════════════

interface EventDisplayData {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    locationChannelId?: string | null;
    imageUrl?: string | null;
    startTime: Date;
    endTime?: Date | null;
    color?: string | null;
    status?: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    maxAttendees?: number | null;
    enableWaitlist?: boolean;
    creatorId: string;
}

export class EventDiscordService {
    constructor() {}

    // ═══════════════════════════════════════════════════════════════════════════════
    // EMBED BUILDER
    // ═══════════════════════════════════════════════════════════════════════════════

    async buildEventEmbed(eventData: EventDisplayData, guild: Guild): Promise<EmbedBuilder> {
        const statusPrefix = this.getStatusPrefix(eventData.status);
        const embed = new EmbedBuilder()
            .setTitle(`${statusPrefix}📅 ${eventData.title}`)
            .setColor(this.parseColor(eventData.color) || 0x5865F2)
            .setTimestamp();

        // Time field
        const timeString = this.formatEventTime(eventData.startTime, eventData.endTime);
        embed.addFields({
            name: '🕒 Time',
            value: timeString,
            inline: false,
        });

        // Description if exists
        if (eventData.description) {
            embed.addFields({
                name: '📝 Description',
                value: eventData.description.slice(0, 1024), // Discord limit
                inline: false,
            });
        }

        if (eventData.locationChannelId) {
            embed.addFields({
                name: '📍 Voice Location',
                value: `<#${eventData.locationChannelId}>`,
                inline: false,
            });
        }

        // Location note if exists
        if (eventData.location) {
            embed.addFields({
                name: '📍 Location Note',
                value: eventData.location,
                inline: false,
            });
        }

        // Get RSVP counts
        const rsvps = await eventService.getRsvpsByEvent(eventData.id);
        const attendees = rsvps.filter(r => r.status === 'YES');
        const maybes = rsvps.filter(r => r.status === 'MAYBE');
        const waitlist = rsvps.filter(r => r.status === 'WAITLIST');

        // Attendees field
        let attendeesText = '';
        if (attendees.length === 0) {
            attendeesText = 'No attendees yet';
        } else {
            const attendeeMentions = await Promise.all(
                attendees.slice(0, 10).map(async (r) => {
                    const member = await guild.members.fetch(r.userId).catch(() => null);
                    return member ? `<@${r.userId}>` : `Unknown User`;
                })
            );
            attendeesText = attendeeMentions.join('\n');
            if (attendees.length > 10) {
                attendeesText += `\n...and ${attendees.length - 10} more`;
            }
        }

        const attendeeCount = `Attendees (${attendees.length}${eventData.maxAttendees ? `/${eventData.maxAttendees}` : ''})`;
        embed.addFields({
            name: attendeeCount,
            value: attendeesText || 'No attendees yet',
            inline: false,
        });

        // Maybe attendees
        if (maybes.length > 0) {
            const maybeMentions = await Promise.all(
                maybes.slice(0, 5).map(async (r) => {
                    const member = await guild.members.fetch(r.userId).catch(() => null);
                    return member ? `<@${r.userId}>` : `Unknown User`;
                })
            );
            embed.addFields({
                name: `Maybe (${maybes.length})`,
                value: maybeMentions.join('\n'),
                inline: true,
            });
        }

        // Waitlist
        if (waitlist.length > 0 && eventData.enableWaitlist) {
            embed.addFields({
                name: `Waitlist (${waitlist.length})`,
                value: `${waitlist.length} people on waitlist`,
                inline: true,
            });
        }

        // Footer with creator info
        const creator = await guild.members.fetch(eventData.creatorId).catch(() => null);
        embed.setFooter({
            text: `Created by ${creator?.user.username || 'Unknown'}`,
            iconURL: creator?.user.displayAvatarURL(),
        });

        if (eventData.imageUrl) {
            embed.setImage(eventData.imageUrl);
        }

        return embed;
    }

    buildEventButtons(eventId: string, status?: EventDisplayData['status'], startTime?: Date): ActionRowBuilder<ButtonBuilder>[] {
        const isPastOrActive = status === 'ACTIVE' || status === 'COMPLETED' || status === 'CANCELLED' || (startTime && startTime < new Date());
        
        const detailsButton = new ButtonBuilder()
            .setCustomId(`event:details:${eventId}`)
            .setLabel('📋 Details')
            .setStyle(ButtonStyle.Secondary);

        const settingsButton = new ButtonBuilder()
            .setCustomId(`event:settings:${eventId}`)
            .setLabel('⚙️ Settings')
            .setStyle(ButtonStyle.Secondary);

        if (isPastOrActive) {
            // Event has started or ended; remove RSVP options and only keep Details/Settings
            return [new ActionRowBuilder<ButtonBuilder>().addComponents(detailsButton, settingsButton)];
        }

        // Event is scheduled and in the future; show all options
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`event:rsvp:${eventId}:YES`)
                .setLabel('✅ Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`event:rsvp:${eventId}:MAYBE`)
                .setLabel('🤔 Maybe')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`event:rsvp:${eventId}:NO`)
                .setLabel('❌ No')
                .setStyle(ButtonStyle.Danger)
        );
        
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`event:reminder:${eventId}`)
                .setLabel('⏰ Set Reminder')
                .setStyle(ButtonStyle.Secondary),
            detailsButton,
            settingsButton
        );

        return [row1, row2];
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MESSAGE OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    async createEventMessage(event: Event, guild: Guild): Promise<Message | null> {
        const channel = await this.getEventChannel(event.channelId, guild);
        if (!channel) return null;

        const embed = await this.buildEventEmbed(event, guild);
        const buttons = this.buildEventButtons(event.id, event.status, event.startTime);

        // Build mention string — only the create role (first entry in the array)
        let mentionContent = '';
        if (event.mentionOnCreate && event.mentionRoleIds?.length) {
            mentionContent = `<@&${event.mentionRoleIds[0]}>`;
        }

        const message = await channel.send({
            content: mentionContent || undefined,
            embeds: [embed],
            components: [...buttons],
        });

        // Store message ID
        await eventService.setEventMessageId(event.id, message.id);

        return message;
    }

    async updateEventMessage(event: Event, guild: Guild): Promise<Message | null> {
        if (!event.messageId) return null;

        const channel = await this.getEventChannel(event.channelId, guild);
        if (!channel) return null;

        try {
            const message = await channel.messages.fetch(event.messageId);
            if (!message) return null;

            const embed = await this.buildEventEmbed(event, guild);
            const buttons = this.buildEventButtons(event.id, event.status, event.startTime);

            await message.edit({
                embeds: [embed],
                components: [...buttons],
            });

            return message;
        } catch (error) {
            logger.warn('Failed to update event message:', error);
            return null;
        }
    }

    async deleteEventMessage(event: Event, guild: Guild): Promise<void> {
        if (!event.messageId) return;

        const channel = await this.getEventChannel(event.channelId, guild);
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(event.messageId);
            if (message) {
                await message.delete();
            }
        } catch (error) {
            // Message already deleted or not found
            logger.debug('Event message already deleted or not found');
        }
    }

    async updateRsvpMessage(eventId: string, guild: Guild): Promise<void> {
        const event = await eventService.getEventById(eventId);
        if (!event || !event.messageId) return;

        await this.updateEventMessage(event, guild);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════════════

    private async getEventChannel(channelId: string, guild: Guild): Promise<TextChannel | null> {
        try {
            const channel = await guild.channels.fetch(channelId);
            if (channel?.isTextBased()) {
                return channel as TextChannel;
            }
        } catch (error) {
            logger.warn('Failed to fetch event channel:', error);
        }
        return null;
    }

    private formatEventTime(startTime: Date, endTime?: Date | null): string {
        const start = new Date(startTime);
        
        let timeString = `<t:${Math.floor(start.getTime() / 1000)}:F>`;
        
        if (endTime) {
            const end = new Date(endTime);
            timeString += ` - <t:${Math.floor(end.getTime() / 1000)}:t>`;
        }

        // Add relative time
        const relativeTime = formatDistanceToNow(start, { addSuffix: true });
        timeString += ` (${relativeTime})`;

        return timeString;
    }

    private parseColor(color?: string | null): number | null {
        if (!color) return null;
        try {
            return parseInt(color.replace('#', ''), 16);
        } catch {
            return null;
        }
    }

    private getStatusPrefix(status?: EventDisplayData['status']): string {
        if (status === 'CANCELLED') return '[Cancelled] ';
        if (status === 'COMPLETED') return '[Completed] ';
        if (status === 'ACTIVE') return '';
        return '';
    }
}

export let eventDiscordService: EventDiscordService;

export function initEventDiscordService(client: Client) {
    void client;
    eventDiscordService = new EventDiscordService();
    return eventDiscordService;
}
