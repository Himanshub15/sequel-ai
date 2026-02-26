import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, TableRelations } from "../types";

type RelationsViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
};

export default function RelationsView({
  connectionInput,
  activeTable,
}: RelationsViewProps) {
  const [relations, setRelations] = useState<TableRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeTable) {
      setRelations(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    invoke<TableRelations>("get_table_relations", {
      connection: connectionInput,
      table: activeTable,
    })
      .then((data) => {
        if (!cancelled) {
          setRelations(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setRelations(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTable, connectionInput]);

  if (!activeTable) {
    return (
      <div className="relationsView">
        <div className="contentEmpty">
          Select a table to view its relationships.
        </div>
      </div>
    );
  }

  return (
    <div className="relationsView">
      <div className="contentHeader">
        <span>{activeTable} — Relations</span>
        {relations && (
          <span className="contentCount">
            {relations.foreignKeys.length} foreign key
            {relations.foreignKeys.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && <div className="contentLoading">Loading...</div>}
      {error && <div className="errorLine">{error}</div>}

      {relations && relations.foreignKeys.length > 0 && (
        <div className="gridWrap">
          <table>
            <thead>
              <tr>
                <th className="rowNumHeader">#</th>
                <th>Constraint</th>
                <th>Column</th>
                <th>Referenced Table</th>
                <th>Referenced Column</th>
              </tr>
            </thead>
            <tbody>
              {relations.foreignKeys.map((fk, i) => (
                <tr key={fk.constraintName + fk.columnName}>
                  <td className="rowNum">{i + 1}</td>
                  <td>{fk.constraintName}</td>
                  <td>{fk.columnName}</td>
                  <td>{fk.referencedTable}</td>
                  <td>{fk.referencedColumn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {relations && relations.foreignKeys.length === 0 && !error && (
        <div className="contentEmpty">
          No foreign key relationships found for this table.
        </div>
      )}
    </div>
  );
}
