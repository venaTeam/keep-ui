import { memo } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { AssistantLink, parseNavigationPath } from "@/entities/assistant";

type NavigationLinkProps = Pick<AssistantLink, "page" | "path" | "label">;

/**
 * A page the assistant offers to open; it opens only when clicked. Nothing is
 * shown for a path that is not one of the pages a link may open, nor for one
 * that opens another page than it names.
 */
export const NavigationLink = memo(function NavigationLink({
  page,
  path,
  label,
}: NavigationLinkProps) {
  const target = parseNavigationPath(path);
  if (!target || target.page !== page) {
    return null;
  }

  return (
    <Link
      href={path}
      data-cy="assistant-link"
      data-page={target.page}
      className="inline-flex max-w-full items-center gap-1.5 self-start rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-sm font-medium text-orange-700 hover:border-orange-400 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
    >
      <ArrowRightIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <bdi className="min-w-0 break-words">{label}</bdi>
    </Link>
  );
});
