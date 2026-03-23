// Shared dashboard state — lifted above EntityTree and ProcessControl
// Holds the loaded FCC data, filters, and entity selections

import { useState, useCallback, useEffect } from "react";

export interface EntityNode {
  entity: string;
  status: string;
  currentOwner: string;
  promotionLevel: number;
  parent?: string;
  children?: EntityNode[];
}

export interface StatusSummary {
  approved: number;
  published: number;
  underReview: number;
  firstPass: number;
  notStarted: number;
  locked: number;
  total: number;
}

export interface DashboardFilters {
  scenario: string;
  year: string;
  period: string;
}

export interface DimensionOptions {
  scenarios: string[];
  years: string[];
  loadingDimensions: boolean;
}

export interface DashboardState {
  filters: DashboardFilters;
  setFilters: (f: DashboardFilters) => void;
  entities: EntityNode[];
  setEntities: (nodes: EntityNode[]) => void;
  flatEntities: EntityNode[];       // flattened list for selections
  selectedEntities: Set<string>;
  toggleEntity: (entity: string) => void;
  selectAllEntities: () => void;
  clearEntitySelection: () => void;
  statusSummary: StatusSummary;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  loadEntityHierarchy: () => Promise<void>;
  dimensionOptions: DimensionOptions;
}

function flattenTree(nodes: EntityNode[]): EntityNode[] {
  const flat: EntityNode[] = [];
  function walk(list: EntityNode[]) {
    for (const n of list) {
      flat.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return flat;
}

function summarize(nodes: EntityNode[]): StatusSummary {
  const s: StatusSummary = { approved: 0, published: 0, underReview: 0, firstPass: 0, notStarted: 0, locked: 0, total: 0 };
  for (const n of nodes) {
    s.total++;
    const lower = n.status.toLowerCase().replace(/\s+/g, "-");
    if (lower === "approved") s.approved++;
    else if (lower === "published") s.published++;
    else if (lower === "under-review") s.underReview++;
    else if (lower === "first-pass") s.firstPass++;
    else if (lower === "locked") s.locked++;
    else s.notStarted++;
  }
  return s;
}

/** Extract member names from an fcc_get_members result.
 *  Skips the first member (the root/aggregate) since it's not a usable selection value.
 */
function extractMemberNames(data: unknown, skipRoot = true): string[] {
  if (!Array.isArray(data)) return [];
  const all = data
    .map((m: Record<string, unknown>) => (m.memberName || m.name || "") as string)
    .filter(Boolean);
  return skipRoot && all.length > 1 ? all.slice(1) : all;
}

export function useDashboard(): DashboardState {
  const [filters, setFilters] = useState<DashboardFilters>({
    scenario: "",
    year: "",
    period: "Jan",
  });
  const [entities, setEntitiesRaw] = useState<EntityNode[]>([]);
  const [flatEntities, setFlatEntities] = useState<EntityNode[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({
    approved: 0, published: 0, underReview: 0, firstPass: 0, notStarted: 0, locked: 0, total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dimension member options for dropdowns
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [loadingDimensions, setLoadingDimensions] = useState(false);

  // Load Scenario and Year dimension members on mount
  useEffect(() => {
    async function loadDimensionMembers() {
      if (!window.fccCommander) return;
      setLoadingDimensions(true);
      try {
        const [scenarioResult, yearResult] = await Promise.all([
          window.fccCommander.executeTool("fcc_get_members", {
            dimension: "Scenario",
            include_descendants: true,
            limit: 50,
          }),
          window.fccCommander.executeTool("fcc_get_members", {
            dimension: "Year",
            include_descendants: true,
            limit: 50,
          }),
        ]);

        console.log("[useDashboard] Scenario result:", JSON.stringify(scenarioResult).substring(0, 500));
        console.log("[useDashboard] Year result:", JSON.stringify(yearResult).substring(0, 500));

        if (scenarioResult.success) {
          const names = extractMemberNames(scenarioResult.data);
          console.log("[useDashboard] Scenario members:", names);
          setScenarios(names);
          if (names.length > 0) {
            setFilters((prev) => ({
              ...prev,
              scenario: prev.scenario || names[0],
            }));
          }
        } else {
          console.warn("[useDashboard] Scenario fetch failed:", scenarioResult.message);
        }

        if (yearResult.success) {
          const names = extractMemberNames(yearResult.data);
          console.log("[useDashboard] Year members:", names);
          setYears(names);
          if (names.length > 0) {
            setFilters((prev) => ({
              ...prev,
              year: prev.year || names[0],
            }));
          }
        } else {
          console.warn("[useDashboard] Year fetch failed:", yearResult.message);
        }
      } catch (err) {
        console.error("[useDashboard] Dimension loading error:", err);
      } finally {
        setLoadingDimensions(false);
      }
    }

    loadDimensionMembers();
  }, []);

  const setEntities = useCallback((nodes: EntityNode[]) => {
    setEntitiesRaw(nodes);
    const flat = flattenTree(nodes);
    setFlatEntities(flat);
    setStatusSummary(summarize(flat));
    setSelectedEntities(new Set()); // Reset selection on new data
  }, []);

  const toggleEntity = useCallback((entity: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      next.has(entity) ? next.delete(entity) : next.add(entity);
      return next;
    });
  }, []);

  const selectAllEntities = useCallback(() => {
    setSelectedEntities(new Set(flatEntities.map((e) => e.entity)));
  }, [flatEntities]);

  const clearEntitySelection = useCallback(() => {
    setSelectedEntities(new Set());
  }, []);

  const loadEntityHierarchy = useCallback(async () => {
    if (!window.fccCommander) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.fccCommander.executeTool("fcc_get_entity_hierarchy", {
        depth: 0, // all descendants
      });
      if (!result.success) {
        const msg = result.message || "Failed to load entity hierarchy";
        const warnings = (result as { warnings?: string[] }).warnings || [];
        const errorParts = [msg];
        if (warnings.length) {
          errorParts.push("__HINTS__" + JSON.stringify(warnings));
        }
        setError(errorParts.join(""));
        return;
      }
      const members = (result.data as Array<Record<string, unknown>>) || [];
      const nodes: EntityNode[] = members.map((m) => ({
        entity: (m.memberName || m.name || String(m)) as string,
        status: "Not Started",
        currentOwner: "",
        promotionLevel: 0,
      }));
      setEntities(nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [setEntities]);

  return {
    filters,
    setFilters,
    entities,
    setEntities,
    flatEntities,
    selectedEntities,
    toggleEntity,
    selectAllEntities,
    clearEntitySelection,
    statusSummary,
    loading,
    setLoading,
    error,
    setError,
    loadEntityHierarchy,
    dimensionOptions: { scenarios, years, loadingDimensions },
  };
}
