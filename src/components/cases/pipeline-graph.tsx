import { cn } from "@/lib/utils";

const NODES = [
  { key: "signal", label: "SIGNAL" },
  { key: "qualify", label: "QUALIFY" },
  { key: "analyst", label: "ANALYST" },
  { key: "gonogo", label: "GO/NO-GO" },
  { key: "researcher", label: "RESEARCH" },
  { key: "strategist", label: "STRATEGY" },
  { key: "review", label: "REVIEW" },
] as const;

const SPACING = 82;
const FIRST_X = 34;
const MAIN_Y = 42;
const BRANCH_Y = 96;
const RADIUS = 9;

function nodeX(index: number): number {
  return FIRST_X + index * SPACING;
}

type NodeState = "pending" | "running" | "done";

function stateOf(index: number, currentStep: number): NodeState {
  if (index < currentStep) return "done";
  if (index === currentStep) return "running";
  return "pending";
}

function BranchEnd({ fromIndex, label }: { fromIndex: number; label: string }) {
  const x = nodeX(fromIndex);
  return (
    <g className="opacity-70">
      <line
        x1={x}
        y1={MAIN_Y + RADIUS}
        x2={x}
        y2={BRANCH_Y - 5}
        strokeDasharray="2.5 3.5"
        strokeLinecap="round"
        className="stroke-border"
      />
      <circle cx={x} cy={BRANCH_Y} r={4} className="fill-muted stroke-border" />
      <text
        x={x + 9}
        y={BRANCH_Y + 2.5}
        className="fill-muted-foreground/80 font-mono text-[6.5px]"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * The LangGraph pipeline as a live map: nodes light up as the agent executes,
 * the edge feeding the running node flows, branch exits stay muted.
 * `currentStep` is the index of the running node (0–6); anything above 6 marks
 * the whole run as done.
 */
export function PipelineGraph({ currentStep }: { currentStep: number }) {
  return (
    <svg
      viewBox="0 0 560 116"
      role="img"
      aria-label={`Agent pipeline progress: step ${Math.min(currentStep + 1, NODES.length)} of ${NODES.length}`}
      className="w-full"
    >
      {/* Edges first so nodes sit on top. */}
      {NODES.slice(0, -1).map((node, index) => {
        const targetState = stateOf(index + 1, currentStep);
        return (
          <line
            key={`edge-${node.key}`}
            x1={nodeX(index) + RADIUS}
            y1={MAIN_Y}
            x2={nodeX(index + 1) - RADIUS}
            y2={MAIN_Y}
            strokeWidth={1.5}
            strokeLinecap="round"
            className={cn(
              "transition-[stroke] duration-500",
              targetState === "done" && "stroke-primary",
              targetState === "running" && "stroke-primary animate-edge-flow",
              targetState === "pending" && "stroke-border",
            )}
          />
        );
      })}

      <BranchEnd fromIndex={1} label="other status" />
      <BranchEnd fromIndex={3} label="no-go" />

      {NODES.map((node, index) => {
        const state = stateOf(index, currentStep);
        return (
          <g key={node.key}>
            <circle
              cx={nodeX(index)}
              cy={MAIN_Y}
              r={RADIUS + 4}
              className={cn(
                "fill-primary/20 transition-opacity duration-500",
                state === "running" ? "animate-pulse opacity-100" : "opacity-0",
              )}
            />
            <circle
              cx={nodeX(index)}
              cy={MAIN_Y}
              r={RADIUS}
              strokeWidth={1.5}
              className={cn(
                "transition-[fill,stroke] duration-500",
                state === "done" && "fill-primary stroke-primary",
                state === "running" && "fill-background stroke-primary",
                state === "pending" && "fill-background stroke-border",
              )}
            />
            {state === "done" && (
              <path
                d={`M${nodeX(index) - 3.5} ${MAIN_Y} l2.5 2.5 l4.5 -5`}
                fill="none"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="stroke-primary-foreground animate-draw-check"
              />
            )}
            <text
              x={nodeX(index)}
              y={MAIN_Y + 24}
              textAnchor="middle"
              className={cn(
                "font-mono text-[7.5px] tracking-wide transition-[fill] duration-500",
                state === "pending" && "fill-muted-foreground/60",
                state === "running" && "fill-primary font-semibold",
                state === "done" && "fill-foreground",
              )}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
