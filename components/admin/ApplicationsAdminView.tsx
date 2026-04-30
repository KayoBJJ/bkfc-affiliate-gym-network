"use client";

import { useMemo, useState } from "react";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { ApplicationsFilters } from "@/components/admin/ApplicationsFilters";
import { PipelineOverview } from "@/components/admin/PipelineOverview";
import { ApplicationsTable } from "@/components/admin/ApplicationsTable";
import { KPI_REGIONS, REVIEW_STAGE_FILTER_TABS } from "@/lib/admin/constants";
import type { AffiliateApplication } from "@/lib/admin/types";

type ApplicationsAdminViewProps = {
  applications: AffiliateApplication[];
};

export function ApplicationsAdminView({ applications }: ApplicationsAdminViewProps) {
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

  const regionCounts = useMemo(() => {
    return KPI_REGIONS.reduce<Record<string, number>>((accumulator, region) => {
      accumulator[region] = filteredApplications.filter(
        (application) => application.region === region
      ).length;
      return accumulator;
    }, {});
  }, [filteredApplications]);

  const newApplicationsCount = filteredApplications.filter(
    (application) => application.status === "new"
  ).length;

  return (
    <>
      <PipelineOverview
        counts={reviewStageCounts}
        activeStage={filters.reviewStage}
        onStageSelect={(reviewStage) => setFilters((current) => ({ ...current, reviewStage }))}
      />

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
          <AdminKpiCard
            label="North America applications"
            value={regionCounts["North America"] ?? 0}
          />
        </div>
      </section>

      <ApplicationsFilters
        filters={filters}
        countries={countries}
        regions={regions}
        reviewStageCounts={reviewStageCounts}
        onChange={setFilters}
      />

      <ApplicationsTable
        applications={filteredApplications}
        totalApplications={applications.length}
      />
    </>
  );
}
