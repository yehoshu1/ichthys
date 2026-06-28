"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";

interface MinimalEvent {
    id: string;
    title: string;
    startTime: string;
    endTime: string | null;
    status?: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
    color: string | null;
}

interface EventCalendarProps<T extends MinimalEvent = MinimalEvent> {
    events: T[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: T) => void;
    onCreateEvent?: (date: Date) => void;
    className?: string;
}

type ViewMode = "month" | "week" | "day";

export default function EventCalendar<T extends MinimalEvent = MinimalEvent>({
    events,
    onDateClick,
    onEventClick,
    onCreateEvent,
    className,
}: EventCalendarProps<T>) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>("month");

    // Group events by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, T[]>();
        events.forEach((event) => {
            const dateKey = format(parseISO(event.startTime), "yyyy-MM-dd");
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(event);
        });
        return map;
    }, [events]);

    const getEventsForDate = (date: Date): T[] => {
        const dateKey = format(date, "yyyy-MM-dd");
        return eventsByDate.get(dateKey) || [];
    };

    const handlePrevious = () => {
        if (viewMode === "month") {
            setCurrentDate(subMonths(currentDate, 1));
        } else if (viewMode === "week") {
            setCurrentDate(addDays(currentDate, -7));
        } else {
            setCurrentDate(addDays(currentDate, -1));
        }
    };

    const handleNext = () => {
        if (viewMode === "month") {
            setCurrentDate(addMonths(currentDate, 1));
        } else if (viewMode === "week") {
            setCurrentDate(addDays(currentDate, 7));
        } else {
            setCurrentDate(addDays(currentDate, 1));
        }
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const dayDate = day;
                const dayEvents = getEventsForDate(dayDate);
                const isCurrentMonth = isSameMonth(dayDate, currentDate);
                const isTodayDate = isToday(dayDate);

                days.push(
                    <div
                        key={dayDate.toString()}
                        className={cn(
                            "min-h-[100px] md:min-h-[120px] border-r border-b p-1 md:p-2 cursor-pointer hover:bg-muted/50 transition-colors",
                            !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                            isTodayDate && "bg-primary/5"
                        )}
                        onClick={() => {
                            onDateClick?.(dayDate);
                            onCreateEvent?.(dayDate);
                        }}
                    >
                        <div className={cn(
                            "text-xs md:text-sm font-medium mb-1",
                            isTodayDate && "text-primary font-bold"
                        )}>
                            {format(dayDate, "d")}
                        </div>
                        <div className="space-y-0.5 md:space-y-1">
                            {dayEvents.slice(0, 3).map((event) => (
                                <div
                                    key={event.id}
                                    className={cn(
                                        "text-xs px-1 md:px-2 py-0.5 md:py-1 rounded truncate cursor-pointer hover:opacity-80",
                                        event.color ? `bg-${event.color}-500/20 text-${event.color}-700 dark:text-${event.color}-300` : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                    )}
                                    style={{
                                        backgroundColor: event.color ? `${event.color}20` : undefined,
                                        color: event.color || undefined,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEventClick?.(event);
                                    }}
                                >
                                    {format(parseISO(event.startTime), "HH:mm")} {event.title}
                                </div>
                            ))}
                            {dayEvents.length > 3 && (
                                <div className="text-xs text-muted-foreground px-1 md:px-2">
                                    +{dayEvents.length - 3} more
                                </div>
                            )}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day.toString()} className="grid grid-cols-7">
                    {days}
                </div>
            );
            days = [];
        }

        return (
            <div className="border-t border-l rounded-lg overflow-hidden">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 bg-muted/50">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div
                            key={day}
                            className="text-center text-xs md:text-sm font-medium py-2 md:py-3 border-r border-b"
                        >
                            <span className="hidden md:inline">{day}</span>
                            <span className="md:hidden">{day.slice(0, 1)}</span>
                        </div>
                    ))}
                </div>
                {rows}
            </div>
        );
    };

    const renderWeekView = () => {
        const weekStart = startOfWeek(currentDate);
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

        return (
            <div className="border rounded-lg overflow-hidden">
                {/* Week header */}
                <div className="grid grid-cols-1 md:grid-cols-7 bg-muted/50 border-b">
                    {days.map((day) => {
                        const isTodayDate = isToday(day);
                        return (
                            <div
                                key={day.toString()}
                                className={cn(
                                    "text-center py-3 px-2 border-b md:border-b-0 md:border-r last:border-r-0",
                                    isTodayDate && "bg-primary/10"
                                )}
                            >
                                <div className="text-xs text-muted-foreground">
                                    {format(day, "EEE")}
                                </div>
                                <div className={cn(
                                    "text-lg font-semibold",
                                    isTodayDate && "text-primary"
                                )}>
                                    {format(day, "d")}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Week events */}
                <div className="grid grid-cols-1 md:grid-cols-7">
                    {days.map((day) => {
                        const dayEvents = getEventsForDate(day);
                        return (
                            <div
                                key={day.toString()}
                                className="min-h-[200px] md:min-h-[400px] p-2 md:p-3 border-b md:border-b-0 md:border-r last:border-r-0 cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                    onDateClick?.(day);
                                    onCreateEvent?.(day);
                                }}
                            >
                                <div className="space-y-1 md:space-y-2">
                                    {dayEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="text-xs md:text-sm px-2 py-1.5 md:py-2 rounded cursor-pointer hover:opacity-80"
                                            style={{
                                                backgroundColor: event.color ? `${event.color}20` : "#3b82f620",
                                                borderLeft: `3px solid ${event.color || "#3b82f6"}`,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEventClick?.(event);
                                            }}
                                        >
                                            <div className="font-medium truncate">{event.title}</div>
                                            <div className="text-muted-foreground text-xs mt-0.5">
                                                {format(parseISO(event.startTime), "HH:mm")}
                                                {event.endTime && ` - ${format(parseISO(event.endTime), "HH:mm")}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderDayView = () => {
        const dayEvents = getEventsForDate(currentDate);
        const hours = Array.from({ length: 24 }, (_, i) => i);

        return (
            <div className="border rounded-lg overflow-hidden">
                {/* Day header */}
                <div className="bg-muted/50 p-4 border-b">
                    <div className="text-sm text-muted-foreground">{format(currentDate, "EEEE")}</div>
                    <div className="text-2xl font-bold">{format(currentDate, "MMMM d, yyyy")}</div>
                </div>

                {/* Time slots */}
                <ScrollArea className="max-h-[600px]">
                    {hours.map((hour) => {
                        const hourEvents = dayEvents.filter((event) => {
                            const eventHour = parseISO(event.startTime).getHours();
                            return eventHour === hour;
                        });

                        return (
                            <div key={hour} className="border-b flex">
                                <div className="w-16 md:w-20 p-2 md:p-3 text-xs md:text-sm text-muted-foreground border-r">
                                    {format(new Date().setHours(hour, 0), "HH:mm")}
                                </div>
                                <div className="flex-1 p-2 md:p-3 min-h-[60px] cursor-pointer hover:bg-muted/50">
                                    {hourEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="mb-1 md:mb-2 px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm cursor-pointer hover:opacity-80"
                                            style={{
                                                backgroundColor: event.color ? `${event.color}20` : "#3b82f620",
                                                borderLeft: `4px solid ${event.color || "#3b82f6"}`,
                                            }}
                                            onClick={() => onEventClick?.(event)}
                                        >
                                            <div className="font-medium">{event.title}</div>
                                            <div className="text-muted-foreground text-xs mt-0.5">
                                                {format(parseISO(event.startTime), "HH:mm")}
                                                {event.endTime && ` - ${format(parseISO(event.endTime), "HH:mm")}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </ScrollArea>
            </div>
        );
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Calendar Header */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevious}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNext}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <h2 className="text-lg md:text-xl font-semibold">
                    {viewMode === "month" && format(currentDate, "MMMM yyyy")}
                    {viewMode === "week" && `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}
                    {viewMode === "day" && format(currentDate, "MMMM d, yyyy")}
                </h2>

                <div className="flex items-center gap-2">
                    <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="week">Week</SelectItem>
                            <SelectItem value="day">Day</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Calendar View */}
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                <span>Click any date to create an event</span>
                <span className="hidden sm:inline">•</span>
                <span>Click an event to view/edit</span>
            </div>
        </div>
    );
}
