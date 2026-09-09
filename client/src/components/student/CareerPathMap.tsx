import { useMemo } from 'react';
import {
  BriefcaseMedical,
  ClipboardList,
  Crown,
  GraduationCap,
  Medal,
  Star,
  Stethoscope,
  User,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CLINICAL_RANKS, rankLabel } from '../../lib/clinicalRanks';
import type { RankSnapshot } from './XpBreakdownSection';

const VIEW_W = 400;
const VIEW_H = 900;

/** Winding S-curve node positions — bottom (student) to top (consultant). */
const NODE_POSITIONS = [
  { x: 200, y: 830 },
  { x: 72, y: 735 },
  { x: 328, y: 640 },
  { x: 72, y: 545 },
  { x: 328, y: 450 },
  { x: 72, y: 355 },
  { x: 328, y: 260 },
  { x: 72, y: 165 },
  { x: 328, y: 70 },
  { x: 200, y: 28 },
] as const;

const RANK_ICONS: Record<string, LucideIcon> = {
  medical_student: GraduationCap,
  clinical_clerk: Stethoscope,
  intern_doctor: BriefcaseMedical,
  junior_resident: UserRound,
  resident: User,
  senior_resident: Star,
  registrar: ClipboardList,
  specialist: BriefcaseMedical,
  senior_specialist: Medal,
  consultant: Crown,
};

function buildWindingPath(points: ReadonlyArray<{ x: number; y: number }>) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

const PATH_D = buildWindingPath(NODE_POSITIONS);

type NodeState = 'completed' | 'current' | 'locked';

function nodeState(rankMinXp: number, currentMin: number, totalXp: number): NodeState {
  if (rankMinXp === currentMin) return 'current';
  if (totalXp >= rankMinXp) return 'completed';
  return 'locked';
}

interface CareerPathMapProps {
  progress: RankSnapshot;
  isAr: boolean;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function CareerPathMap({ progress, isAr, selectedKey, onSelect }: CareerPathMapProps) {
  const { t } = useTranslation();
  const currentMin = progress.currentRank.minXp;

  const nodes = useMemo(
    () =>
      CLINICAL_RANKS.map((rank, index) => ({
        rank,
        pos: NODE_POSITIONS[index],
        state: nodeState(rank.minXp, currentMin, progress.totalXp),
      })),
    [currentMin, progress.totalXp],
  );

  return (
    <div className="relative bg-[#f4f5f7] dark:bg-slate-900/60 min-h-[520px] lg:min-h-[640px]">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-full min-h-[520px] lg:min-h-[640px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('xpCareerPath')}
      >
        <path
          d={PATH_D}
          fill="none"
          stroke="currentColor"
          className="text-slate-950/10 dark:text-white/5"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={PATH_D}
          fill="none"
          stroke="currentColor"
          className="text-slate-800 dark:text-slate-600"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {nodes.map(({ rank, pos, state }) => {
          const Icon = RANK_ICONS[rank.key] ?? User;
          const isCurrent = state === 'current';
          const isCompleted = state === 'completed';
          const isSelected = selectedKey === rank.key;
          const radius = isCurrent ? 34 : 22;
          const labelOnRight = pos.x < VIEW_W / 2;
          const labelX = labelOnRight ? pos.x + radius + 14 : pos.x - radius - 14;
          const labelAnchor = labelOnRight ? 'start' : 'end';

          let fill = '#e2e8f0';
          let stroke = '#cbd5e1';
          let iconColor = '#94a3b8';
          if (isCompleted) {
            fill = '#0f766e';
            stroke = '#0d9488';
            iconColor = '#ffffff';
          } else if (isCurrent) {
            fill = '#1d4ed8';
            stroke = '#2563eb';
            iconColor = '#ffffff';
          }

          return (
            <g key={rank.key}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius + 6}
                className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth={3}
                strokeDasharray="4 3"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
                className="cursor-pointer"
                onClick={() => onSelect(rank.key)}
                role="button"
                tabIndex={0}
                aria-label={rankLabel(rank, isAr)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(rank.key);
                }}
              />
              <foreignObject
                x={pos.x - (isCurrent ? 14 : 10)}
                y={pos.y - (isCurrent ? 14 : 10)}
                width={isCurrent ? 28 : 20}
                height={isCurrent ? 28 : 20}
                className="pointer-events-none"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <Icon size={isCurrent ? 18 : 12} color={iconColor} strokeWidth={2.2} />
                </div>
              </foreignObject>

              <g transform={`translate(${labelX}, ${pos.y})`}>
                <rect
                  x={labelOnRight ? 0 : -148}
                  y={-14}
                  width={148}
                  height={28}
                  rx={8}
                  fill="white"
                  className="drop-shadow-sm dark:fill-slate-800"
                />
                <text
                  x={labelOnRight ? 10 : -10}
                  y={4}
                  textAnchor={labelAnchor}
                  className="fill-slate-800 dark:fill-slate-100 text-[11px] font-semibold"
                  style={{ fontFamily: 'inherit' }}
                >
                  {rankLabel(rank, isAr)}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
