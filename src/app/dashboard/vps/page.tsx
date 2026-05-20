// The shell rendered by `vps/layout.tsx` already shows the active instance
// view on /dashboard/vps via its built-in `renderMain` fallback. This page
// component intentionally returns null so the layout's children slot stays
// empty for the index segment.
export default function VpsPage() {
  return null;
}
