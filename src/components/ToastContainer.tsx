import type { ToastMessage } from "../types";

type ToastContainerProps = {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
};

export default function ToastContainer({
  toasts,
  onRemove,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toastContainer">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          onClick={() => onRemove(t.id)}
        >
          <span className="toastIcon">
            {t.type === "success"
              ? "\u2713"
              : t.type === "error"
                ? "\u2717"
                : "\u2139"}
          </span>
          <span className="toastMessage">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
