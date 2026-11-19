import { TimeFrame } from "@/components/ui/DateRangePicker";
import { TimeFrameV2 } from "@/components/ui/DateRangePickerV2";
import {
  DEFAULT_INCIDENTS_CEL,
  DEFAULT_INCIDENTS_PAGE_SIZE,
  DEFAULT_INCIDENTS_SORTING,
  PaginatedIncidentsDto,
} from "@/entities/incidents/model/models";
import { useRevalidateOnDismissalExpiry } from "@/entities/incidents/model";
import {
  IncidentsQuery,
  useIncidents,
  usePollIncidents,
} from "@/utils/hooks/useIncidents";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

// The incident with the earliest live "dismiss until", whatever the list shows.
// The default view filters to firing + acknowledged, so suppressed incidents are
// usually not on screen, yet the list still has to refresh when one lapses.
const NEXT_DISMISSAL_EXPIRY_QUERY: IncidentsQuery = {
  candidate: false,
  predicted: null,
  limit: 1,
  offset: 0,
  sorting: { id: "dismissed_until", desc: false },
  cel: "status == 'suppressed' && dismiss_mode == 'dismiss_until'",
};

export interface IncidentsTableDataQuery {
  candidate: boolean | null;
  predicted: boolean | null;
  limit: number;
  offset: number;
  sorting: { id: string; desc: boolean };
  filterCel: string | null;
  timeFrame: TimeFrameV2 | null;
}

