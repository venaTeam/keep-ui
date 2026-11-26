import { Button } from "@/components/ui";
import { ChatError } from "@/entities/assistant";
import { useSignOut } from "@/shared/lib/hooks/useSignOut";

function getText({ message, retryAfterSeconds }: ChatError): string {
  return retryAfterSeconds
    ? `${message} You can try again in ${retryAfterSeconds} s.`
    : message;
}

interface ErrorNoticeProps {
  error: ChatError;
  /** Absent for an error that only the next message gets rid of. */
  onRetry?: () => void;
}

/** Why there is no answer, and what can be done about it. */
export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const signOut = useSignOut();

  return (
    <div
      role="alert"
      data-cy="assistant-error"
      data-code={error.code ?? undefined}
      className="flex items-center justify-between gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
    >
      <span className="min-w-0 whitespace-pre-wrap break-words">
        {getText(error)}
      </span>
      {error.code === "unauthenticated" ? (
        <Button
          type="button"
          variant="secondary"
          color="red"
          size="xs"
          data-cy="assistant-error-sign-in"
          onClick={signOut}
        >
          Sign in again
        </Button>
      ) : (
        onRetry && (
          <Button
            type="button"
            variant="secondary"
            color="red"
            size="xs"
            data-cy="assistant-error-retry"
            onClick={onRetry}
          >
            Try again
          </Button>
        )
      )}
    </div>
  );
}
