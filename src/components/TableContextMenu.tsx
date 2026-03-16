import { useEffect, useRef } from "react";

type TableContextMenuProps = {
  x: number;
  y: number;
  tableName: string;
  dbType: string;
  onClose: () => void;
  onRunQuery: (sql: string) => void;
  onSetQuery: (sql: string) => void;
  onCopyName: () => void;
};

export default function TableContextMenu({
  x,
  y,
  tableName,
  dbType,
  onClose,
  onRunQuery,
  onSetQuery,
  onCopyName,
}: TableContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const q = dbType === "postgres" ? `"${tableName}"` : `\`${tableName}\``;

  const actions = [
    {
      label: "SELECT * (100 rows)",
      action: () => onSetQuery(`SELECT * FROM ${q} LIMIT 100;`),
    },
    {
      label: "SELECT COUNT(*)",
      action: () => onRunQuery(`SELECT COUNT(*) AS total FROM ${q};`),
    },
    { label: "Copy Table Name", action: onCopyName },
    { label: "---", action: () => {} },
    {
      label: "TRUNCATE TABLE",
      action: () => onSetQuery(`TRUNCATE TABLE ${q};`),
      danger: true,
    },
    {
      label: "DROP TABLE",
      action: () => onSetQuery(`DROP TABLE ${q};`),
      danger: true,
    },
  ];

  return (
    <div
      ref={ref}
      className="contextMenu"
      style={{ top: y, left: x }}
    >
      {actions.map((a, i) =>
        a.label === "---" ? (
          <div key={i} className="contextMenuSep" />
        ) : (
          <button
            key={a.label}
            type="button"
            className={`contextMenuItem ${a.danger ? "danger" : ""}`}
            onClick={() => {
              a.action();
              onClose();
            }}
          >
            {a.label}
          </button>
        )
      )}
    </div>
  );
}
