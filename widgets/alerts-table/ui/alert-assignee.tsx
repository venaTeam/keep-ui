interface Props {
  assignee: string | undefined;
}

// Render the assignee identifier already on the alert (a username/email) as
// plain text — no avatar, no user-roster fetch.
export default function AlertAssignee({ assignee }: Props) {
  if (!assignee) {
    return null;
  }

  return (
    <span className="truncate text-sm" title={assignee}>
      {assignee}
    </span>
  );
}
