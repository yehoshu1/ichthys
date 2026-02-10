"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
    CheckIcon,
    XCircle,
    ChevronDown,
    XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";

/**
 * Variants for the multi-select component to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on "variant" prop.
 */
const multiSelectVariants = cva(
    "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
    {
        variants: {
            variant: {
                default:
                    "border-foreground/10 drop-shadow-md text-foreground bg-card hover:bg-card/80",
                secondary:
                    "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                inverted: "inverted",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface MultiSelectOption {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    /**
     * Variants for the multi-select component.
     * @default "default"
     */
    variant?: VariantProps<typeof multiSelectVariants>["variant"];
    /**
     * Maximum number of items to display.
     * @default 3
     */
    maxCount?: number;
    /**
     * Modal popover.
     * @default false
     */
    modalPopover?: boolean;
    /**
     * If true, shows a "Select All" option.
     * @default false
     */
    showSelectAll?: boolean;
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
    (
        {
            options,
            values,
            onChange,
            variant = "default",
            placeholder = "Select options",
            searchPlaceholder = "Search...",
            emptyText = "No options found.",
            loading = false,
            disabled = false,
            className,
            maxCount = 3,
            modalPopover = false,
            showSelectAll = false,
        },
        ref
    ) => {
        const [open, setOpen] = React.useState(false);

        // Normalize values to handle empty strings
        const normalizedValues = React.useMemo(() => {
            return values.filter(v => v && v.trim() !== "");
        }, [values]);

        const handleUnselect = React.useCallback((optionValue: string) => {
            onChange(normalizedValues.filter((v) => v !== optionValue));
        }, [normalizedValues, onChange]);

        const handleToggle = React.useCallback((optionValue: string) => {
            if (normalizedValues.includes(optionValue)) {
                onChange(normalizedValues.filter((v) => v !== optionValue));
            } else {
                onChange([...normalizedValues, optionValue]);
            }
        }, [normalizedValues, onChange]);

        const handleClear = React.useCallback(() => {
            onChange([]);
        }, [onChange]);

        const handleSelectAll = React.useCallback(() => {
            if (normalizedValues.length === options.length) {
                onChange([]);
            } else {
                onChange(options.map((o) => o.value));
            }
        }, [normalizedValues.length, options, onChange]);

        // Create a map for quick label lookup
        const optionMap = React.useMemo(() => {
            return new Map(options.map((o) => [o.value, o]));
        }, [options]);

        return (
            <Popover
                open={open}
                onOpenChange={setOpen}
                modal={modalPopover}
            >
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between hover:bg-inherit",
                            normalizedValues.length > 1 ? "h-auto" : "h-10",
                            className
                        )}
                        onClick={() => setOpen(!open)}
                        disabled={disabled || loading}
                    >
                        {normalizedValues.length > 0 ? (
                            <div className="flex justify-between items-center w-full">
                                <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                                    {normalizedValues.slice(0, maxCount).map((value) => {
                                        const option = optionMap.get(value);
                                        const IconComponent = option?.icon;
                                        return (
                                            <Badge
                                                key={value}
                                                className={cn(
                                                    multiSelectVariants({ variant }),
                                                    "flex items-center gap-1 px-2 py-0.5"
                                                )}
                                            >
                                                {IconComponent && (
                                                    <IconComponent className="h-3 w-3" />
                                                )}
                                                <span className="text-xs">
                                                    {option?.label || value}
                                                </span>
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnselect(value);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleUnselect(value);
                                                        }
                                                    }}
                                                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                                >
                                                    <XCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                </span>
                                            </Badge>
                                        );
                                    })}
                                    {normalizedValues.length > maxCount && (
                                        <Badge
                                            className={cn(
                                                "bg-transparent text-foreground border-foreground/1 hover:bg-transparent",
                                                multiSelectVariants({ variant })
                                            )}
                                        >
                                            +{normalizedValues.length - maxCount} more
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    {loading ? (
                                        <span className="text-xs text-muted-foreground mr-2">Loading...</span>
                                    ) : null}
                                    <XIcon
                                        className="h-4 mx-2 cursor-pointer text-muted-foreground hover:text-foreground"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleClear();
                                        }}
                                    />
                                    <Separator
                                        orientation="vertical"
                                        className="flex min-h-6 h-full"
                                    />
                                    <ChevronDown className="h-4 mx-2 cursor-pointer text-muted-foreground" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full">
                                <span className="text-sm text-muted-foreground">
                                    {loading ? "Loading..." : placeholder}
                                </span>
                                <ChevronDown className="h-4 cursor-pointer text-muted-foreground" />
                            </div>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    onEscapeKeyDown={() => setOpen(false)}
                >
                    <Command>
                        <CommandInput
                            placeholder={searchPlaceholder}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpen(false);
                                }
                            }}
                        />
                        <CommandList>
                            <CommandEmpty>{loading ? "Loading..." : emptyText}</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-auto">
                                {showSelectAll && options.length > 0 && (
                                    <>
                                        <CommandItem
                                            key="select-all"
                                            onSelect={handleSelectAll}
                                            className="cursor-pointer"
                                        >
                                            <div
                                                className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    normalizedValues.length === options.length
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}
                                            >
                                                <CheckIcon className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">Select All</span>
                                        </CommandItem>
                                        <CommandSeparator />
                                    </>
                                )}
                                {options.map((option) => {
                                    const isSelected = normalizedValues.includes(option.value);
                                    const IconComponent = option.icon;
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            onSelect={() => handleToggle(option.value)}
                                            className="cursor-pointer"
                                        >
                                            <div
                                                className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}
                                            >
                                                <CheckIcon className="h-4 w-4" />
                                            </div>
                                            {IconComponent && (
                                                <IconComponent className="mr-2 h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{option.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <div className="flex items-center justify-between">
                                    {normalizedValues.length > 0 && (
                                        <>
                                            <CommandItem
                                                onSelect={handleClear}
                                                className="flex-1 justify-center cursor-pointer"
                                            >
                                                Clear all
                                            </CommandItem>
                                            <Separator
                                                orientation="vertical"
                                                className="flex min-h-6 h-full"
                                            />
                                        </>
                                    )}
                                    <CommandItem
                                        onSelect={() => setOpen(false)}
                                        className="flex-1 justify-center cursor-pointer max-w-full"
                                    >
                                        Close
                                    </CommandItem>
                                </div>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

MultiSelect.displayName = "MultiSelect";
