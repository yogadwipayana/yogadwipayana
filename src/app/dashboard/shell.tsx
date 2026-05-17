"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  HelpCircle,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import type { ToolId } from "./data";

import {
  AI_ROUTES,
  CHAT_CONVERSATIONS,
  TOOLS,
  VPS_INSTANCES,
} from "./data";
import type { Tool } from "./data";
import {
  AiOverview,
  ChatView,
  PlaceholderView,
  VpsView,
} from "./views";

/* -------------------------------------------------------------------------- */
/*  Sub-sidebar sections                                                      */
/* -------------------------------------------------------------------------- */

type SubItem = { id: string; label: string; external?: boolean; status?: string; href?: string };
type SubSection = { title: string; items: SubItem[] };

const TOOL_SECTIONS: Record<ToolId, SubSection[]> = {
  vps: [
    {
      title: "Instances",
      items: VPS_INSTANCES.map((i) => ({ id: i.id, label: i.name, status: i.status })),
    },
    {
      title: "Platform",
      items: [
        { id: "vps:byok", label: "BYOK", href: "/dashboard/vps/byok" },
      ],
    },
  ],
  ai: [
    {
      title: "Settings",
      items: [
        { id: "ai:usage",   label: "Usage",   href: "/dashboard/ai/usage" },
        { id: "ai:keys",    label: "Keys",    href: "/dashboard/ai/keys" },
        { id: "ai:billing", label: "Billing", href: "/dashboard/ai/billing" },
      ],
    },
    {
      title: "Reference",
      items: [
        { id: "ai:models", label: "Models", href: "/dashboard/ai/models" },
      ],
    },
  ],
  chat: [
    {
      title: "Conversations",
      items: CHAT_CONVERSATIONS.map((c) => ({ id: c.id, label: c.title })),
    },
    {
      title: "Configuration",
      items: [
        { id: "chat:models", label: "Models" },
        { id: "chat:prompts", label: "System Prompts" },
        { id: "chat:memory", label: "Memory" },
      ],
    },
    {
      title: "Platform",
      items: [{ id: "chat:usage", label: "Usage" }],
    },
  ],
};

const PLACEHOLDER_LABELS: Record<string, { title: string; description: string }> = {
  "ai:fallbacks": { title: "Fallbacks", description: "Per-route fallback chain when the primary model fails." },
  "chat:models": { title: "Models", description: "Default and per-conversation model selection." },
  "chat:prompts": { title: "System Prompts", description: "Reusable prompt blocks pinned across conversations." },
  "chat:memory": { title: "Memory", description: "Long-term memory entries the assistant references." },
  "chat:usage": { title: "Usage", description: "Tokens and conversation activity over time." },
};

/* -------------------------------------------------------------------------- */
/*  Shell                                                                     */
/* -------------------------------------------------------------------------- */

