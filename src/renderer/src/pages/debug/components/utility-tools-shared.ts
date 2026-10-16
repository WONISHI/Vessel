import { toast } from "sonner"

/** Copies copy. */
export const copy = (text: string) =>
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success("已复制"))
    .catch((e) => toast.error(String(e)))
