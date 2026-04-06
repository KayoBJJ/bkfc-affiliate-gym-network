type LogoPlaceholderProps = {
  label: string;
  compact?: boolean;
};

export function LogoPlaceholder({
  label,
  compact = false
}: LogoPlaceholderProps) {
  return (
    <div className={`logo-placeholder${compact ? " compact" : ""}`}>
      <span>{label}</span>
      <small>Replace with BKFC brand asset</small>
    </div>
  );
}
