import type { Clip } from "@/components/projects/ClipGrid";

export interface ClipEvaluation {
  clipId: string;
  rating: number; // 1 to 5 stars
  hookScore: number; // 0 to 10
  visualScore: number; // 0 to 10
  pacingScore: number; // 0 to 10
  isWinner?: boolean;
  notes?: string;
}

export interface ComparisonReportData {
  generatedAt: string;
  clipCount: number;
  winnerClipId?: string;
  evaluations: Record<string, ClipEvaluation>;
  clips: Clip[];
}

/**
 * Calculates a unified weighted score out of 100 based on user evaluation inputs
 */
export function calculateWeightedScore(
  baseScore: number,
  evaluation?: ClipEvaluation
): number {
  if (!evaluation) return baseScore;
  // Weighted: 35% hook, 25% visual, 20% pacing, 20% star rating
  const hookContribution = (evaluation.hookScore / 10) * 35;
  const visualContribution = (evaluation.visualScore / 10) * 25;
  const pacingContribution = (evaluation.pacingScore / 10) * 20;
  const starContribution = (evaluation.rating / 5) * 20;

  return Math.round(hookContribution + visualContribution + pacingContribution + starContribution);
}

/**
 * Generates a formatted CSV string for downloading clip comparison results
 */
export function generateComparisonCSV(
  clips: Clip[],
  evaluations: Record<string, ClipEvaluation>
): string {
  const headers = [
    "Clip ID",
    "Title",
    "Duration",
    "Resolution",
    "Style",
    "Base Score",
    "Star Rating (1-5)",
    "Hook Score (0-10)",
    "Visual Score (0-10)",
    "Pacing Score (0-10)",
    "Weighted Score",
    "Is Winner",
    "Notes",
  ];

  const rows = clips.map((clip) => {
    const evalData = evaluations[clip.id] || {
      rating: 0,
      hookScore: 0,
      visualScore: 0,
      pacingScore: 0,
      isWinner: false,
      notes: "",
    };
    const weighted = calculateWeightedScore(clip.score, evalData);
    const sanitizedTitle = `"${clip.title.replace(/"/g, '""')}"`;
    const sanitizedNotes = `"${(evalData.notes || "").replace(/"/g, '""')}"`;

    return [
      clip.id,
      sanitizedTitle,
      clip.duration,
      clip.resolution,
      clip.style,
      clip.score,
      evalData.rating,
      evalData.hookScore,
      evalData.visualScore,
      evalData.pacingScore,
      weighted,
      evalData.isWinner ? "YES" : "NO",
      sanitizedNotes,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Generates a clean Markdown report with side-by-side comparison tables
 */
export function generateComparisonMarkdown(
  clips: Clip[],
  evaluations: Record<string, ClipEvaluation>
): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const winner = clips.find((c) => evaluations[c.id]?.isWinner);

  let md = `# Clip Comparison Report (${dateStr})\n\n`;
  md += `**Total Clips Compared:** ${clips.length}\n`;
  if (winner) {
    const winnerEval = evaluations[winner.id];
    const winnerWeighted = calculateWeightedScore(winner.score, winnerEval);
    md += `**Top Pick / Winner:** ${winner.title} (Weighted Score: ${winnerWeighted}/100)\n\n`;
  } else {
    md += `**Top Pick / Winner:** Not designated\n\n`;
  }

  md += `## Side-by-Side Scoring Breakdown\n\n`;
  md += `| Clip Title | Style | Duration | Hook | Visual | Pacing | Overall Rating | Weighted Score | Winner |\n`;
  md += `| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const clip of clips) {
    const ev = evaluations[clip.id] || {
      rating: 0,
      hookScore: 0,
      visualScore: 0,
      pacingScore: 0,
      isWinner: false,
    };
    const weighted = calculateWeightedScore(clip.score, ev);
    const winnerBadge = ev.isWinner ? "⭐ YES" : "No";
    md += `| ${clip.title} | ${clip.style} | ${clip.duration} | ${ev.hookScore}/10 | ${ev.visualScore}/10 | ${ev.pacingScore}/10 | ${ev.rating}★ | **${weighted}** | ${winnerBadge} |\n`;
  }

  md += `\n## Detailed Notes & Observations\n\n`;
  for (const clip of clips) {
    const ev = evaluations[clip.id];
    const notes = ev?.notes?.trim() || "No additional notes provided.";
    md += `### ${clip.title} (${clip.resolution}, ${clip.style})\n`;
    md += `- **Evaluation Notes:** ${notes}\n\n`;
  }

  return md;
}

/**
 * Generates JSON payload for export
 */
export function generateComparisonJSON(
  clips: Clip[],
  evaluations: Record<string, ClipEvaluation>
): string {
  const winner = clips.find((c) => evaluations[c.id]?.isWinner);
  const data: ComparisonReportData = {
    generatedAt: new Date().toISOString(),
    clipCount: clips.length,
    winnerClipId: winner?.id,
    evaluations,
    clips,
  };
  return JSON.stringify(data, null, 2);
}
