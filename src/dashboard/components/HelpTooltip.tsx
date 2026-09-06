"use client";

import { HelpCircle, Info, AlertCircle, Lightbulb } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider as RadixTooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";
import { useTooltipsEnabled } from "./TooltipContext";
import { cn } from "../lib/utils";

type TooltipType = "info" | "help" | "warning" | "tip";

interface HelpTooltipProps {
    content: React.ReactNode;
    type?: TooltipType;
    className?: string;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    children?: React.ReactNode;
    showIcon?: boolean;
}

const iconMap = {
    info: Info,
    help: HelpCircle,
    warning: AlertCircle,
    tip: Lightbulb,
};

const colorMap = {
    info: "text-blue-500 hover:text-blue-600",
    help: "text-muted-foreground hover:text-foreground",
    warning: "text-amber-500 hover:text-amber-600",
    tip: "text-yellow-500 hover:text-yellow-600",
};

export function HelpTooltip({
    content,
    type = "help",
    className,
    side = "top",
    align = "center",
    children,
    showIcon = true,
}: HelpTooltipProps) {
    const tooltipsEnabled = useTooltipsEnabled();

    if (!tooltipsEnabled) {
        return null;
    }

    const Icon = iconMap[type];

    return (
        <RadixTooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children || (
                        <button
                            type="button"
                            className={cn(
                                "inline-flex items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                colorMap[type],
                                className
                            )}
                            aria-label="Help"
                        >
                            {showIcon && <Icon className="h-4 w-4" />}
                        </button>
                    )}
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    align={align}
                    className="max-w-xs text-sm leading-relaxed"
                >
                    {content}
                </TooltipContent>
            </Tooltip>
        </RadixTooltipProvider>
    );
}

interface ExampleBoxProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export function ExampleBox({ children, className, title = "Example" }: ExampleBoxProps) {
    const tooltipsEnabled = useTooltipsEnabled();

    if (!tooltipsEnabled) {
        return null;
    }

    return (
        <div
            className={cn(
                "mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900",
                className
            )}
        >
            <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>{title}:</strong> {children}
            </p>
        </div>
    );
}

interface HelperTextProps {
    children: React.ReactNode;
    className?: string;
}

export function HelperText({ children, className }: HelperTextProps) {
    const tooltipsEnabled = useTooltipsEnabled();

    if (!tooltipsEnabled) {
        return null;
    }

    return (
        <p className={cn("text-[0.8rem] text-muted-foreground", className)}>
            {children}
        </p>
    );
}

interface LabelWithTooltipProps {
    label?: React.ReactNode;
    tooltip: React.ReactNode;
    htmlFor?: string;
    className?: string;
    required?: boolean;
    children?: React.ReactNode;
}

export function LabelWithTooltip({
    label,
    tooltip,
    htmlFor,
    className,
    required,
    children,
}: LabelWithTooltipProps) {
    const tooltipsEnabled = useTooltipsEnabled();

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {children ? (
                <label
                    htmlFor={htmlFor}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    {children}
                    {required && <span className="text-destructive ml-1">*</span>}
                </label>
            ) : (
                <label
                    htmlFor={htmlFor}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </label>
            )}
            {tooltipsEnabled && (
                <RadixTooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Help"
                            >
                                <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="top"
                            className="max-w-xs text-sm leading-relaxed"
                        >
                            {tooltip}
                        </TooltipContent>
                    </Tooltip>
                </RadixTooltipProvider>
            )}
        </div>
    );
}
