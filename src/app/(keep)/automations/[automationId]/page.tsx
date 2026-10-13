import { Suspense } from "react";
import { AutomationDetail } from "@/features/automations/detail";
export default async function AutomationPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const { automationId } = await params;
  return (
    <Suspense fallback={<p>Loading automation…</p>}>
      <AutomationDetail automationId={automationId} />
    </Suspense>
  );
}
