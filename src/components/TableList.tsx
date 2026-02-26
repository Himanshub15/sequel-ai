import { useState } from "react";

type TableListProps = {
  tables: string[];
  activeTable: string;
  onSelectTable: (tableName: string) => void;
};

export default function TableList({
  tables,
  activeTable,
  onSelectTable,
}: TableListProps) {
  const [filter, setFilter] = useState("");

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <aside className="tableListSidebar">
      <div className="tableSearchWrap">
        <input
          className="tableSearch"
          placeholder="Filter tables..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="tableListScroll">
        {filteredTables.map((name) => (
          <button
            type="button"
            key={name}
            className={
              name === activeTable ? "tableItem active" : "tableItem"
            }
            onClick={() => onSelectTable(name)}
          >
            {name}
          </button>
        ))}
        {filteredTables.length === 0 && (
          <div className="tableListEmpty">
            {tables.length === 0 ? "No tables found" : "No tables match filter"}
          </div>
        )}
      </div>
    </aside>
  );
}
