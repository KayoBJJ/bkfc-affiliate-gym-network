"use client";

type ApplicationsFiltersProps = {
  filters: {
    region: string;
    country: string;
    reviewStage: string;
    search: string;
  };
  countries: string[];
  regions: string[];
  reviewStages: string[];
  onChange: (next: {
    region: string;
    country: string;
    reviewStage: string;
    search: string;
  }) => void;
};

export function ApplicationsFilters({
  filters,
  countries,
  regions,
  reviewStages,
  onChange,
}: ApplicationsFiltersProps) {
  return (
    <section className="panel admin-filter-panel">
      <div className="section-heading">
        <p className="eyebrow">Filters</p>
        <h2>Review pipeline controls</h2>
      </div>

      <div className="admin-filters-grid">
        <label className="admin-field">
          <span>Region</span>
          <select
            value={filters.region}
            onChange={(event) => onChange({ ...filters, region: event.target.value })}
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Country</span>
          <select
            value={filters.country}
            onChange={(event) => onChange({ ...filters, country: event.target.value })}
          >
            <option value="">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Review stage</span>
          <select
            value={filters.reviewStage}
            onChange={(event) => onChange({ ...filters, reviewStage: event.target.value })}
          >
            <option value="">All stages</option>
            {reviewStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field admin-field-search">
          <span>Search</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Gym, contact, or email"
          />
        </label>
      </div>
    </section>
  );
}

