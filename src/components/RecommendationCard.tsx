import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import type { Recommendation } from "../types";

interface RecommendationCardProps {
  iconUrl: string;
  index: number;
  recommendation: Recommendation;
}

export function RecommendationCard({ iconUrl, index, recommendation }: RecommendationCardProps) {
  return (
    <article className="recommendation-card">
      <div className="rank-badge">{index}</div>
      <img className="champion-portrait" src={iconUrl} alt="" />
      <div className="card-main">
        <div className="card-heading">
          <div>
            <h2>{recommendation.champion.nameJa}</h2>
            <p>{recommendation.champion.nameEn}</p>
          </div>
          <StarRating score={recommendation.totalScore} />
        </div>
        <p className="reason">{recommendation.reason}</p>
        <div className="metric-grid">
          <Metric label="コンボ相性" value={`${Math.round(recommendation.comboScore)}%`} />
          <Metric label="勝率" value={`${recommendation.displayWinRate.toFixed(1)}%`} />
          <Metric label="メタ" value={<FlameRating count={recommendation.metaFlames} />} />
          <Metric label="難易度" value={recommendation.difficulty} />
          <Metric label="試合数" value={recommendation.sampleSize.toLocaleString("ja-JP")} />
        </div>
        <ScoreBreakdown recommendation={recommendation} />
        <LabelRow recommendation={recommendation} />
      </div>
    </article>
  );
}

interface AvoidCardProps {
  iconUrl: string;
  recommendation: Recommendation;
}

export function AvoidCard({ iconUrl, recommendation }: AvoidCardProps) {
  return (
    <article className="avoid-card">
      <img src={iconUrl} alt="" />
      <div>
        <strong>
          {recommendation.champion.nameJa} / {recommendation.champion.nameEn}
        </strong>
        <p>勝率が低く、味方との構成としてかみ合いにくい</p>
        <span>
          勝率 {recommendation.displayWinRate.toFixed(1)}% ・ コンボ相性 {Math.round(recommendation.comboScore)}%
        </span>
      </div>
    </article>
  );
}

function ScoreBreakdown({ recommendation }: { recommendation: Recommendation }) {
  const rows: Array<{
    label: string;
    max: number;
    tone?: "penalty";
    value: number;
    valuePrefix?: string;
  }> = [
    { label: "相性", max: 85, value: recommendation.scoreBreakdown.combo },
    { label: "勝率", max: 10, value: recommendation.scoreBreakdown.winRate },
    { label: "メタ", max: 5, value: recommendation.scoreBreakdown.meta },
  ];

  if (recommendation.scoreBreakdown.dataPenalty > 0) {
    rows.push({
      label: "データ",
      max: 10,
      value: recommendation.scoreBreakdown.dataPenalty,
      valuePrefix: "-",
      tone: "penalty",
    });
  }

  return (
    <div className="score-breakdown" aria-label="総合スコア内訳">
      <div className="score-breakdown-title">スコア内訳</div>
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, (row.value / row.max) * 100));

        return (
          <div className={`score-bar ${row.tone ? `is-${row.tone}` : ""}`} key={row.label}>
            <div className="score-bar-header">
              <span>{row.label}</span>
              <strong>
                {row.valuePrefix ?? "+"}
                {Math.round(row.value)}
              </strong>
            </div>
            <span className="score-bar-track">
              <span className="score-bar-fill" style={{ width: `${width}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LabelRow({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="label-row">
      {recommendation.isBeginnerFriendly ? <span className="label good">初心者おすすめ</span> : null}
      {recommendation.synergySource === "profile" ? <span className="label info">推定相性</span> : null}
      {recommendation.isOffMeta ? <span className="label warn">オフメタ</span> : null}
      {recommendation.isLowData ? <span className="label caution">データ少</span> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  const rating = Math.max(1, Math.min(5, Math.round((score / 20) * 2) / 2));

  return (
    <div className="star-rating" aria-label={`総合評価 ${rating} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        const className = fill >= 1 ? "full" : fill >= 0.5 ? "half" : "empty";

        return (
          <span className={className} key={index}>
            ★
          </span>
        );
      })}
    </div>
  );
}

function FlameRating({ count }: { count: number }) {
  return (
    <span className="flame-rating" aria-label={`メタ評価 ${count} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Flame className={index < count ? "lit" : ""} fill="currentColor" key={index} size={14} />
      ))}
    </span>
  );
}
