"use client";

import { SketchPicker } from "react-color";
import type { ColorResult } from "react-color";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  const handleChange = (color: ColorResult) => {
    onChange(color.hex);
  };

  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-8 w-14 rounded border shadow-sm transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: value }}
            title={value}
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border-0 shadow-xl"
          align="end"
          side="left"
          sideOffset={8}
        >
          <SketchPicker
            color={value}
            onChange={handleChange}
            disableAlpha
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
