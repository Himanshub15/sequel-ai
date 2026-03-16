type ShortcutsModalProps = {
  onClose: () => void;
};

const SHORTCUTS = [
  { keys: "\u2318 + Enter", action: "Run query" },
  { keys: "\u2318 + T", action: "New tab" },
  { keys: "\u2318 + W", action: "Close tab" },
  { keys: "\u2318 + I", action: "Toggle AI panel" },
  { keys: "\u2318 + ?", action: "Show keyboard shortcuts" },
  { keys: "Tab", action: "Insert 2 spaces (in editor)" },
  { keys: "Enter", action: "Send AI message" },
  { keys: "Shift + Enter", action: "New line in AI chat" },
];

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <span className="modalTitle">Keyboard Shortcuts</span>
          <button type="button" className="modalClose" onClick={onClose}>
            &#x2715;
          </button>
        </div>
        <div className="modalBody">
          <table className="shortcutsTable">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td>
                    <kbd className="shortcutKey">{s.keys}</kbd>
                  </td>
                  <td className="shortcutAction">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
