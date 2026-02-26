import { useRef, useCallback } from "react";

type EditorProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onRun: () => void;
  canRun: boolean;
  loading: boolean;
};

export default function Editor({
  query,
  onQueryChange,
  onRun,
  canRun,
  loading,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lines = query.split("\n");
  const lineCount = lines.length;

  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab key inserts spaces instead of changing focus
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = query.substring(0, start) + "  " + query.substring(end);
      onQueryChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="editorShell">
      <div className="editorTop">
        <div className="editorActions">
          <button
            type="button"
            className="runBtn"
            onClick={onRun}
            disabled={!canRun || loading}
            title="Run (Ctrl+Enter)"
          >
            <span className="runIcon">&#x25b6;</span>
            {loading ? "Running..." : "Run"}
          </button>
        </div>
      </div>
      <div className="editorWithLines">
        <div className="lineNumbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="lineNum">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="sqlArea"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          placeholder="Write SQL..."
          spellCheck={false}
        />
      </div>
    </div>
  );
}
