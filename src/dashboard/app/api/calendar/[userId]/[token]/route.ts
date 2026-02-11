import { NextRequest, NextResponse } from 'next/server';
import { calendarService } from '@/bot/services/calendar-service';

// GET /api/calendar/[userId]/[token].ics - Personal calendar feed
export async function GET(
    _request: NextRequest,
    props: { params: Promise<{ userId: string; token: string }> }
) {
    try {
        const { userId, token } = await props.params;

        // Validate token
        if (!calendarService.validateFeedToken(userId, token)) {
            return new NextResponse('Invalid token', { status: 401 });
        }

        // Generate ICS feed
        const icsContent = await calendarService.generateUserCalendarFeed(userId);

        return new NextResponse(icsContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="ixoye-calendar.ics"',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Error generating calendar feed:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
