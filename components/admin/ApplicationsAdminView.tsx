"use client";

import { useMemo, useRef, useState } from "react";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { ApplicationsFilters } from "@/components/admin/ApplicationsFilters";
import { PipelineOverview } from "@/components/admin/PipelineOverview";
import { ApplicationsTable } from "@/components/admin/ApplicationsTable";
import { KPI_REGIONS, REVIEW_STAGE_FILTER_TABS } from "@/lib/admin/constants";
import type {
  AffiliateApplication,
  ApplicationStageHistoryEntry,
} from "@/lib/admin/types";

type ApplicationsAdminViewProps = {
  applications: AffiliateApplication[];
  stageHistory: ApplicationStageHistoryEntry[];
};

export function ApplicationsAdminView({
  applications,
  stageHistory,
}: ApplicationsAdminViewProps) {
  const applicationsListRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState({
    region: "",
    country: "",
    reviewStage: "",
    search: "",
  });

  function hasValue(value: string | null): value is string {
    return Boolean(value?.trim());
  }

  const countries = useMemo(
    () =>
      Array.from(new Set(applications.map((application) => application.country).filter(hasValue))).sort(),
    [applications]
  );

  const regions = useMemo(
    () =>
      Array.from(new Set(applications.map((application) => application.region).filter(hasValue))).sort(),
    [applications]
  );

  const filteredApplications = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesRegion = !filters.region || application.region === filters.region;
      const matchesCountry = !filters.country || application.country === filters.country;
      const matchesStage =
        !filters.reviewStage || application.review_stage === filters.reviewStage;
      const matchesSearch =
        !searchTerm ||
        [application.gym_name, application.contact_person, application.email]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);

      return matchesRegion && matchesCountry && matchesStage && matchesSearch;
    });
  }, [applications, filters]);

  const preStageFilteredApplications = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesRegion = !filters.region || application.region === filters.region;
      const matchesCountry = !filters.country || application.country === filters.country;
      const matchesSearch =
        !searchTerm ||
        [application.gym_name, application.contact_person, application.email]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);

      return matchesRegion && matchesCountry && matchesSearch;
    });
  }, [applications, filters.country, filters.region, filters.search]);

  const reviewStageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: preStageFilteredApplications.length,
    };

    for (const tab of REVIEW_STAGE_FILTER_TABS) {
      if (!tab.value) {
        continue;
      }

      counts[tab.value] = preStageFilteredApplications.filter(
        (application) => application.review_stage === tab.value
      ).length;
    }

    return counts;
  }, [preStageFilteredApplications]);

  const conversionRates = useMemo(() => {
    const totalApplications = reviewStageCounts.all;
    const rates: Record<string, number> = {};

    for (const [stage, count] of Object.entries(reviewStageCounts)) {
      if (stage === "all") {
        continue;
      }

      rates[stage] = totalApplications > 0 ? Math.round((count / totalApplications) * 100) : 0;
    }

    return rates;
  }, [reviewStageCounts]);

  const weeklyNewApplications = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    return preStageFilteredApplications.filter((app) => {
      const createdAt = new Date(app.created_at);
      return createdAt >= sevenDaysAgo;
    }).length;
  }, [preStageFilteredApplications]);

  const previousWeekApplications = useMemo(() => {
  const now = new Date();

  const startOfThisWeek = new Date();
  startOfThisWeek.setDate(now.getDate() - 7);

  const startOfLastWeek = new Date();
  startOfLastWeek.setDate(now.getDate() - 14);

    return preStageFilteredApplications.filter((app) =>{
      const createdAt = new Date(app.created_at);
      return createdAt >= startOfLastWeek && createdAt < startOfThisWeek;
    }).length;
  }, [preStageFilteredApplications]);

  const weeklyGrowth = useMemo(() => {
    if (previousWeekApplications === 0) return 0;


    return Math.round(
      ((weeklyNewApplications - previousWeekApplications) / previousWeekApplications) * 100
    );
  }, [weeklyNewApplications, previousWeekApplications]);

 const stageThresholds: Record<string, number> = {
  submitted: 3,
  under_review: 7,
  follow_up_required: 5,
  interview: 7,
  trial_candidate: 14,
  approved: 14,
  activated_affiliate: 30,
  rejected: 30,
};

