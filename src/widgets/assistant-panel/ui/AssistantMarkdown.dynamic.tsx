import dynamic from "next/dynamic";

const AssistantMarkdown = dynamic(
  () => import("./AssistantMarkdown").then((mod) => mod.AssistantMarkdown),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-4 w-1/2 animate-pulse rounded bg-gray-200"
        aria-hidden="true"
      />
    ),
  }
);

export { AssistantMarkdown };
