import * as React from "react"
import {
  BarChart,
  Command,
  FileText,
  // Frame,
  Hammer,
  Home,
  LifeBuoy,
  // Map,
  MessageCircle,
  PenTool,
  // PieChart,
  Send,
  Settings2,
  Users,
} from "lucide-react"

import { NavMain } from "./nav-main"
// import { NavProjects } from "./nav-projects"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

const data = {
  user: {
    name: "Brian Samu",
    email: "brian@briansamu.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: Home,
      isActive: true,
      items: [
        {
          title: "Overview",
          url: "#",
        },
        {
          title: "Insights",
          url: "#",
        },
        {
          title: "Alerts",
          url: "#",
        },
      ],
    },
    {
      title: "Content Strategy",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "Trend Explorer",
          url: "#",
        },
        {
          title: "Competitor Analysis",
          url: "#",
        },
        {
          title: "Content Calendar",
          url: "#",
        },
        {
          title: "Content Gaps",
          url: "#",
        },
      ],
    },
    {
      title: "Creation Hub",
      url: "#",
      icon: PenTool,
      items: [
        {
          title: "AI Writer",
          url: "#",
        },
        {
          title: "Editor",
          url: "#",
        },
        {
          title: "Templates",
          url: "#",
        },
        {
          title: "Asset Library",
          url: "#",
        },
      ],
    },
    {
      title: "Analytics",
      url: "#",
      icon: BarChart,
      items: [
        {
          title: "Performance",
          url: "#",
        },
        {
          title: "Audience",
          url: "#",
        },
        {
          title: "ROI Tracking",
          url: "#",
        },
        {
          title: "Custom Reports",
          url: "#",
        },
      ],
    },
    {
      title: "Social Intelligence",
      url: "#",
      icon: MessageCircle,
      items: [
        {
          title: "Social Monitor",
          url: "#",
        },
        {
          title: "Engagement Tracker",
          url: "#",
        },
        {
          title: "Influencer Database",
          url: "#",
        },
        {
          title: "Viral Content",
          url: "#",
        },
      ],
    },
    {
      title: "Tools",
      url: "#",
      icon: Hammer,
      items: [
        {
          title: "SEO Optimizer",
          url: "#",
        },
        {
          title: "Content Scorer",
          url: "#",
        },
        {
          title: "Image Generator",
          url: "#",
        },
        {
          title: "Distribution Manager",
          url: "#",
        },
      ],
    },
    {
      title: "Team/Workspace",
      url: "#",
      icon: Users,
      items: [
        {
          title: "Team Members",
          url: "#",
        },
        {
          title: "Client Accounts",
          url: "#",
        },
        {
          title: "Permissions",
          url: "#",
        },
        {
          title: "Collaboration",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Integrations",
          url: "#",
        },
        {
          title: "Notifications",
          url: "#",
        }
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
  // projects: [
  //   {
  //     name: "Design Engineering",
  //     url: "#",
  //     icon: Frame,
  //   },
  //   {
  //     name: "Sales & Marketing",
  //     url: "#",
  //     icon: PieChart,
  //   },
  //   {
  //     name: "Travel",
  //     url: "#",
  //     icon: Map,
  //   },
  // ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Samu Interactive LLC</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
