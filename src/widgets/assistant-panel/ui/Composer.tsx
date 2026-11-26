import { KeyboardEvent, RefObject } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { Textarea } from "@tremor/react";
import { Button } from "@/components/ui";
import { MAX_MESSAGE_CHARS } from "@/entities/assistant";

interface ComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** An answer is arriving: the next message has to wait. */
  isBusy: boolean;
}

/** The next message. Enter sends it, Shift+Enter starts a new line. */
export function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  isBusy,
}: ComposerProps) {
  const canSend = !isBusy && value.trim() !== "";

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter also ends the composition of a character
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (canSend) {
      onSend();
    }
  };

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) {
          onSend();
        }
      }}
    >
      <Textarea
        ref={inputRef}
        rows={3}
        value={value}
        maxLength={MAX_MESSAGE_CHARS}
        placeholder="Ask the assistant…"
        aria-label="Message to the assistant"
        data-cy="assistant-composer-input"
        className="max-h-40 resize-none"
        onValueChange={onChange}
        onKeyDown={onKeyDown}
      />
      <Button
        type="submit"
        variant="primary"
        color="orange"
        size="xs"
        icon={PaperAirplaneIcon}
        aria-label="Send"
        data-cy="assistant-composer-send"
        disabled={!canSend}
      />
    </form>
  );
}
