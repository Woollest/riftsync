import { Check, Copy, ExternalLink, Link2, MessageSquare } from "lucide-react";
import { FEEDBACK_URL } from "../config/app";

export type CopyState = "idle" | "copied" | "failed";

interface ShareActionsProps {
  copyState: CopyState;
  linkCopyState: CopyState;
  onCopyLink: () => void;
  onCopySummary: () => void;
}

export function ShareActions({ copyState, linkCopyState, onCopyLink, onCopySummary }: ShareActionsProps) {
  return (
    <div className="action-row" aria-label="共有アクション">
      <button
        className={`icon-action ${copyState !== "idle" ? `is-${copyState}` : ""}`}
        onClick={onCopySummary}
        type="button"
      >
        {copyState === "copied" ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
        <span>{copyState === "copied" ? "コピー済み" : copyState === "failed" ? "失敗" : "結果をコピー"}</span>
      </button>
      <button
        className={`icon-action ${linkCopyState !== "idle" ? `is-${linkCopyState}` : ""}`}
        onClick={onCopyLink}
        type="button"
      >
        {linkCopyState === "copied" ? <Check aria-hidden="true" size={16} /> : <Link2 aria-hidden="true" size={16} />}
        <span>
          {linkCopyState === "copied" ? "コピー済み" : linkCopyState === "failed" ? "失敗" : "リンクをコピー"}
        </span>
      </button>
      <a className="icon-action" href={FEEDBACK_URL} rel="noreferrer" target="_blank">
        <MessageSquare aria-hidden="true" size={16} />
        <span>フィードバック</span>
        <ExternalLink aria-hidden="true" size={13} />
      </a>
    </div>
  );
}
