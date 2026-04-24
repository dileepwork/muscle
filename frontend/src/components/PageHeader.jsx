export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-base font-semibold text-neutral-100">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
