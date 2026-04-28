type AdminKpiCardProps = {
  label: string;
  value: number;
  accent?: boolean;
};

export function AdminKpiCard({ label, value, accent = false }: AdminKpiCardProps) {
  return (
    <article className={`panel admin-kpi-card${accent ? " accent" : ""}`}>
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </article>
  );
}

