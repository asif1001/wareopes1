"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Flag, FileText, GanttChartSquare, MessageSquareWarning, Settings } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/shipments", label: "Shipments", icon: Flag },
    { href: "/dashboard/tasks", label: "Tasks", icon: GanttChartSquare },
    { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareWarning },
    { href: "/dashboard/reports", label: "Reports", icon: FileText },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-4 border-b">
                 <Boxes className="h-7 w-7 text-primary" />
                <h1 className="text-xl font-bold font-headline group-data-[collapsible=icon]:hidden">
                    WAREOPS
                </h1>
            </div>
            <div className="flex-1 overflow-y-auto">
                <SidebarMenu className="p-2">
                    {navItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton 
                                asChild
                                isActive={pathname === item.href}
                                tooltip={{children: item.label}}
                            >
                                <Link href={item.href}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </div>
        </div>
    );
}
