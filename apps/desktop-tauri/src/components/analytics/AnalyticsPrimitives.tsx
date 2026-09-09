import {useId, useMemo, useState, type ReactNode} from "react";
import "./analyticsPrimitives.css";

export function AnalyticsSection({title, description, action, children, className = ""}: {title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string}) {
  const id = useId();
  return <section className={`analytics-section ${className}`} aria-labelledby={id}>
    <header className="analytics-section__header"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}
  </section>;
}
export function MetricRibbon({children}: {children: ReactNode}) {return <dl className="analytics-metric-ribbon">{children}</dl>;}
export function ComparisonStat({label, value, detail, state}: {label: string; value: ReactNode; detail: ReactNode; state: string}) {
  return <div className="analytics-comparison-stat" data-state={state}><dt>{label}</dt><dd>{value}</dd><small>{detail}</small></div>;
}
export function StatusRail({children}: {children: ReactNode}) {return <ul className="analytics-status-rail">{children}</ul>;}
export interface AnalyticsColumn<T> {id: string; title: string; cell: (row: T) => ReactNode; sortValue?: (row: T) => string | number | null;}
export function AnalyticsTable<T>({rows, columns, rowKey, caption, emptyLabel}: {rows: readonly T[]; columns: readonly AnalyticsColumn<T>[]; rowKey: (row: T) => string; caption: string; emptyLabel: string}) {
  const [sort, setSort] = useState<{id: string; descending: boolean} | null>(null);
  const ordered = useMemo(() => {
    const value = columns.find(column => column.id === sort?.id)?.sortValue;
    if (!value) return rows;
    return [...rows].sort((a, b) => {
      const x = value(a), y = value(b);
      if (x === null) return y === null ? 0 : 1;
      if (y === null) return -1;
      const delta = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort?.descending ? -delta : delta;
    });
  }, [rows, columns, sort]);
  return <div className="analytics-table-scroll" tabIndex={0} role="region" aria-label={caption}>
    <table className="analytics-table"><caption>{caption}</caption><thead><tr>{columns.map(column => <th key={column.id} scope="col" aria-sort={!column.sortValue ? undefined : sort?.id !== column.id ? "none" : sort.descending ? "descending" : "ascending"}>
      {column.sortValue ? <button type="button" onClick={() => setSort({id: column.id, descending: sort?.id === column.id ? !sort.descending : false})}>{column.title}<span aria-hidden="true">{sort?.id === column.id ? sort.descending ? " ↓" : " ↑" : " ↕"}</span></button> : column.title}
    </th>)}</tr></thead><tbody>{ordered.length ? ordered.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.id}>{column.cell(row)}</td>)}</tr>) : <tr><td colSpan={columns.length}>{emptyLabel}</td></tr>}</tbody></table>
  </div>;
}
export function CoveragePanel({title, children}: {title: string; children: ReactNode}) {
  return <details className="analytics-coverage"><summary>{title}</summary><div>{children}</div></details>;
}
