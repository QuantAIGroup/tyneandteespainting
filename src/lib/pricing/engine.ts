/**
 * THE PRICING ENGINE
 *
 * Plain functions with no website code in them, so the same maths runs in the
 * browser (instant estimate) and on the server (the price that gets saved).
 * The server always recalculates – it never trusts a price sent by a browser.
 *
 * Steps (matching the business rules):
 *  1. Work out the wall area: 2 × (length + width) × height, or the sum of each wall.
 *  2. Multiply by the labour rate for that room type.
 *  3. Apply the minimum charge for that room.
 *  4. Price ceilings and skirting boards as separate lines with their own minimums.
 *  5. Add everything together.
 *  6. Round the final total to the nearest £5 (configurable).
 *  7. Return a clear line-by-line breakdown.
 *
 * Labour only – materials are never included. There are no hourly rates.
 */
import type {
  CeilingItem,
  PaintedRoomItem,
  PricingSettings,
  QuoteFlag,
  QuoteItem,
  QuoteLine,
  QuoteResult,
  SkirtingItem,
} from "./types";

/** Round to 2 decimal places (used for areas and lengths). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

/** Wall area for a regular room: 2 × (length + width) × height. */
export function simpleWallArea(length: number, width: number, height: number): number {
  return round2(2 * (length + width) * height);
}

/** Wall area for an irregular room: the sum of width × height for every wall. */
export function wallsArea(walls: { width: number; height: number }[]): number {
  return round2(walls.reduce((sum, wall) => sum + wall.width * wall.height, 0));
}

/** Ceiling area: length × width. */
export function ceilingArea(length: number, width: number): number {
  return round2(length * width);
}

export function roomWallArea(item: PaintedRoomItem): number {
  return item.measurementMode === "walls"
    ? wallsArea(item.walls)
    : simpleWallArea(item.length, item.width, item.height);
}

/** Round a pence amount to the nearest `nearestPounds` pounds (half rounds up). */
export function roundToNearestPounds(pence: number, nearestPounds: number): number {
  if (!nearestPounds || nearestPounds <= 0) return pence;
  const step = poundsToPence(nearestPounds);
  return Math.round(pence / step) * step;
}

/** Price one line: quantity × rate, then apply the minimum charge. */
export function priceLine(
  quantity: number,
  ratePounds: number,
  minimumPounds: number,
): { calculatedPence: number; minimumPence: number; amountPence: number; minimumApplied: boolean } {
  const calculatedPence = Math.round(quantity * poundsToPence(ratePounds));
  const minimumPence = poundsToPence(minimumPounds);
  const minimumApplied = calculatedPence < minimumPence;
  return {
    calculatedPence,
    minimumPence,
    amountPence: minimumApplied ? minimumPence : calculatedPence,
    minimumApplied,
  };
}

function makeLine(
  item: QuoteItem,
  kind: QuoteLine["kind"],
  label: string,
  quantity: number,
  unit: QuoteLine["unit"],
  ratePounds: number,
  minimumPounds: number,
  manual: boolean,
): QuoteLine {
  const priced = priceLine(quantity, ratePounds, minimumPounds);
  return {
    itemId: item.id,
    label,
    kind,
    quantity,
    unit,
    ratePence: poundsToPence(ratePounds),
    calculatedPence: priced.calculatedPence,
    minimumPence: priced.minimumPence,
    minimumApplied: priced.minimumApplied,
    amountPence: manual ? null : priced.amountPence,
    status: manual ? "manual" : "priced",
  };
}

function coatsFlag(item: QuoteItem, settings: PricingSettings): QuoteFlag | null {
  if (item.coats > settings.standardCoats) {
    return {
      itemId: item.id,
      itemLabel: item.label,
      severity: "review",
      message: `${item.coats} coats requested. The standard price includes ${settings.standardCoats} coats, so the extra coats will be reviewed and confirmed with you before any work starts.`,
    };
  }
  return null;
}

/** Flags for a bedroom or living room. Anything "manual" stops the automatic price for that room. */
export function roomFlags(item: PaintedRoomItem, settings: PricingSettings): QuoteFlag[] {
  const flags: QuoteFlag[] = [];
  const base = { itemId: item.id, itemLabel: item.label };
  const c = item.condition;

  if (c.surface === "major_damage") {
    flags.push({ ...base, severity: "manual", message: "Larger cracks or damaged plaster need to be seen before we can price the repairs accurately." });
  }
  if (c.wallpaperToRemove) {
    flags.push({ ...base, severity: "manual", message: "Wallpaper removal isn't part of the standard painting price, so this room needs a manual quotation." });
  }
  if (c.dampOrStains) {
    flags.push({ ...base, severity: "manual", message: "Damp, mould or staining needs specialist treatment, so this room needs a manual quotation." });
  }
  if (c.newlySkimmed) {
    flags.push({ ...base, severity: "review", message: "New plaster needs a diluted 'mist coat' first. We'll check your photographs and confirm whether this changes the price." });
  }
  if (c.colourChange === "significant") {
    flags.push({ ...base, severity: "review", message: "A big colour change can need an extra coat. We'll confirm this with you before any work starts." });
  }
  const coats = coatsFlag(item, settings);
  if (coats) flags.push(coats);
  return flags;
}