const stageFriction = useMemo(() => {
  const now = new Date();
  const stageTotals: Record<
    string,
    { totalDays: number; count: number; stuckCount: number }
  > = {};

  for (const application of preStageFilteredApplications) {
    const stage = application.review_stage;

    if (!stage) {
      continue;
    }

    const threshold = stageThresholds[stage] ?? 7;
    const createdAt = new Date(application.created_at);
    const daysInStage = Math.max(
      0,
      Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (!stageTotals[stage]) {
      stageTotals[stage] = {
        totalDays: 0,
        count: 0,
        stuckCount: 0,
      };
    }

    stageTotals[stage].totalDays += daysInStage;
    stageTotals[stage].count += 1;

    if (daysInStage >= threshold) {
      stageTotals[stage].stuckCount += 1;
    }
  }

  return Object.entries(stageTotals).reduce<
    Record<
      string,
      {
        stuckCount: number;
        averageDaysInStage: number;
        frictionLevel: "healthy" | "slowing" | "stuck";
      }
    >
  >((accumulator, [stage, totals]) => {
    const threshold = stageThresholds[stage] ?? 7;
    const averageDaysInStage =
      totals.count > 0 ? Math.round(totals.totalDays / totals.count) : 0;

    accumulator[stage] = {
      stuckCount: totals.stuckCount,
      averageDaysInStage,
      frictionLevel:
        totals.stuckCount > 0
          ? "stuck"
          : averageDaysInStage >= threshold * 0.7
          ? "slowing"
          : "healthy",
    };

    return accumulator;
  }, {});
}, [preStageFilteredApplications]);
  
  const stageHistoryCount = stageHistory.length;
  console.log("Stage history records:", stageHistoryCount);

  const regionCounts = useMemo(() => {
    return KPI_REGIONS.reduce<Record<string, number>>((accumulator, region) => {
      accumulator[region] = filteredApplications.filter(
        (application) => application.region === region
      ).length;
      return accumulator;
    }, {});
  }, [filteredApplications]);

  const regionalFriction = useMemo(() => {
  return KPI_REGIONS.reduce<
    Record<
      string,
      {
        label: string;
        className: string;
      }
    >
  >((accumulator, region) => {
    const regionApplications = filteredApplications.filter(
      (application) => application.region === region
    );

    if (regionApplications.length === 0) {
      accumulator[region] = {
        label: "No signal",
        className: "friction-neutral",
      };

      return accumulator;
    }

    const hasCritical = regionApplications.some((application) => {
      const days = Math.floor(
        (Date.now() - new Date(application.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return days >= 10;
    });

    if (hasCritical) {
      accumulator[region] = {
        label: "Friction",
        className: "friction-stuck",
      };

      return accumulator;
    }

    const hasSlowing = regionApplications.some((application) => {
      const days = Math.floor(
        (Date.now() - new Date(application.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return days >= 5;
    });

    accumulator[region] = hasSlowing
      ? {
          label: "Slowing",
          className: "friction-slowing",
        }
      : {
          label: "Healthy",
          className: "friction-healthy",
        };

    return accumulator;
  }, {});
}, [filteredApplications]);

  const newApplicationsCount = filteredApplications.filter(
    (application) => application.status === "new"
  ).length;

    const handleStageSelect = (reviewStage: string) => {
    setFilters((current) => ({ ...current, reviewStage }));

    setTimeout(() => {
      applicationsListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  return (
    <>
      <section className="panel admin-region-section">
        <div className="section-heading">
          <p className="eyebrow">Regional Distribution</p>
          <h2>Global application signal map</h2>
          <p className="admin-overview-copy">
            Supporting intelligence for where affiliate interest is concentrating.
          </p>
        </div>

        <div className="admin-kpi-grid admin-kpi-grid-secondary">
          <AdminKpiCard label="Total applications" value={filteredApplications.length} accent />
          <AdminKpiCard label="New applications" value={newApplicationsCount} />
          <AdminKpiCard label="Europe applications" value={regionCounts.Europe ?? 0} />
          <AdminKpiCard label="MENA applications" value={regionCounts.MENA ?? 0} />
          <AdminKpiCard label="LATAM applications" value={regionCounts.LATAM ?? 0} />
          <AdminKpiCard label="North America applications" value={regionCounts["North America"] ?? 0 }
          />
        </div>
      </section>

      <PipelineOverview
        counts={reviewStageCounts}
        conversionRates={conversionRates}
        stageFriction={stageFriction}
        weeklyNew={weeklyNewApplications}
        weeklyGrowth={weeklyGrowth}
        activeStage={filters.reviewStage}
        onStageSelect={handleStageSelect}
      />

      <ApplicationsFilters
        filters={filters}
        countries={countries}
        regions={regions}
        reviewStageCounts={reviewStageCounts}
        onChange={setFilters}
      />

            <div ref={applicationsListRef}>
        <ApplicationsTable
          applications={filteredApplications}
          totalApplications={applications.length}
        />
      </div>
    </>
  );
}
