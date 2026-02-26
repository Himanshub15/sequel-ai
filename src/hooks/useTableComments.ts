import { useState, useEffect, useCallback } from "react";
import type { TableComments } from "../types";
import { saveAppData, loadAppData } from "./useAppData";

const COMMENTS_KEY = "table_comments";

export function useTableComments() {
  const [comments, setComments] = useState<TableComments>({});

  useEffect(() => {
    loadAppData<TableComments>(COMMENTS_KEY).then((data) => {
      if (data) setComments(data);
    });
  }, []);

  const getComment = useCallback(
    (key: string): string => {
      return comments[key] ?? "";
    },
    [comments]
  );

  const setComment = useCallback(
    async (key: string, text: string) => {
      const updated = { ...comments, [key]: text };
      setComments(updated);
      await saveAppData(COMMENTS_KEY, updated);
    },
    [comments]
  );

  return { getComment, setComment };
}