export function skirtingFlags(item: SkirtingItem, settings: PricingSettings): QuoteFlag[] {
  const flags: QuoteFlag[] = [];
  const base = { itemId: item.id, itemLabel: item.label };
  if (item.condition === "major_damage") {
    flags.push({ ...base, severity: "manual", message: "Badly damaged skirting boards need to be seen before we can give a price." });
  }
  if (item.condition === "bare_wood") {
    flags.push({ ...base, severity: "review", message: "Bare wood needs priming and undercoat first. We'll confirm whether this changes the price." });
  }
  const coats = coatsFlag(item, settings);
  if (coats) flags.push(coats);
  return flags;
}

export function ceilingFlags(item: CeilingItem, settings: PricingSettings): QuoteFlag[] {
  const flags: QuoteFlag[] = [];
  const base = { itemId: item.id, itemLabel: item.label };
  if (item.condition.surface === "major_damage") {
    flags.push({ ...base, severity: "manual", message: "Larger ceiling cracks or damage need to be seen before we can price the repairs." });
  }
  if (item.condition.dampOrStains) {
    flags.push({ ...base, severity: "manual", message: "Water stains or damp on a ceiling need specialist treatment, so this ceiling needs a manual quotation." });
  }
  if (item.condition.newlySkimmed) {
    flags.push({ ...base, severity: "review", message: "A newly plastered ceiling needs a mist coat first. We'll confirm whether this changes the price." });
  }
  const coats = coatsFlag(item, settings);
  if (coats) flags.push(coats);
  return flags;
}

/** Calculate a full quotation from a list of rooms/services. */
export function calculateQuote(items: QuoteItem[], settings: PricingSettings): QuoteResult {
  const lines: QuoteLine[] = [];
  const flags: QuoteFlag[] = [];

  for (const item of items) {
    if (item.type === "bedroom" || item.type === "living_room") {
      const itemFlags = roomFlags(item, settings);
      const manual = itemFlags.some((f) => f.severity === "manual");
      const rates = item.type === "bedroom" ? settings.bedroom : settings.livingRoom;
      lines.push(makeLine(item, "walls", `${item.label} – walls`, roomWallArea(item), "m²", rates.ratePerSqm, rates.minimumCharge, manual));
      if (item.includeCeiling) {
        lines.push(
          makeLine(item, "ceiling", `${item.label} – ceiling`, ceilingArea(item.length, item.width), "m²", settings.ceiling.ratePerSqm, settings.ceiling.minimumCharge, manual),
        );
      }
      flags.push(...itemFlags);
    } else if (item.type === "skirting") {
      const itemFlags = skirtingFlags(item, settings);
      const manual = itemFlags.some((f) => f.severity === "manual");
      lines.push(makeLine(item, "skirting", item.label, round2(item.linearMetres), "m", settings.skirting.ratePerMetre, settings.skirting.minimumCharge, manual));
      flags.push(...itemFlags);
    } else if (item.type === "ceiling") {
      const itemFlags = ceilingFlags(item, settings);
      const manual = itemFlags.some((f) => f.severity === "manual");
      lines.push(makeLine(item, "ceiling", item.label, ceilingArea(item.length, item.width), "m²", settings.ceiling.ratePerSqm, settings.ceiling.minimumCharge, manual));
      flags.push(...itemFlags);
    }
  }

  const subtotalPence = lines.reduce((sum, line) => sum + (line.amountPence ?? 0), 0);
  const totalPence = roundToNearestPounds(subtotalPence, settings.roundToNearest);

  return {
    lines,
    flags,
    subtotalPence,
    roundingAdjustmentPence: totalPence - subtotalPence,
    totalPence,
    requiresManualQuote: flags.some((f) => f.severity === "manual"),
    needsReview: flags.some((f) => f.severity === "review"),
    hasPricedItems: lines.some((l) => l.status === "priced"),
  };
}

/** £1,234.50 style formatting. Whole pounds are shown without pence (e.g. £340). */
export function formatPence(pence: number, options: { alwaysShowPence?: boolean } = {}): string {
  const pounds = pence / 100;
  const showPence = options.alwaysShowPence || pence % 100 !== 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: showPence ? 2 : 0,
    maximumFractionDigits: showPence ? 2 : 0,
  }).format(pounds);
}

export function formatPounds(pounds: number): string {
  return formatPence(poundsToPence(pounds));
}
