import type { WarnId } from "@/lib/types";
import {
  ArrowLeft,
  BedDouble,
  BrickWall,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock,
  Ellipsis,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Hammer,
  House,
  Image,
  KeyRound,
  LayoutGrid,
  Library,
  ListFilter,
  Lock,
  MessageSquareText,
  Mic,
  Package,
  Pause,
  Play,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Ruler,
  ScanText,
  Search,
  SendHorizontal,
  Share,
  Sparkle,
  Star,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  WandSparkles,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type P = { size?: number; className?: string; strokeWidth?: number };

/**
 * Interface icons are Lucide, drawn with one line weight at every size: 1.75px,
 * or 2.25px where a caller asks for a bolder mark (a tick inside a filled dot).
 */
function icon(Glyph: LucideIcon) {
  return function Icon({ size = 22, className, strokeWidth }: P) {
    return <Glyph size={size} className={className} strokeWidth={strokeWidth && strokeWidth > 2.2 ? 2.25 : 1.75} absoluteStrokeWidth aria-hidden="true" />;
  };
}

export const IArrowRight = icon(ArrowRight);
export const IArrowLeft = icon(ArrowLeft);
export const ICheck = icon(Check);
export const IClose = icon(X);
export const ISearch = icon(Search);
export const ICamera = icon(Camera);
export const IMic = icon(Mic);
export const IGrid = icon(LayoutGrid);
export const IHelp = icon(CircleHelp);
export const IReplay = icon(RotateCcw);
export const IPause = icon(Pause);
export const IPlay = icon(Play);
export const IClock = icon(Clock);
export const IPeople = icon(Users);
export const IPerson = icon(User);
export const IRuler = icon(Ruler);
export const IBox = icon(Package);
export const ISparkle = icon(Sparkle);
export const IVolume = icon(Volume2);
export const IRotate = icon(RotateCw);
export const IHome = icon(House);
export const IChevron = icon(ChevronRight);
export const IChevronDown = icon(ChevronDown);
export const IExternal = icon(ExternalLink);
export const ISend = icon(SendHorizontal);
export const IEye = icon(Eye);
export const IWand = icon(WandSparkles);
export const ISun = icon(Sun);
export const IBolt = icon(Zap);
export const IMore = icon(Ellipsis);
export const IUpload = icon(Upload);
export const ITrash = icon(Trash2);
export const IWrench = icon(Wrench);
export const IHammer = icon(Hammer);
export const IFlag = icon(Flag);
export const ISound = icon(Volume1);
export const ISoundOff = icon(VolumeX);
export const ILibrary = icon(Library);
export const IShare = icon(Share);
export const IPrint = icon(Printer);
export const IAlert = icon(CircleAlert);
export const IPlus = icon(Plus);
export const IFilter = icon(ListFilter);
export const IArrowUpRight = icon(ArrowUpRight);
export const IStar = icon(Star);

export const IScan = icon(ScanText);
export const IKey = icon(KeyRound);
export const IImage = icon(Image);
export const IDoc = icon(FileText);
export const ILock = icon(Lock);
export const IBed = icon(BedDouble);
export const IFeedback = icon(MessageSquareText);

/** An outbound arrow that slides out and back in when its link is hovered. */
export function IArrowOut({ size = 14, className }: P) {
  return (
    <span className={"arrow-out " + (className ?? "")} style={{ width: size, height: size }} aria-hidden="true">
      <ArrowUpRight size={size} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
      <ArrowUpRight size={size} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
    </span>
  );
}
export const IWall = icon(BrickWall);

/* Warning pictograms, shown in step cards. Strokes are in screen pixels, like the tool drawings. */
export function WarnIcon({ id, size = 36 }: { id: WarnId; size?: number }) {
  const s = { stroke: "var(--ink)", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  const body: Record<WarnId, React.ReactNode> = {
    two: (
      <g {...s}>
        <rect x="5" y="6" width="30" height="4" rx="1" fill="var(--accent-soft)" />
        <circle cx="12" cy="16" r="3.4" fill="#fff" />
        <path d="M7 31v-6a5 5 0 0 1 10 0v6M9 20l-2-10M15 20l2-10" fill="#fff" />
        <circle cx="28" cy="16" r="3.4" fill="#fff" />
        <path d="M23 31v-6a5 5 0 0 1 10 0v6M25 20l-2-10M31 20l2-10" fill="#fff" />
      </g>
    ),
    loose: (
      <g {...s}>
        <rect x="9" y="22" width="22" height="9" rx="1.5" fill="#f1efe9" />
        <path d="M17 22V10h6v12" fill="#fff" />
        <path d="M14 8h12" />
        <path d="M27.5 13.5a6 6 0 0 0-3-4.6" />
        <path d="M24.5 6.5l0 2.6 2.6.2" />
      </g>
    ),
    hand: (
      <g {...s}>
        <path d="M13 31v-9l-3-3.5a1.8 1.8 0 0 1 2.6-2.4L15 18V8.5a1.8 1.8 0 0 1 3.6 0V15V7a1.8 1.8 0 0 1 3.6 0v8V8.5a1.8 1.8 0 0 1 3.6 0V16v-4.5a1.8 1.8 0 0 1 3.6 0V22c0 5-3 9-8 9z" fill="#fff" />
      </g>
    ),
    wall: (
      <g {...s}>
        <path d="M6 4v32" />
        <path d="M6 8l-3 3M6 15l-3 3M6 22l-3 3M6 29l-3 3" strokeWidth={1.4} />
        <rect x="16" y="10" width="17" height="25" rx="1.5" fill="#fff" />
        <path d="M6 11h7v5" fill="none" />
        <path d="M13 16h3" />
      </g>
    ),
    square: (
      <g {...s}>
        <rect x="6" y="8" width="28" height="24" rx="1.5" fill="#fff" />
        <path d="M9 11l22 18M31 11L9 29" strokeDasharray="3 3" />
        <circle cx="20" cy="20" r="4.5" fill="#fff" />
        <path d="M18 19h4M18 21.2h4" strokeWidth={1.4} />
      </g>
    ),
    floor: (
      <g {...s}>
        <path d="M4 28l10-6h22l-10 6z" fill="var(--accent-soft)" />
        <path d="M10 23V12h14v10" fill="#fff" />
        <path d="M8 34l4-2.5M16 34l4-2.5M24 34l4-2.5" strokeWidth={1.4} />
      </g>
    ),
    face: (
      <g {...s}>
        <rect x="6" y="9" width="28" height="22" rx="1.5" fill="#fff" />
        <circle cx="13" cy="15" r="1.8" />
        <circle cx="13" cy="25" r="1.8" />
        <circle cx="27" cy="15" r="1.8" />
        <circle cx="27" cy="25" r="1.8" />
        <path d="M17 20h6M20.5 17.5L23 20l-2.5 2.5" />
      </g>
    ),
    tip: (
      <g {...s}>
        <path d="M5 35h30" />
        <g transform="rotate(14 24 34)">
          <rect x="15" y="6" width="16" height="28" rx="1.5" fill="#fff" />
          <path d="M15 15h16M15 24h16" />
        </g>
        <path d="M8 10l6 6M14 10l-6 6" strokeWidth={2.4} />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className="line-art" aria-hidden="true">
      {body[id]}
    </svg>
  );
}

export const WARN_TEXT: Record<WarnId, string> = {
  two: "Two people",
  loose: "Don't tighten fully yet",
  hand: "Tighten by hand only",
  wall: "Fix it to the wall",
  square: "Keep it square",
  floor: "Protect the surface",
  face: "Holes face inwards",
  tip: "Tip-over risk",
};

export function IGithub({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.6-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.5 1 2.6 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.2z" />
    </svg>
  );
}
