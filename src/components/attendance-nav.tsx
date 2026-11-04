"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import {
  ATTENDANCE_BASE,
  ATTENDANCE_GROUPS,
  ATTENDANCE_SECTIONS,
  canOpenSection,
  sectionFromPath,
  sectionHref,
  type AttendanceAccess,
  type AttendanceGroup,
  type AttendanceSection,
} from "@/components/attendance/sections";
import { cn } from "@/lib/utils";

export type AttendanceCounts = { overtime: number; requests: number };

function CountBadge({ value, label }: { value: number; label: string }) {
  if (!value) return null;
  return (
    <Badge variant="destructive" className="ml-auto rounded-sm px-1.5 py-0.5 text-[11px]" aria-label={`${label}: ${value}`} role="status">
      {value}
    </Badge>
  );
}

type NavState = { open: boolean; groups: Record<AttendanceGroup, boolean> };

const STORAGE_KEY = "wareops.attendanceNav";
const DEFAULT_STATE: NavState = {
  open: false,
  groups: { Daily: true, Approval: true, Records: true, People: true, Administration: false },
};

function readState(): NavState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<NavState> | null;
    return { open: saved?.open ?? DEFAULT_STATE.open, groups: { ...DEFAULT_STATE.groups, ...(saved?.groups ?? {}) } };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Attendance in the WareOps sidebar: Attendance and each of its groups fold and unfold on
 * their own, and the choice is remembered in this browser. The open page's group is always
 * unfolded. With the sidebar collapsed to icons the pages are in a pop-out menu instead.
 */
export function AttendanceNavItem({ counts, me }: { counts: AttendanceCounts | null; me: AttendanceAccess | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const inside = !!pathname?.startsWith(ATTENDANCE_BASE);
  const active = sectionFromPath(pathname);
  const activeGroup = ATTENDANCE_SECTIONS.find((s) => s.key === active)?.group;
  const [nav, setNav] = useState<NavState>({ ...DEFAULT_STATE, open: inside });
  const [loaded, setLoaded] = useState(false);

  // Saved state is read after mount (no localStorage on the server).
  useEffect(() => {
    setNav(readState());
    setLoaded(true);
  }, []);
  // The open page and its group are always shown, also after a refresh.
  useEffect(() => {
    if (!loaded || !inside) return;
    setNav((n) => (n.open && (!activeGroup || n.groups[activeGroup]) ? n : { open: true, groups: activeGroup ? { ...n.groups, [activeGroup]: true } : n.groups }));
  }, [loaded, inside, activeGroup]);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(nav));
  }, [loaded, nav]);

  const open = nav.open;
  const setOpen = (value: boolean | ((v: boolean) => boolean)) => setNav((n) => ({ ...n, open: typeof value === "function" ? value(n.open) : value }));
  const toggleGroup = (group: AttendanceGroup) => setNav((n) => ({ ...n, groups: { ...n.groups, [group]: !n.groups[group] } }));
  // Until the user's rights are known, show only pages everyone can open.
  const sections = ATTENDANCE_SECTIONS.filter((s) => (me ? canOpenSection(s, me) : s.access === "all"));
  const count = (s: AttendanceSection) => (s.badge && counts ? counts[s.badge] : 0);
  const total = counts ? counts.overtime + counts.requests : 0;
  const done = () => isMobile && setOpenMobile(false);

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={inside} tooltip={{ children: "Attendance" }}>
              <MapPinned />
              <span>Attendance</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            {ATTENDANCE_GROUPS.map((group, i) => {
              const items = sections.filter((s) => s.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{group}</DropdownMenuLabel>
                  {items.map((s) => (
                    <DropdownMenuItem key={s.key} asChild className={cn(active === s.key && "bg-accent font-medium")}>
                      <Link href={sectionHref(s.key)}>
                        <s.icon className="mr-2 h-4 w-4" />
                        {s.label}
                        <CountBadge value={count(s)} label={s.label} />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={inside && !open}
        tooltip={{ children: "Attendance" }}
        aria-expanded={open}
        onClick={() => {
          if (!inside) {
            setOpen(true);
            router.push(ATTENDANCE_BASE);
            done();
          } else {
            setOpen((v) => !v);
          }
        }}
      >
        <MapPinned />
        <span>Attendance</span>
        {!open && <CountBadge value={total} label="Waiting for your approval" />}
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", !open && "-rotate-90", !open && total > 0 && "ml-1")} />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {ATTENDANCE_GROUPS.map((group) => {
            const items = sections.filter((s) => s.group === group);
            if (!items.length) return null;
            const folded = !nav.groups[group];
            return (
              <li key={group} className="list-none">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={!folded}
                  className="flex w-full items-center gap-1 rounded-sm px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {group}
                  {folded && items.some((s) => count(s)) && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />}
                  <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", folded && "-rotate-90")} />
                </button>                {!folded && (
                  <ul className="flex flex-col gap-0.5">
                    {items.map((s) => (
                      <SidebarMenuSubItem key={s.key}>
                        <SidebarMenuSubButton asChild isActive={active === s.key}>
                          <Link href={sectionHref(s.key)} onClick={done}>
                            <s.icon />
                            <span className="truncate">{s.label}</span>
                            <CountBadge value={count(s)} label={s.label} />
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
