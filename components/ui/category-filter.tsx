"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

interface CategoryFilterProps {
  selectedCategories: string[];
  onSelectionChange: (selected: string[]) => void;
  categories: string[];
}

export function CategoryFilter({
  selectedCategories,
  onSelectionChange,
  categories,
}: CategoryFilterProps) {
  const [open, setOpen] = React.useState(false);

  function handleToggle(name: string) {
    const next = selectedCategories.includes(name)
      ? selectedCategories.filter((c) => c !== name)
      : [...selectedCategories, name];

    // If all categories are selected, reset to empty (no filter)
    onSelectionChange(next.length === categories.length ? [] : next);
  }

  const count = selectedCategories.length;

  let triggerLabel: React.ReactNode;
  if (count === 0) {
    triggerLabel = <span className="text-sm">All Categories</span>;
  } else if (count === 1) {
    triggerLabel = <span className="text-sm">{selectedCategories[0]}</span>;
  } else {
    triggerLabel = (
      <span className="flex items-center gap-1.5 text-sm">
        Category
        <span className="bg-blue-600 text-white text-xs font-medium rounded-full px-1.5 py-0.5 leading-none">
          {count}
        </span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "min-w-[176px]"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {triggerLabel}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandList>
            {categories.length === 0 ? (
              <CommandEmpty>No categories found.</CommandEmpty>
            ) : (
              categories.map((name) => {
                const checked = selectedCategories.includes(name);
                return (
                  <CommandItem
                    key={name}
                    onSelect={() => handleToggle(name)}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => handleToggle(name)}
                      aria-label={name}
                      className="pointer-events-none"
                    />
                    <span>{name}</span>
                  </CommandItem>
                );
              })
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
