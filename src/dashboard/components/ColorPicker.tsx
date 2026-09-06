"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ColorPickerProps {
    label?: string;
    value: string;
    onChange: (color: string) => void;
    description?: string;
}

const PRESET_COLORS = [
    "#5865F2", // Discord Blurple
    "#EB459E", // Discord Pink
    "#57F287", // Discord Green
    "#FEE75C", // Discord Yellow
    "#ED4245", // Discord Red
    "#3498db", // Blue
    "#9b59b6", // Purple
    "#e74c3c", // Red
    "#f39c12", // Orange
    "#1abc9c", // Teal
    "#2ecc71", // Green
    "#34495e", // Dark
    "#95a5a6", // Gray
    "#ffffff", // White
    "#000000", // Black
];

export function ColorPicker({ label, value, onChange, description }: ColorPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleColorSelect = (color: string) => {
        onChange(color);
        setIsOpen(false);
    };

    const isValidHex = (hex: string): boolean => {
        return /^#[0-9A-Fa-f]{6}$/.test(hex);
    };

    return (
        <div className="space-y-2" ref={pickerRef}>
            {label && <Label>{label}</Label>}
            <div className="flex gap-2">
                <div
                    className="w-10 h-10 rounded-md border cursor-pointer shadow-sm flex-shrink-0"
                    style={{ backgroundColor: isValidHex(value) ? value : "#5865F2" }}
                    onClick={() => setIsOpen(!isOpen)}
                    title="Click to select color"
                />
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#5865F2"
                    className="font-mono"
                />
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}

            {isOpen && (
                <div className="p-3 bg-card border rounded-md shadow-lg mt-2">
                    <div className="grid grid-cols-5 gap-2">
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color}
                                className="w-8 h-8 rounded-md border shadow-sm hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary"
                                style={{ backgroundColor: color }}
                                onClick={() => handleColorSelect(color)}
                                title={color}
                            />
                        ))}
                    </div>
                    <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                            <Input
                                type="color"
                                value={isValidHex(value) ? value : "#5865F2"}
                                onChange={(e) => onChange(e.target.value)}
                                className="w-12 h-8 p-1 cursor-pointer"
                            />
                            <span className="text-sm text-muted-foreground">Custom color</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ColorPicker;
