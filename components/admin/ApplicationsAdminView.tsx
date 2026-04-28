"use client";

import { useMemo, useState } from "react";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { ApplicationsFilters } from "@/components/admin/ApplicationsFilters";
import { ApplicationsTable } from "@/components/admin/ApplicationsTable";
import { KPI_REGIONS } from "@/lib/admin/constants";
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

  const countries = useMemo(
    () =>
      Array.from(new Set(applications.map((application) => application.country).filter(Boolean))).sort(),
    [applications]
  );

  const regions = useMemo(
    () =>
      Array.from(new Set(applications.map((application) => application.region).filter(Boolean))).sort(),
    [applications]
  );

  const reviewStages = useMemo(
    () =>
      Array.from(
        new Set(applications.map((application) => application.review_stage).filter(Boolean))
      ).sort(),
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
      <section className="admin-kpi-grid">
        <AdminKpiCard label="Total applications" value={filteredApplications.length} accent />
        <AdminKpiCard label="New applications" value={newApplicationsCount} />
        <AdminKpiCard label="Europe applications" value={regionCounts.Europe ?? 0} />
        <AdminKpiCard label="MENA applications" value={regionCounts.MENA ?? 0} />
        <AdminKpiCard label="LATAM applications" value={regionCounts.LATAM ?? 0} />
        <AdminKpiCard
          label="North America applications"
          value={regionCounts["North America"] ?? 0}
        />
      </section>

      <ApplicationsFilters
        filters={filters}
        countries={countries}
        regions={regions}
        reviewStages={reviewStages}
        onChange={setFilters}
      />

      <ApplicationsTable applications={filteredApplications} />
    </>
  );
}

