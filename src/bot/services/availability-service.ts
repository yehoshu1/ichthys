import { eq, and, desc } from 'drizzle-orm';
import { db } from '@shared/database/client';
import {
    availabilityFinder,
    availabilityResponse,
    AvailabilityFinder,
    AvailabilityResponse,
    NewAvailabilityFinder,
    NewAvailabilityResponse,
} from '@shared/database/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABILITY FINDER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateAvailabilityFinderData {
    guildId: string;
    creatorId: string;
    channelId: string;
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    dailyStartHour?: number;
    dailyEndHour?: number;
    isPublic?: boolean;
    convertToEvent?: boolean;
}

export interface AvailabilitySlot {
    dateTime: Date;
    availableUsers: string[];
}

export interface BestTimeResult {
    dateTime: Date;
    userCount: number;
    users: string[];
}

export class AvailabilityService {
    // ═══════════════════════════════════════════════════════════════════════════════
    // AVAILABILITY FINDER CRUD
    // ═══════════════════════════════════════════════════════════════════════════════

    async createFinder(data: CreateAvailabilityFinderData): Promise<AvailabilityFinder> {
        const finderData: NewAvailabilityFinder = {
            guildId: data.guildId,
            creatorId: data.creatorId,
            channelId: data.channelId,
            title: data.title,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            dailyStartHour: data.dailyStartHour ?? 9,
            dailyEndHour: data.dailyEndHour ?? 17,
            isPublic: data.isPublic ?? true,
            convertToEvent: data.convertToEvent ?? false,
            closed: false,
        };

        const [created] = await db.insert(availabilityFinder).values(finderData).returning();
        return created;
    }

    async getFinderById(finderId: string): Promise<AvailabilityFinder | undefined> {
        const [result] = await db
            .select()
            .from(availabilityFinder)
            .where(eq(availabilityFinder.id, finderId));
        return result;
    }

    async getFindersByGuild(guildId: string, options?: { closed?: boolean }): Promise<AvailabilityFinder[]> {
        let query = db
            .select()
            .from(availabilityFinder)
            .where(eq(availabilityFinder.guildId, guildId));

        if (options?.closed !== undefined) {
            query = db
                .select()
                .from(availabilityFinder)
                .where(
                    and(
                        eq(availabilityFinder.guildId, guildId),
                        eq(availabilityFinder.closed, options.closed)
                    )
                );
        }

        return await query.orderBy(desc(availabilityFinder.createdAt));
    }

