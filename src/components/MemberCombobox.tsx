import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MemberComboboxItem {
  id: string;
  name: string;
  member_code: string;
  points: number;
}

interface MemberComboboxProps {
  members: MemberComboboxItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MemberCombobox({
  members,
  value,
  onChange,
  placeholder = "Pilih member (opsional)",
}: MemberComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => (value && value !== "none" ? members.find((m) => m.id === value) : null),
    [value, members]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected
              ? `${selected.name} (${selected.member_code}) - ${selected.points} poin`
              : value === "none"
              ? "Bukan member"
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.toLowerCase().trim();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Cari nama atau kode member..." />
          <CommandList>
            <CommandEmpty>Tidak ada member ditemukan.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="bukan member none"
                onSelect={() => {
                  onChange("none");
                  setOpen(false);
                }}
              >
                <UserX className="mr-2 h-4 w-4" />
                Bukan member
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    value === "none" ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.name} ${member.member_code}`}
                  onSelect={() => {
                    onChange(member.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {member.member_code} · {member.points} poin
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === member.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
