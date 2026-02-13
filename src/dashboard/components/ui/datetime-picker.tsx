"use client";

import * as React from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
    value?: Date | null;
    onChange?: (date: Date | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    minDate?: Date;
}

export function DateTimePicker({
    value,
    onChange,
    placeholder = "MM/DD/YYYY hh:mm aa",
    disabled = false,
    className,
    minDate,
}: DateTimePickerProps) {
    const [date, setDate] = React.useState<Date | undefined>(value || undefined);
    const [isOpen, setIsOpen] = React.useState(false);

    // Update internal state when value prop changes
    React.useEffect(() => {
        setDate(value || undefined);
    }, [value]);

    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (selectedDate) {
            // Preserve time from existing date if available
            if (date) {
                selectedDate.setHours(date.getHours(), date.getMinutes());
            }
            setDate(selectedDate);
            onChange?.(selectedDate);
        } else {
            setDate(undefined);
            onChange?.(null);
        }
    };

    const handleTimeChange = (
        type: "hour" | "minute" | "ampm",
        val: string
    ) => {
        const currentDate = date || new Date();
        const newDate = new Date(currentDate);

        if (type === "hour") {
            const hour = parseInt(val);
            const isPM = newDate.getHours() >= 12;
            newDate.setHours((hour % 12) + (isPM ? 12 : 0));
        } else if (type === "minute") {
            newDate.setMinutes(parseInt(val));
        } else if (type === "ampm") {
            const currentHours = newDate.getHours();
            const isPM = val === "PM";
            const hour12 = currentHours % 12;
            newDate.setHours(hour12 + (isPM ? 12 : 0));
        }

        setDate(newDate);
        onChange?.(newDate);
    };

    const isDisabled = (day: Date) => {
        if (!minDate) return false;
        return day < new Date(minDate.setHours(0, 0, 0, 0));
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? (
                        format(date, "MM/dd/yyyy hh:mm aa")
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleDateSelect}
                        disabled={isDisabled}
                        initialFocus
                    />
                    <div className="flex border-l border-border">
                        {/* Hours */}
                        <div className="w-[60px] border-r border-border overflow-y-auto max-h-[300px]">
                            <div className="flex flex-col p-1">
                                {hours.map((hour) => (
                                    <Button
                                        key={hour}
                                        type="button"
                                        size="sm"
                                        variant={
                                            date && date.getHours() % 12 === hour % 12
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="h-8 text-xs justify-center"
                                        onClick={() => handleTimeChange("hour", hour.toString())}
                                    >
                                        {hour}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Minutes */}
                        <div className="w-[60px] border-r border-border overflow-y-auto max-h-[300px]">
                            <div className="flex flex-col p-1">
                                {minutes.map((minute) => (
                                    <Button
                                        key={minute}
                                        type="button"
                                        size="sm"
                                        variant={
                                            date && date.getMinutes() === minute
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="h-8 text-xs justify-center"
                                        onClick={() =>
                                            handleTimeChange("minute", minute.toString())
                                        }
                                    >
                                        {minute.toString().padStart(2, "0")}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        
                        {/* AM/PM */}
                        <div className="w-[60px] overflow-y-auto max-h-[300px]">
                            <div className="flex flex-col p-1">
                                {["AM", "PM"].map((ampm) => (
                                    <Button
                                        key={ampm}
                                        type="button"
                                        size="sm"
                                        variant={
                                            date &&
                                                ((ampm === "AM" && date.getHours() < 12) ||
                                                    (ampm === "PM" && date.getHours() >= 12))
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="h-8 text-xs justify-center"
                                        onClick={() => handleTimeChange("ampm", ampm)}
                                    >
                                        {ampm}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between gap-2 p-3 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDate(undefined);
                            onChange?.(null);
                        }}
                    >
                        Clear
                    </Button>
                    <Button type="button" size="sm" onClick={() => setIsOpen(false)}>
                        Done
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface DatePickerProps {
    value?: Date | null;
    onChange?: (date: Date | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    minDate?: Date;
}

export function DatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
    disabled = false,
    className,
    minDate,
}: DatePickerProps) {
    const [date, setDate] = React.useState<Date | undefined>(value || undefined);
    const [isOpen, setIsOpen] = React.useState(false);

    // Update internal state when value prop changes
    React.useEffect(() => {
        setDate(value || undefined);
    }, [value]);

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (selectedDate) {
            setDate(selectedDate);
            onChange?.(selectedDate);
            setIsOpen(false);
        } else {
            setDate(undefined);
            onChange?.(null);
        }
    };

    const isDisabled = (day: Date) => {
        if (!minDate) return false;
        return day < new Date(minDate.setHours(0, 0, 0, 0));
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM d, yyyy") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    disabled={isDisabled}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
