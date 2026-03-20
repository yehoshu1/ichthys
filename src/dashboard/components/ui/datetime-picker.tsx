"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    placeholder = "Pick a date and time",
    disabled = false,
    className,
    minDate,
}: DateTimePickerProps) {
    const [date, setDate] = React.useState<Date | undefined>(value || undefined);
    const [calendarOpen, setCalendarOpen] = React.useState(false);

    React.useEffect(() => {
        setDate(value || undefined);
    }, [value]);

    const timeValue = date
        ? `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
        : "";

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (selectedDate) {
            const newDate = new Date(selectedDate);
            if (date) {
                newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
            } else {
                newDate.setHours(0, 0, 0, 0);
            }
            setDate(newDate);
            onChange?.(newDate);
            setCalendarOpen(false);
        } else {
            setDate(undefined);
            onChange?.(null);
        }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const timeStr = e.target.value;
        if (!timeStr) return;
        const base = date ? new Date(date) : new Date();
        const [hours, minutes] = timeStr.split(":").map(Number);
        base.setHours(hours, minutes, 0, 0);
        const updated = new Date(base);
        setDate(updated);
        onChange?.(updated);
    };

    const isDisabledDay = (day: Date) => {
        if (!minDate) return false;
        const normalizedMinDate = new Date(minDate);
        normalizedMinDate.setHours(0, 0, 0, 0);
        return day < normalizedMinDate;
    };

    return (
        <FieldGroup
            className={cn(
                "flex w-full flex-col gap-3 sm:flex-row sm:items-end",
                className
            )}
        >
            <Field className="min-w-0 flex-1">
                <FieldLabel className="sr-only">Date</FieldLabel>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            disabled={disabled}
                            className={cn(
                                "w-full justify-between font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            {date ? format(date, "PPP") : <span>{placeholder}</span>}
                            <ChevronDownIcon className="h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={date}
                            captionLayout="dropdown"
                            defaultMonth={date}
                            onSelect={handleDateSelect}
                            disabled={isDisabledDay}
                        />
                    </PopoverContent>
                </Popover>
            </Field>

            <Field className="w-full sm:w-36">
                <FieldLabel className="sr-only">Time</FieldLabel>
                <Input
                    type="time"
                    disabled={disabled}
                    value={timeValue}
                    onChange={handleTimeChange}
                    className="w-full appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
            </Field>
        </FieldGroup>
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

    const isDisabledDay = (day: Date) => {
        if (!minDate) return false;
        const normalizedMinDate = new Date(minDate);
        normalizedMinDate.setHours(0, 0, 0, 0);
        return day < normalizedMinDate;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    {date ? format(date, "MMM d, yyyy") : <span>{placeholder}</span>}
                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    captionLayout="dropdown"
                    defaultMonth={date}
                    onSelect={handleDateSelect}
                    disabled={isDisabledDay}
                />
            </PopoverContent>
        </Popover>
    );
}
