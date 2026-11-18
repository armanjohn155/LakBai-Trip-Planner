/* eslint-disable react-refresh/only-export-components */

import type { ComponentType } from "react";

import {
  ArrowLeftIcon,
  CalendarIcon,
  CameraIcon,
  CarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CrosshairIcon,
  DownloadIcon,
  ExpandIcon,
  FriendsIcon,
  GridIcon,
  HeartIcon,
  LayersIcon,
  ListIcon,
  MapIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  RouteIcon,
  SearchIcon,
  ShareIcon,
  ShieldIcon,
  SlidersIcon,
  StarIcon,
  TicketIcon,
  UserIcon,
} from "@/components/icons";

type IconComponent = ComponentType<{ className?: string }>;

const ICON_MAP: Record<string, IconComponent> = {
  pin: PinIcon,
  crosshair: CrosshairIcon,
  star: StarIcon,
  heart: HeartIcon,
  grid: GridIcon,
  list: ListIcon,
  sliders: SlidersIcon,
  plus: PlusIcon,
  "arrow-left": ArrowLeftIcon,
  check: CheckIcon,
  calendar: CalendarIcon,
  ticket: TicketIcon,
  clock: ClockIcon,
  share: ShareIcon,
  copy: CopyIcon,
  download: DownloadIcon,
  map: MapIcon,
  expand: ExpandIcon,
  user: UserIcon,
  friends: FriendsIcon,
  shield: ShieldIcon,
  camera: CameraIcon,
  search: SearchIcon,
  layers: LayersIcon,
  route: RouteIcon,
  pencil: PencilIcon,
  car: CarIcon,
  more: MoreIcon,
};

/** Icon keys offered by the manage screen; mirrors the backend allow-list. */
export const CATEGORY_ICON_KEYS = Object.keys(ICON_MAP);

export function OptionIcon({ icon, className }: { icon?: string | null; className?: string }) {
  if (!icon) return null;
  const Component = ICON_MAP[icon];
  return Component ? <Component className={className} /> : null;
}
