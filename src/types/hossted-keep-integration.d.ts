declare module "@hossted/keep-integration" {
  import { ReactNode } from "react";

  export type HosstedRequest = {
    fingerprint: string;
    payload: unknown;
  };

  export function HosstedWrapper(props: { children: ReactNode }): JSX.Element;

  export function HosstedButton(props: {
    request: HosstedRequest;
    onOpenDetail?: (request: HosstedRequest) => void;
    disableHosstedSidePanel?: boolean;
    disableTooltip?: boolean;
  }): JSX.Element | null;

  export function HosstedSidebarSection(props: {
    request: HosstedRequest;
  }): JSX.Element | null;

  export type HosstedResponseStatus = "loading" | "success" | "error";

  export type HosstedResponse = {
    id: string;
    status: HosstedResponseStatus;
    summary?: string;
    response?: string;
    thread_id?: string;
    error?: string;
    // Per-knowledge-base counts of the sources behind the response, keyed by
    // source kind; rendered as badges in HosstedSidebarSection.
    sources?: {
      hkb?: Record<string, number>;
      ckb?: Record<string, number>;
    };
  };

  export function useHosstedResponseStatus(
    id: string
  ): HosstedResponseStatus | undefined;

  export function subscribeHosstedResponses(
    callback: (response: HosstedResponse) => void
  ): () => void;

  export function setHosstedResponse(response: HosstedResponse): void;
  export function refreshHosstedResponse(response: HosstedResponse): void;
}

declare module "@hossted/keep-integration/styles.css";