export const useIncidentsTableData = (query: IncidentsTableDataQuery) => {
  const [shouldRefreshDate, setShouldRefreshDate] = useState<boolean>(false);
  const [canRevalidate, setCanRevalidate] = useState<boolean>(false);
  const [dateRangeCel, setDateRangeCel] = useState<string | null>("");
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [incidentsQueryState, setIncidentsQueryState] =
    useState<IncidentsQuery | null>(null);
  const incidentsQueryStateRef = useRef(incidentsQueryState);
  incidentsQueryStateRef.current = incidentsQueryState;

  const isPaused = useMemo(() => {
    if (!query.timeFrame) {
      return false;
    }

    switch (query.timeFrame.type) {
      case "absolute":
        return false;
      case "relative":
        return query.timeFrame.isPaused;
      case "all-time":
        return query.timeFrame.isPaused;
      default:
        return true;
    }
  }, [query]);

  useEffect(() => {
    if (canRevalidate) {
      return;
    }

    const timeout = setTimeout(() => {
      setCanRevalidate(true);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [canRevalidate]);

  const getDateRangeCel = () => {
    if (query.timeFrame === null) {
      return null;
    }

    if (query?.timeFrame.type === "relative") {
      return `creation_time >= '${new Date(
        new Date().getTime() - query.timeFrame.deltaMs
      ).toISOString()}'`;
    } else if (query?.timeFrame.type === "absolute") {
      return [
        `creation_time >= '${query.timeFrame.start.toISOString()}'`,
        `creation_time <= '${query.timeFrame.end.toISOString()}'`,
      ].join(" && ");
    }

    return null;
  };

  function updateIncidentsCelDateRange() {
    const dateRangeCel = getDateRangeCel();
    setDateRangeCel(dateRangeCel);

    if (dateRangeCel) {
      return;
    }

    // if date does not change, just reload the data
    mutateIncidents();
  }

  useEffect(() => updateIncidentsCelDateRange(), [query.timeFrame]);

  const { incidentChangeToken } = usePollIncidents(() => {}, isPaused);

  // Changes whenever the facet counts may have moved: on every server-side
  // incident change, and when a dismissal lapses on the clock.
  const [facetsRevalidationToken, setFacetsRevalidationToken] = useState<
    string | undefined
  >(undefined);
  useEffect(() => {
    if (incidentChangeToken) {
      setFacetsRevalidationToken(incidentChangeToken);
    }
  }, [incidentChangeToken]);

  useEffect(() => {
    // When refresh token comes, this code allows polling for certain time and then stops.
    // Will start polling again when new refresh token comes.
    // Why? Because events are throttled on BE side but we want to refresh the data frequently
    // when keep gets ingested with data, and it requires control when to refresh from the UI side.
    if (incidentChangeToken) {
      setShouldRefreshDate(true);
      const timeout = setTimeout(() => {
        setShouldRefreshDate(false);
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [incidentChangeToken]);

  useEffect(() => {
    if (isPaused) {
      return;
    }
    // so that gap between poll is 2x of query time and minimum 3sec
    const refreshInterval = Math.max((responseTimeMs || 1000) * 2, 6000);
    const interval = setInterval(() => {
      if (!isPaused && shouldRefreshDate) {
        setIsPolling(true);
        updateIncidentsCelDateRange();
      }
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [isPaused, shouldRefreshDate]);
  useEffect(() => {
    setIsPolling(false);
  }, [JSON.stringify(query)]);

  const mainCelQuery = useMemo(() => {
    const filterArray = ["is_candidate == false", dateRangeCel];

    return filterArray.filter(Boolean).join(" && ");
  }, [dateRangeCel]);

  useEffect(() => {
    if (query.filterCel === null) {
      return;
    }

    setIncidentsQueryState({
      candidate: null,
      predicted: null,
      limit: query.limit,
      offset: query.offset,
      sorting: query.sorting,
      cel: [mainCelQuery, query.filterCel].filter(Boolean).join(" && "),
    });
  }, [query.sorting, query.filterCel, query.limit, query.offset, mainCelQuery]);

  const {
    data: paginatedIncidentsFromHook,
    isLoading: incidentsLoading,
    mutate: mutateIncidents,
    error: incidentsError,
    responseTimeMs,
  } = useIncidents(
    incidentsQueryState,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      onSuccess: () => {
        refreshDefaultIncidents();
      },
    },
    true
  );

  const { data: nextDismissalExpiry, mutate: refreshNextDismissalExpiry } =
    useIncidents(NEXT_DISMISSAL_EXPIRY_QUERY, { revalidateOnFocus: false });
  useEffect(() => {
    // A dismissal made elsewhere (another tab, the API) arrives as an SSE
    // incident change; the one made here already refreshes every list query.
    if (incidentChangeToken) {
      refreshNextDismissalExpiry();
    }
  }, [incidentChangeToken, refreshNextDismissalExpiry]);

  // A "dismiss until" lapses on the clock, with no SSE event to announce it.
  const revalidateOnDismissalExpiry = useCallback(() => {
    mutateIncidents();
    refreshNextDismissalExpiry();
    setFacetsRevalidationToken(uuidv4());
  }, [mutateIncidents, refreshNextDismissalExpiry]);
  const incidentsWithDeadlines = useMemo(
    () => [
      ...(paginatedIncidentsFromHook?.items ?? []),
      ...(nextDismissalExpiry?.items ?? []),
    ],
    [paginatedIncidentsFromHook, nextDismissalExpiry]
  );
  useRevalidateOnDismissalExpiry(
    incidentsWithDeadlines,
    revalidateOnDismissalExpiry,
    isPaused
  );

  const { data: defaultIncidents, mutate: refreshDefaultIncidents } =
    useIncidents(
      {
        candidate: null,
        predicted: null,
        limit: 0,
        offset: 0,
        sorting: DEFAULT_INCIDENTS_SORTING,
        cel: DEFAULT_INCIDENTS_CEL,
      },
      {
        revalidateOnFocus: false,
        revalidateOnMount: false,
      }
    );

  const { data: predictedIncidents, isLoading: isPredictedLoading } =
    useIncidents({ candidate: true, predicted: true });

  const [paginatedIncidentsToReturn, setPaginatedIncidentsToReturn] = useState<
    PaginatedIncidentsDto | undefined
  >();
  useEffect(() => {
    if (!paginatedIncidentsFromHook) {
      return;
    }

    if (!isPaused) {
      if (!incidentsLoading) {
        setPaginatedIncidentsToReturn(paginatedIncidentsFromHook);
      }

      return;
    }

    setPaginatedIncidentsToReturn(
      incidentsLoading ? undefined : paginatedIncidentsFromHook
    );
  }, [isPaused, incidentsLoading, paginatedIncidentsFromHook]);

  return {
    incidents: paginatedIncidentsToReturn,
    incidentsLoading:
      (!isPolling && incidentsLoading) || !paginatedIncidentsToReturn,
    isEmptyState: defaultIncidents?.count === 0,
    predictedIncidents,
    isPredictedLoading,
    facetsCel: mainCelQuery,
    incidentChangeToken,
    facetsRevalidationToken,
    incidentsError,
  };
};
