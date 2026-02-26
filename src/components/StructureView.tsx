import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, TableStructure } from "../types";

type StructureViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
  databaseName: string;
  tableComment: string;
  onCommentChange: (comment: string) => void;
};

export default function StructureView({
  connectionInput,
  activeTable,
  databaseName,
  tableComment,
  onCommentChange,
}: StructureViewProps) {
  const [structure, setStructure] = useState<TableStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeTable) {
      setStructure(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    invoke<TableStructure>("get_table_structure", {
      connection: connectionInput,
      table: activeTable,
    })
      .then((data) => {
        if (!cancelled) {
          setStructure(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setStructure(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTable, connectionInput]);

  if (!activeTable) {
    return (
      <div className="structureView">
        <div className="contentEmpty">Select a table to view its structure.</div>
      </div>
    );
  }

  return (
    <div className="structureView">
      <div className="contentHeader">
        <span>{activeTable} — Structure</span>
        {structure && (
          <span className="contentCount">
            {structure.columns.length} column
            {structure.columns.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && <div className="contentLoading">Loading...</div>}
      {error && <div className="errorLine">{error}</div>}

      {structure && structure.columns.length > 0 && (
        <div className="gridWrap">
          <table>
            <thead>
              <tr>
                <th className="rowNumHeader">#</th>
                <th>Column</th>
                <th>Type</th>
                <th>Nullable</th>
                <th>Key</th>
                <th>Default</th>
                <th>Extra</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {structure.columns.map((col, i) => (
                <tr key={col.columnName}>
                  <td className="rowNum">{i + 1}</td>
                  <td>{col.columnName}</td>
                  <td>{col.columnType}</td>
                  <td>{col.isNullable}</td>
                  <td>{col.columnKey || "—"}</td>
                  <td className={col.columnDefault === "NULL" ? "nullVal" : ""}>
                    {col.columnDefault || "—"}
                  </td>
                  <td>{col.extra || "—"}</td>
                  <td>{col.columnComment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="tableCommentSection">
        <label className="tableCommentLabel">Table Comment</label>
        <textarea
          className="tableCommentInput"
          value={tableComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Add a comment about this table..."
          rows={3}
        />
      </div>
    </div>
  );
}
