import { IncidentList } from "features/incidents/incident-list";

export default function Page() {
  return <IncidentList />;
}

export const metadata = {
  title: "Keep - Incidents",
  description: "List of incidents",
};