export function DashboardShell({ toolId, children }: { toolId: ToolId; children?: React.ReactNode }) {
  const [activeItems, setActiveItems] = useState<Record<ToolId, string>>({
    vps: VPS_INSTANCES[0].id,
    ai: "ai:usage",
    chat: CHAT_CONVERSATIONS[0].id,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tool = useMemo(
    () => TOOLS.find((t) => t.id === toolId) ?? TOOLS[0],
    [toolId],
  );

  const sections = TOOL_SECTIONS[toolId];

  const setItem = (id: string) =>
    setActiveItems((prev) => ({ ...prev, [toolId]: id }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <TopBar
        tool={tool}
        onMenuOpen={() => setDrawerOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Primary sidebar (icon rail) — desktop only */}
        <PrimarySidebar activeTool={toolId} />

        {/* Sub-sidebar — desktop only */}
        <SubSidebar
          tool={tool}
          sections={sections}
          activeItem={activeItems[toolId]}
          onSelectItem={setItem}
        />

        {/* Main working surface */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#1c1c1c]">
          {children ?? renderMain(toolId, activeItems[toolId])}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <MobileDrawer
          tool={tool}
          sections={sections}
          activeTool={toolId}
          activeItem={activeItems[toolId]}
          onSelectItem={(id) => {
            setItem(id);
            setDrawerOpen(false);
          }}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main content router                                                       */
/* -------------------------------------------------------------------------- */

function renderMain(activeTool: ToolId, activeItemId: string): React.ReactNode {
  // Configuration / Platform pages use prefixed IDs (e.g. "vps:ssh-keys")
  if (activeItemId.includes(":")) {
    const meta = PLACEHOLDER_LABELS[activeItemId];
    return (
      <PlaceholderView
        title={meta?.title ?? "Coming soon"}
        description={
          meta?.description ?? "This page hasn't been built yet."
        }
      />
    );
  }

  if (activeTool === "vps") {
    const instance =
      VPS_INSTANCES.find((i) => i.id === activeItemId) ?? VPS_INSTANCES[0];
    return <VpsView instance={instance} />;
  }
  if (activeTool === "ai") {
    return <AiOverview />;
  }
  const conversation =
    CHAT_CONVERSATIONS.find((c) => c.id === activeItemId) ??
    CHAT_CONVERSATIONS[0];
  return <ChatView conversation={conversation} />;
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                   */
/* -------------------------------------------------------------------------- */

function TopBar({
  tool,
  onMenuOpen,
}: {
  tool: Tool;
  onMenuOpen: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0c0c0c] px-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>

        <Link
          href="/"
          className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium tracking-[-0.01em] text-white/85 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[#3ecf8e] shadow-[0_0_8px_#3ecf8e]"
          />
          yoga
        </Link>

        <Crumb />

        <span className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-white/70">
          <tool.icon className="h-3.5 w-3.5 text-white/45" aria-hidden />
          <span className="truncate">{tool.name}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="hidden h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] pr-1.5 pl-2.5 text-[12px] text-white/55 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80 md:inline-flex"
        >
          <Search className="h-3 w-3" aria-hidden />
          <span>Search…</span>
          <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono text-[10px] text-white/40">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          aria-label="Search"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 hover:text-white md:hidden"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Help"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Account"
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#3ecf8e] to-[#24b47e] font-mono text-[11px] font-medium text-[#171717] hover:opacity-90"
        >
          y
        </button>
      </div>
    </header>
  );
}

function Crumb() {
  return (
    <span aria-hidden className="px-1 text-white/25">
      /
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Primary sidebar (icon rail, no expand)                                    */
/* -------------------------------------------------------------------------- */

function PrimarySidebar({ activeTool }: { activeTool: ToolId }) {
  return (
    <div className="relative hidden w-12 shrink-0 sm:block">
      <aside className="group absolute inset-y-0 left-0 z-20 flex w-12 flex-col overflow-hidden border-r border-white/[0.08] bg-[#0f0f0f] py-2 transition-[width] duration-200 ease-out hover:w-[220px] hover:shadow-[8px_0_24px_rgba(0,0,0,0.35)]">
        <nav
          aria-label="Tools"
          className="flex flex-col gap-0.5 px-1.5"
        >
          <RailButton
            icon={<Home className="h-4 w-4" aria-hidden />}
            label="Home"
            href="/"
          />

          <Separator />

          {TOOLS.map((t) => (
            <RailButton
              key={t.id}
              icon={<t.icon className="h-4 w-4" aria-hidden />}
              label={t.name}
              active={t.id === activeTool}
              href={`/dashboard/${t.id}`}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 px-1.5">
          <Separator />
          <RailButton
            icon={<Settings className="h-4 w-4" aria-hidden />}
            label="Settings"
          />
        </div>
      </aside>
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="my-1 h-px w-full bg-white/[0.06]" />;
}

function RailButton({
  icon,
  label,
  active,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = `relative flex h-9 w-full items-center gap-2 rounded-md text-[13px] transition-colors ${
    active
      ? "bg-white/[0.06] text-white"
      : "text-white/55 hover:bg-white/[0.04] hover:text-white"
  }`;

  const inner = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {label}
      </span>
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[#3ecf8e]"
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        className={cls}
        onClick={onClick}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cls}
    >
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-sidebar (sectioned navigation)                                        */
/* -------------------------------------------------------------------------- */

function SubSidebar({
  tool,
  sections,
  activeItem,
  onSelectItem,
}: {
  tool: Tool;
  sections: SubSection[];
  activeItem: string;
  onSelectItem: (id: string) => void;
}) {
  return (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-white/[0.08] bg-[#171717] sm:flex md:w-[220px]">
      <SubSidebarHeader tool={tool} />
      <SubSidebarBody
        sections={sections}
        activeItem={activeItem}
        onSelectItem={onSelectItem}
      />
    </aside>
  );
}

const TOOL_CREATE_HREF: Partial<Record<ToolId, string>> = {
  vps: "/dashboard/vps/byok",
  ai:  "/dashboard/ai/keys",
};

function SubSidebarHeader({ tool }: { tool: Tool }) {
  const createHref = TOOL_CREATE_HREF[tool.id];
  const btnCls =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/70 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10 hover:text-[#3ecf8e]";

  return (
    <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
        {tool.name}
      </h2>
      {createHref ? (
        <Link
          href={createHref}
          aria-label={tool.createLabel}
          title={tool.createLabel}
          className={btnCls}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : (
        <button
          type="button"
          aria-label={tool.createLabel}
          title={tool.createLabel}
          className={btnCls}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </header>
  );
}

function SubSidebarBody({
  sections,
  activeItem,
  onSelectItem,
}: {
  sections: SubSection[];
  activeItem: string;
  onSelectItem: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Sub navigation"
      className="flex-1 overflow-y-auto p-2"
    >
      {sections.map((section) => (
        <div key={section.title} className="mb-3 last:mb-0">
          <h3 className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
            {section.title}
          </h3>
          <ul className="flex flex-col gap-px">
            {section.items.map((item) => (
              <li key={item.id}>
                <SubItemButton
                  item={item}
                  active={item.id === activeItem}
                  onClick={() => onSelectItem(item.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SubItemButton({
  item,
  active,
  onClick,
}: {
  item: SubItem;
  active: boolean;
  onClick: () => void;
}) {
  const statusCls =
    item.status === "running"
      ? "bg-[#3ecf8e] shadow-[0_0_5px_#3ecf8e]"
      : item.status === "rebooting"
        ? "bg-amber-400"
        : item.status === "stopped"
          ? "bg-white/25"
          : null;

  const cls = `flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
    active
      ? "bg-white/[0.06] text-white"
      : "text-white/65 hover:bg-white/[0.04] hover:text-white"
  }`;

  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {statusCls && (
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusCls}`}
          />
        )}
        <span className="truncate">{item.label}</span>
      </span>
      {item.external ? (
        <ExternalLink className="h-3 w-3 shrink-0 text-white/35" aria-hidden />
      ) : null}
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile drawer                                                             */
/* -------------------------------------------------------------------------- */

function MobileDrawer({
  tool,
  sections,
  activeTool,
  activeItem,
  onSelectItem,
  onClose,
}: {
  tool: Tool;
  sections: SubSection[];
  activeTool: ToolId;
  activeItem: string;
  onSelectItem: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex sm:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      {/* Side-by-side layout: primary rail + sub-sidebar, mirroring desktop */}
      <aside className="relative flex w-[92%] max-w-[320px] bg-[#0f0f0f] shadow-[16px_0_48px_rgba(0,0,0,0.45)]">
        {/* Primary rail */}
        <div className="flex w-12 shrink-0 flex-col border-r border-white/[0.08] py-2">
          <nav
            aria-label="Tools"
            className="flex flex-col items-center gap-0.5 px-1.5"
          >
            <RailButton
              icon={<Home className="h-4 w-4" aria-hidden />}
              label="Home"
              href="/"
              onClick={onClose}
            />
            <Separator />
            {TOOLS.map((t) => (
              <RailButton
                key={t.id}
                icon={<t.icon className="h-4 w-4" aria-hidden />}
                label={t.name}
                active={t.id === activeTool}
                href={`/dashboard/${t.id}`}
                onClick={onClose}
              />
            ))}
          </nav>

          <div className="mt-auto flex flex-col items-center gap-0.5 px-1.5">
            <Separator />
            <RailButton
              icon={<Settings className="h-4 w-4" aria-hidden />}
              label="Settings"
            />
          </div>
        </div>

        {/* Sub-sidebar */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#171717]">
          <div className="flex h-12 items-center justify-between border-b border-white/[0.08] px-2">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center gap-2 px-1 text-[13px] font-medium tracking-[-0.01em]"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[#3ecf8e] shadow-[0_0_8px_#3ecf8e]"
              />
              yoga
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <SubSidebarHeader tool={tool} />
          <SubSidebarBody
            sections={sections}
            activeItem={activeItem}
            onSelectItem={onSelectItem}
          />
        </div>
      </aside>
    </div>
  );
}
