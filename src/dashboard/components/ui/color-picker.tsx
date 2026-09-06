"use client"

import * as React from "react"
import { Input } from "./input"
import { Label } from "./label"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"

interface ColorPickerProps {
    value: string
    onChange: (value: string) => void
    label?: string
}

const PRESET_COLORS = [
    "#5865F2", // Discord Blurple
    "#EB459E", // Discord Pink
    "#57F287", // Discord Green
    "#FEE75C", // Discord Yellow
    "#ED4245", // Discord Red
    "#5865F2", // Blue
    "#3B82F6", // Light Blue
    "#06B6D4", // Cyan
    "#10B981", // Emerald
    "#84CC16", // Lime
    "#EAB308", // Yellow
    "#F59E0B", // Amber
    "#F97316", // Orange
    "#EF4444", // Red
    "#EC4899", // Pink
    "#D946EF", // Fuchsia
    "#A855F7", // Purple
    "#8B5CF6", // Violet
    "#6366F1", // Indigo
    "#78716C", // Stone
]

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
    const [color, setColor] = React.useState(value || "#5865F2")

    React.useEffect(() => {
        if (value) setColor(value)
    }, [value])

    const handleChange = (newColor: string) => {
        setColor(newColor)
        onChange(newColor)
    }

    // Convert hex to rgb for the color input
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 88, g: 101, b: 242 }
    }

    // Convert rgb to hex
    const rgbToHex = (r: number, g: number, b: number) => {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    }

    const rgb = hexToRgb(color)

    return (
        <div className="space-y-2">
            {label && <Label>{label}</Label>}
            <div className="flex gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-10 h-10 p-0 border-2"
                            style={{ backgroundColor: color }}
                        >
                            <span className="sr-only">Pick a color</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                        <div className="space-y-3">
                            {/* Color Input */}
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => handleChange(e.target.value.toUpperCase())}
                                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                />
                                <Input
                                    value={color}
                                    onChange={(e) => handleChange(e.target.value.toUpperCase())}
                                    placeholder="#5865F2"
                                    className="font-mono flex-1"
                                />
                            </div>

                            {/* Preset Colors */}
                            <div className="grid grid-cols-5 gap-1">
                            {PRESET_COLORS.map((presetColor, index) => (
                                <button
                                    key={`${presetColor}-${index}`}
                                    onClick={() => handleChange(presetColor)}
                                    className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                                        style={{
                                            backgroundColor: presetColor,
                                            borderColor: color === presetColor ? "#000" : "transparent"
                                        }}
                                        title={presetColor}
                                    />
                                ))}
                            </div>

                            {/* RGB Sliders */}
                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs w-3">R</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="255"
                                        value={rgb.r}
                                        onChange={(e) => handleChange(rgbToHex(parseInt(e.target.value), rgb.g, rgb.b))}
                                        className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                                    />
                                    <span className="text-xs w-8 text-right">{rgb.r}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs w-3">G</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="255"
                                        value={rgb.g}
                                        onChange={(e) => handleChange(rgbToHex(rgb.r, parseInt(e.target.value), rgb.b))}
                                        className="flex-1 h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    />
                                    <span className="text-xs w-8 text-right">{rgb.g}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs w-3">B</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="255"
                                        value={rgb.b}
                                        onChange={(e) => handleChange(rgbToHex(rgb.r, rgb.g, parseInt(e.target.value)))}
                                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-xs w-8 text-right">{rgb.b}</span>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <Input
                    value={color}
                    onChange={(e) => handleChange(e.target.value.toUpperCase())}
                    placeholder="#5865F2"
                    className="font-mono flex-1"
                />
            </div>
        </div>
    )
}
