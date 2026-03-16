import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, TableInfo } from "../types";

type TableInfoViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
};

export default function TableInfoView({
  connectionInput,
  activeTable,
}: TableInfoViewProps) {
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeTable) return;
    setLoading(true);
    setError("");
    invoke<TableInfo>("get_table_info", {
      connection: connectionInput,
      table: activeTable,
    })
      .then(setInfo)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [connectionInput, activeTable]);

  if (loading) {
    return (
      <div className="tableInfoView">
        <div className="tableInfoLoading">Loading table info...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tableInfoView">
        <div className="tableInfoError">{error}</div>
      </div>
    );
  }

  if (!info) return null;

  const rows: [string, string][] = [
    ["Table", activeTable],
    ["Engine", info.engine],
    ["Row Count", info.rowCount.toLocaleString()],
    ["Data Size", info.dataSize],
    ["Index Size", info.indexSize],
    ["Auto Increment", info.autoIncrement],
    ["Created", info.createTime],
    ["Updated", info.updateTime],
    ["Collation", info.collation],
    ["Comment", info.comment || "—"],
  ];

  return (
    <div className="tableInfoView">
      <div className="tableInfoHeader">
        <h3 className="tableInfoTitle">Table Information — {activeTable}</h3>
      </div>
      <div className="tableInfoBody">
        <table className="tableInfoTable">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="tableInfoRow">
                <td className="tableInfoLabel">{label}</td>
                <td className="tableInfoValue">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