    async updateFinder(
        finderId: string,
        data: Partial<NewAvailabilityFinder>
    ): Promise<AvailabilityFinder | undefined> {
        const [updated] = await db
            .update(availabilityFinder)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(availabilityFinder.id, finderId))
            .returning();
        return updated;
    }

    async deleteFinder(finderId: string): Promise<boolean> {
        const result = await db
            .delete(availabilityFinder)
            .where(eq(availabilityFinder.id, finderId));
        return (result.rowCount ?? 0) > 0;
    }

    async closeFinder(finderId: string, createdEventId?: string): Promise<AvailabilityFinder | undefined> {
        return this.updateFinder(finderId, {
            closed: true,
            createdEventId,
        });
    }

    async setFinderMessageId(finderId: string, messageId: string): Promise<void> {
        await db
            .update(availabilityFinder)
            .set({ messageId })
            .where(eq(availabilityFinder.id, finderId));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // RESPONSES
    // ═══════════════════════════════════════════════════════════════════════════════

    async setResponse(
        finderId: string,
        userId: string,
        availableSlots: Date[]
    ): Promise<void> {
        const [existing] = await db
            .select()
            .from(availabilityResponse)
            .where(
                and(
                    eq(availabilityResponse.finderId, finderId),
                    eq(availabilityResponse.userId, userId)
                )
            );

        if (existing) {
            await db
                .update(availabilityResponse)
                .set({
                    availableSlots,
                    updatedAt: new Date(),
                })
                .where(eq(availabilityResponse.id, existing.id));
        } else {
            const responseData: NewAvailabilityResponse = {
                finderId,
                userId,
                availableSlots,
            };
            await db.insert(availabilityResponse).values(responseData);
        }
    }

    async getResponse(finderId: string, userId: string): Promise<AvailabilityResponse | undefined> {
        const [result] = await db
            .select()
            .from(availabilityResponse)
            .where(
                and(
                    eq(availabilityResponse.finderId, finderId),
                    eq(availabilityResponse.userId, userId)
                )
            );
        return result;
    }

    async getResponsesByFinder(finderId: string): Promise<AvailabilityResponse[]> {
        return await db
            .select()
            .from(availabilityResponse)
            .where(eq(availabilityResponse.finderId, finderId));
    }

    async removeResponse(finderId: string, userId: string): Promise<boolean> {
        const result = await db
            .delete(availabilityResponse)
            .where(
                and(
                    eq(availabilityResponse.finderId, finderId),
                    eq(availabilityResponse.userId, userId)
                )
            );
        return (result.rowCount ?? 0) > 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════════

    async getAvailableSlots(finderId: string): Promise<AvailabilitySlot[]> {
        const responses = await this.getResponsesByFinder(finderId);
        const slotMap = new Map<string, string[]>();

        for (const response of responses) {
            if (!response.availableSlots) continue;

            for (const slot of response.availableSlots) {
                const slotKey = slot.toISOString();
                if (!slotMap.has(slotKey)) {
                    slotMap.set(slotKey, []);
                }
                slotMap.get(slotKey)!.push(response.userId);
            }
        }

        const slots: AvailabilitySlot[] = [];
        for (const [dateTimeStr, users] of slotMap) {
            slots.push({
                dateTime: new Date(dateTimeStr),
                availableUsers: users,
            });
        }

        // Sort by datetime
        slots.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

        return slots;
    }

    async getBestTimes(finderId: string, limit: number = 3): Promise<BestTimeResult[]> {
        const slots = await this.getAvailableSlots(finderId);

        // Sort by number of available users (descending)
        slots.sort((a, b) => b.availableUsers.length - a.availableUsers.length);

        return slots.slice(0, limit).map(slot => ({
            dateTime: slot.dateTime,
            userCount: slot.availableUsers.length,
            users: slot.availableUsers,
        }));
    }

    async getCommonAvailability(finderId: string): Promise<{ totalRespondents: number; slots: AvailabilitySlot[] }> {
        const responses = await this.getResponsesByFinder(finderId);
        const slots = await this.getAvailableSlots(finderId);

        return {
            totalRespondents: responses.length,
            slots,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TIME SLOT GENERATION
    // ═══════════════════════════════════════════════════════════════════════════════

    generateTimeSlots(
        startDate: Date,
        endDate: Date,
        dailyStartHour: number,
        dailyEndHour: number,
        intervalMinutes: number = 60
    ): Date[] {
        const slots: Date[] = [];
        const current = new Date(startDate);

        // Set to start of day
        current.setHours(0, 0, 0, 0);

        while (current <= endDate) {
            // Generate slots for this day
            for (let hour = dailyStartHour; hour < dailyEndHour; hour++) {
                for (let minute = 0; minute < 60; minute += intervalMinutes) {
                    const slot = new Date(current);
                    slot.setHours(hour, minute, 0, 0);

                    // Only add if within the date range
                    if (slot >= startDate && slot <= endDate) {
                        slots.push(slot);
                    }
                }
            }

            // Move to next day
            current.setDate(current.getDate() + 1);
        }

        return slots;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // NOTIFICATION HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    async getParticipants(finderId: string): Promise<string[]> {
        const responses = await this.getResponsesByFinder(finderId);
        return responses.map(r => r.userId);
    }

    async hasResponded(finderId: string, userId: string): Promise<boolean> {
        const response = await this.getResponse(finderId, userId);
        return !!response;
    }
}

export const availabilityService = new AvailabilityService();
