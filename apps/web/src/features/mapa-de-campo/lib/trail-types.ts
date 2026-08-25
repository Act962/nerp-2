export interface TrailStop {
  id: string;
  kind: "FOTO" | "CHECKIN" | "CHECKOUT";
  at: string;
  endAt: string | null;
  latitude: number;
  longitude: number;
  storeId: string | null;
  storeName: string | null;
  city: string | null;
  state: string | null;
  /** Capturas ("ativações") da parada — NÃO é o número de imagens. */
  activationCount: number;
  imageCount: number;
  gapFromPreviousMs: number | null;
  /** O servidor decide onde a linha quebra — ver `_trail.ts`. */
  startsNewSegment: boolean;
}

/** O período de um promotor num único cliente. */
export interface StoreVisit {
  storeId: string;
  storeName: string | null;
  visits: number;
  activationCount: number;
  imageCount: number;
  activeMs: number;
  measuredVisits: number;
  avgVisitMs: number;
  firstAt: string;
  lastAt: string;
}

export interface PromoterTrail {
  memberId: string;
  name: string;
  /** URL absoluta da foto de perfil — vira o marcador da parada. */
  image: string | null;
  points: TrailStop[];
  firstAt: string | null;
  lastAt: string | null;
  storeCount: number;
  activationCount: number;
  imageCount: number;
  activeMs: number;
  travelMs: number;
  idleMs: number;
  spanMs: number;
  unmeasuredStops: number;
  measuredStops: number;
  avgVisitMs: number;
  byStore: StoreVisit[];
}
