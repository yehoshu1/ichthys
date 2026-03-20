"use client";

import * as React from "react";
import { ChevronDownIcon, Clock3Icon } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0"));

function parseTimeValue(value?: string | null): { hour: string; minute: string } | null {
    if (!value) return null;
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;

    return {
        hour: match[1],
        minute: match[2],
    };
}

function formatTimeValue(date?: Date | null): string {
    if (!date) return "";

    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

interface TimePickerProps {
    value?: string | null;
    onChange?: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    allowClear?: boolean;
}

export function TimePicker({
    value,
    onChange,
    placeholder = "Select time",
    disabled = false,
    className,
    allowClear = false,
}: TimePickerProps) {
    const parsedValue = React.useMemo(() => parseTimeValue(value), [value]);
    const [isOpen, setIsOpen] = React.useState(false);
    const [hour, setHour] = React.useState(parsedValue?.hour ?? "");
    const [minute, setMinute] = React.useState(parsedValue?.minute ?? "");

    React.useEffect(() => {
        setHour(parsedValue?.hour ?? "");
        setMinute(parsedValue?.minute ?? "");
    }, [parsedValue]);

    function commit(nextHour: string, nextMinute: string) {
        if (!nextHour || !nextMinute) {
            return;
        }

        onChange?.(`${nextHour}:${nextMinute}`);
    }

    function handleHourChange(nextHour: string) {
        setHour(nextHour);
        if (minute) {
            commit(nextHour, minute);
        }
    }

    function handleMinuteChange(nextMinute: string) {
        setMinute(nextMinute);
        if (hour) {
            commit(hour, nextMinute);
        }
    }

    function handleNow() {
        const now = new Date();
        const nextHour = now.getHours().toString().padStart(2, "0");
        const nextMinute = now.getMinutes().toString().padStart(2, "0");

        setHour(nextHour);
        setMinute(nextMinute);
        onChange?.(`${nextHour}:${nextMinute}`);
        setIsOpen(false);
    }

    function handleClear() {
        setHour("");
        setMinute("");
        onChange?.(null);
        setIsOpen(false);
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal",
                        !parsedValue && "text-muted-foreground",
                        className
                    )}
                >
                    <span>{parsedValue ? `${hour}:${minute}` : placeholder}</span>
                    <Clock3Icon className="h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
                <FieldGroup className="flex-row items-end gap-3">
                    <Field className="min-w-0 flex-1">
                        <FieldLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                            Hour
                        </FieldLabel>
                        <Select value={hour} onValueChange={handleHourChange} disabled={disabled}>
                            <SelectTrigger>
                                <SelectValue placeholder="HH" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {HOURS.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field className="min-w-0 flex-1">
                        <FieldLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                            Minute
                        </FieldLabel>
                        <Select value={minute} onValueChange={handleMinuteChange} disabled={disabled}>
                            <SelectTrigger>
                                <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {MINUTES.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                </FieldGroup>

                <div className="mt-3 flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleNow} disabled={disabled}>
                        Now
                    </Button>
                    {allowClear ? (
                        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={disabled}>
                            Clear
                        </Button>
                    ) : null}
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface DateTimePickerProps {
    value?: Date | null;
    onChange?: (date: Date | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    minDate?: Date;
    allowClear?: boolean;
}

export function DateTimePicker({
    value,
    onChange,
    placeholder = "Pick a date and time",
    disabled = false,
    className,
    minDate,
    allowClear = false,
}: DateTimePickerProps) {
    const [date, setDate] = React.useState<Date | undefined>(value || undefined);
    const [calendarOpen, setCalendarOpen] = React.useState(false);

    React.useEffect(() => {
        setDate(value || undefined);
    }, [value]);

    const timeValue = formatTimeValue(date);

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

    const handleTimeChange = (timeStr: string | null) => {
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

    const handleClear = () => {
        setDate(undefined);
        setCalendarOpen(false);
        onChange?.(null);
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

            <Field className="w-full sm:w-40">
                <FieldLabel className="sr-only">Time</FieldLabel>
                <TimePicker
                    value={timeValue}
                    onChange={handleTimeChange}
                    disabled={disabled}
                    placeholder="Select time"
                />
            </Field>

            {allowClear && date ? (
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={handleClear}
                    className="w-full sm:w-auto"
                >
                    Clear
                </Button>
            ) : null}
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
