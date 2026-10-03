"use client";

import {
  Award,
  Box,
  CalendarDays,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "Supplies", href: "/supply", icon: Package },
      { title: "Tools", href: "/tool", icon: Wrench },
      { title: "Skills", href: "/skill", icon: Award },
      { title: "Shifts", href: "/shift", icon: Clock },
      { title: "Employees", href: "/employee", icon: Users },
    ],
  },
  {
    label: "Production",
    items: [
      { title: "Phases", href: "/phase", icon: Workflow },
      { title: "Products", href: "/product", icon: Box },
    ],
  },
  {
    label: "Orders",
    items: [
      { title: "Supply orders", href: "/supply-order", icon: Truck },
      { title: "Product orders", href: "/product-order", icon: ClipboardList },
    ],
  },
  {
    label: "Planning",
    items: [{ title: "Schedule", href: "/schedule", icon: CalendarDays }],
  },
];

/** `/supply` is active on `/supply` and below, but not on `/supply-order`. */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMain() {
  const pathname = usePathname();

  return groups.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={isActive(pathname, item.href)}
              tooltip={item.title}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
}
