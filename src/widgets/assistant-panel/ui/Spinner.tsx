import { ArrowPathIcon } from "@heroicons/react/24/outline";

export function Spinner() {
  return (
    <ArrowPathIcon
      className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
}
