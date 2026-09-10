import {useId, useMemo, useState, type ReactNode} from "react";
import "./analyticsPrimitives.css";
import QuotalisMultiSelect from "./QuotalisMultiSelect";

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
export interface AnalyticsColumn<T> {
  id: string;
  title: string;
  cell: (row: T) => ReactNode;
  /** Raw comparable value only. Display formatting stays in `cell`. */
  sortValue?: (row: T) => string | number | null;
  /** Columns start visible unless the caller deliberately makes them optional. */
  defaultVisible?: boolean;
}
export interface AnalyticsTableCopy {columns: string; previousPage: string; nextPage: string; page: string;}
const DEFAULT_TABLE_COPY: AnalyticsTableCopy = {columns: "Columns", previousPage: "Previous page", nextPage: "Next page", page: "Page"};
function normalizedSortValue(value: string | number | null): string | number | null {
  return typeof value === "number" && !Number.isFinite(value) ? null : value;
}
export function AnalyticsTable<T>({rows, columns, rowKey, caption, emptyLabel, pageSize = 100, copy = DEFAULT_TABLE_COPY}: {
  rows: readonly T[]; columns: readonly AnalyticsColumn<T>[]; rowKey: (row: T) => string; caption: string; emptyLabel: string;
  /** Bounds rendered DOM for long history tables; six-row tables remain unpaginated. */ pageSize?: number; copy?: AnalyticsTableCopy;
}) {
  const [sort, setSort] = useState<{id: string; descending: boolean} | null>(null);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const visibleColumns = columns.filter(column => visibility[column.id] ?? column.defaultVisible !== false);
  const renderColumns = visibleColumns.length ? visibleColumns : columns.slice(0, 1);
  const ordered = useMemo(() => {
    const value = columns.find(column => column.id === sort?.id)?.sortValue;
    if (!value) return rows;
    return rows.map((row, index) => ({row, index})).sort((a, b) => {
      const x = normalizedSortValue(value(a.row)), y = normalizedSortValue(value(b.row));
      // Unknown values are always last. Reversing a sort must not turn an
      // unavailable reading into the apparent best/worst result.
      if (x === null) return y === null ? a.index - b.index : 1;
      if (y === null) return -1;
      const delta = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return (sort?.descending ? -delta : delta) || a.index - b.index;
    }).map(item => item.row);
  }, [rows, columns, sort]);
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(ordered.length / safePageSize));
  const activePage = Math.min(page, pageCount - 1);
  const pagedRows = ordered.slice(activePage * safePageSize, (activePage + 1) * safePageSize);
  const toggleSort = (column: AnalyticsColumn<T>) => {
    setSort(current => ({id: column.id, descending: current?.id === column.id ? !current.descending : false}));
    setPage(0);
  };
  return <div className="analytics-table-shell" role="region" aria-label={caption}>
    <div className="analytics-table__toolbar"><QuotalisMultiSelect label={copy.columns} value={renderColumns.map(c=>c.id)} minSelected={1} options={columns.map(c=>({value:c.id,label:c.title}))} onChange={ids=>{setVisibility(Object.fromEntries(columns.map(c=>[c.id,ids.includes(c.id)])));setPage(0);}}/></div>
    <div className="analytics-table-scroll" tabIndex={0}>
      <table className="analytics-table"><caption>{caption}</caption><thead><tr>{renderColumns.map(column => <th key={column.id} scope="col" aria-sort={!column.sortValue ? undefined : sort?.id !== column.id ? "none" : sort.descending ? "descending" : "ascending"}>
        {column.sortValue ? <button type="button" onClick={() => toggleSort(column)}>{column.title}<span aria-hidden="true">{sort?.id === column.id ? sort.descending ? " ↓" : " ↑" : " ↕"}</span></button> : column.title}
      </th>)}</tr></thead><tbody>{pagedRows.length ? pagedRows.map(row => <tr key={rowKey(row)}>{renderColumns.map(column => <td key={column.id}>{column.cell(row)}</td>)}</tr>) : <tr><td colSpan={renderColumns.length}>{emptyLabel}</td></tr>}</tbody></table>
    </div>
    {ordered.length > safePageSize && <nav className="analytics-table__pagination" aria-label={caption}><button type="button" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={activePage === 0}>{copy.previousPage}</button><span aria-live="polite">{copy.page} {activePage + 1} / {pageCount}</span><button type="button" onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))} disabled={activePage >= pageCount - 1}>{copy.nextPage}</button></nav>}
  </div>;
}
export function CoveragePanel({title, children}: {title: string; children: ReactNode}) {
  return <details className="analytics-coverage"><summary>{title}</summary><div>{children}</div></details>;
}
