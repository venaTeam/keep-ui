import UserAvatar from "@/components/navbar/UserAvatar";
import { useUser } from "../model/useUser";
import { Icon } from "@tremor/react";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

type Size = "sm" | "xs";

function FallbackIcon({ size }: { size: Size }) {
  const sizeClass = size === "sm" ? "[&>svg]:w-7 [&>svg]:h-7" : "[&>svg]:w-5 [&>svg]:h-5";
  return (
    <Icon icon={UserCircleIcon} className={clsx("text-gray-600 !p-0", sizeClass)} />
  );
}

// Resolves the email against the user roster (useUser -> useUsers) to show the
// user's name/picture. Pulls the whole roster, so use only off the hot paths.
function UserStatefulAvatarWithRoster({
  email,
  size = "sm",
}: {
  email: string;
  size?: Size;
}) {
  const user = useUser(email);
  if (!user) {
    return <FallbackIcon size={size} />;
  }
  return (
    <UserAvatar name={user?.name} image={user?.picture} size={size} email={email} />
  );
}

// Email-only mode: renders from the email alone, without fetching the roster
// (no useUser/useUsers call). For hot paths where the identifier is already on
// the record and resolving a name isn't worth a roster fetch.
function UserStatefulAvatarEmailOnly({
  email,
  size = "sm",
}: {
  email: string;
  size?: Size;
}) {
  if (!email) {
    return <FallbackIcon size={size} />;
  }
  return <UserAvatar name={email} image={null} size={size} email={email} />;
}

export function UserStatefulAvatar({
  email,
  size = "sm",
  emailOnly = false,
}: {
  email: string;
  size?: Size;
  // When true, render from the email without pulling the user roster.
  emailOnly?: boolean;
}) {
  // No hook is called in this component, so branching before the hook-bearing
  // children is safe (the hook lives inside UserStatefulAvatarWithRoster).
  if (emailOnly) {
    return <UserStatefulAvatarEmailOnly email={email} size={size} />;
  }
  return <UserStatefulAvatarWithRoster email={email} size={size} />;
}
