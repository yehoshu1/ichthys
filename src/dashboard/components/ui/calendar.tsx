"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = "label",
    ...props
}: CalendarProps) {
    const defaultClassNames = getDefaultClassNames();

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            captionLayout={captionLayout}
            className={cn("p-3", className)}
            classNames={{
                root: cn("w-fit", defaultClassNames.root),
                months: cn("relative flex flex-col gap-4 sm:flex-row", defaultClassNames.months),
                month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
                month_caption: cn(
                    "flex h-9 w-full items-center justify-center px-9",
                    defaultClassNames.month_caption
                ),
                caption_label: cn(
                    "font-medium select-none",
                    captionLayout === "label"
                        ? "text-sm"
                        : "flex items-center gap-1 rounded-md text-sm [&>svg]:text-muted-foreground",
                    defaultClassNames.caption_label
                ),
                dropdowns: cn(
                    "flex h-9 items-center justify-center gap-1.5 text-sm font-medium",
                    defaultClassNames.dropdowns
                ),
                dropdown_root: cn(
                    "relative rounded-md",
                    defaultClassNames.dropdown_root
                ),
                dropdown: cn(
                    "absolute inset-0 opacity-0",
                    defaultClassNames.dropdown
                ),
                nav: cn(
                    "absolute inset-x-0 top-0 flex h-9 w-full items-center justify-between gap-1",
                    defaultClassNames.nav
                ),
                button_previous: cn(
                    buttonVariants({ variant: "outline" }),
                    "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                ),
                button_next: cn(
                    buttonVariants({ variant: "outline" }),
                    "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                ),
                month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
                weekdays: cn("flex", defaultClassNames.weekdays),
                weekday:
                    cn("w-9 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground", defaultClassNames.weekday),
                week: cn("mt-2 flex w-full", defaultClassNames.week),
                day: cn(
                    "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
                    defaultClassNames.day
                ),
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
                ),
                selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                today: "bg-accent text-accent-foreground",
                outside:
                    "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                disabled: "text-muted-foreground opacity-50",
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, className, ...chevronProps }) => (
                    orientation === "left"
                        ? <ChevronLeft className={cn("h-4 w-4", className)} {...chevronProps} />
                        : <ChevronRight className={cn("h-4 w-4", className)} {...chevronProps} />
                ),
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
