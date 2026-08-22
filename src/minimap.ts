import type { Enemy, PlayerState, TeamId } from "./types";
import { requiredElement } from "./dom";

interface MinimapMarkerDebug {
  team: TeamId;
  x: number;
  y: number;
  clamped: boolean;
}

export interface MinimapDebugState {
  centerX: number;
  centerY: number;
  range: number;
  markers: MinimapMarkerDebug[];
}

const canvas = requiredElement<HTMLCanvasElement>("#minimap");
const context = canvas.getContext("2d");
const radarRange = 65;
let debugState: MinimapDebugState = { centerX: 0, centerY: 0, range: radarRange, markers: [] };

function drawPlayer(ctx: CanvasRenderingContext2D, center: number): void {
  ctx.beginPath();
  ctx.moveTo(center, center - 8);
  ctx.lineTo(center - 6, center + 6);
  ctx.lineTo(center, center + 3);
  ctx.lineTo(center + 6, center + 6);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#44eaff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  team: TeamId,
  x: number,
  y: number,
  clamped: boolean
): void {
  const size = clamped ? 3.5 : 5;
  ctx.globalAlpha = clamped ? 0.65 : 1;
  ctx.fillStyle = team === "blue" ? "#35eaff" : "#ff4938";
  ctx.strokeStyle = team === "blue" ? "#d7fbff" : "#ffd1ca";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (team === "blue") {
    ctx.arc(x, y, size, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x, y - size - 1);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size + 1);
    ctx.lineTo(x - size, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function updateMinimap(player: PlayerState, bots: readonly Enemy[]): void {
  if (!context) return;
  const cssSize = Math.max(1, Math.round(canvas.clientWidth));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderSize = Math.round(cssSize * pixelRatio);
  if (canvas.width !== renderSize || canvas.height !== renderSize) {
    canvas.width = renderSize;
    canvas.height = renderSize;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssSize, cssSize);

  const center = cssSize / 2;
  const radius = cssSize * 0.43;
  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "rgba(4, 13, 20, 0.86)";
  context.fillRect(0, 0, cssSize, cssSize);

  context.strokeStyle = "rgba(116, 215, 235, 0.2)";
  context.lineWidth = 1;
  for (const scale of [0.33, 0.66, 1]) {
    context.beginPath();
    context.arc(center, center, radius * scale, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(center, center - radius);
  context.lineTo(center, center + radius);
  context.moveTo(center - radius, center);
  context.lineTo(center + radius, center);
  context.stroke();

  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const markers: MinimapMarkerDebug[] = [];
  for (const bot of bots) {
    if (!bot.alive) continue;
    const dx = bot.pos.x - player.pos.x;
    const dz = bot.pos.z - player.pos.z;
    const relativeRight = dx * rightX + dz * rightZ;
    const relativeForward = dx * forwardX + dz * forwardZ;
    const distance = Math.hypot(relativeRight, relativeForward);
    const clamped = distance > radarRange;
    const scale = clamped ? radarRange / Math.max(distance, 0.001) : 1;
    const x = center + (relativeRight * scale * radius) / radarRange;
    const y = center - (relativeForward * scale * radius) / radarRange;
    drawMarker(context, bot.team, x, y, clamped);
    markers.push({ team: bot.team, x, y, clamped });
  }
  drawPlayer(context, center);
  context.restore();

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.strokeStyle = "rgba(125, 229, 247, 0.72)";
  context.lineWidth = 2;
  context.stroke();
  debugState = { centerX: center, centerY: center, range: radarRange, markers };
}

export function debugMinimapState(): MinimapDebugState {
  return {
    ...debugState,
    markers: debugState.markers.map((marker) => ({ ...marker })),
  };
}
