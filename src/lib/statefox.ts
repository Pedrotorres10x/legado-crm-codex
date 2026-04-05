export type StatefoxSource = 'idealista' | 'fotocasa' | 'pisoscom' | 'habitaclia';
export type StatefoxOperation = 'sale' | 'rent';
export type StatefoxAdvertiserType = 'all' | 'private' | 'professional';
export type StatefoxSearchMode = 'day' | 'range' | 'ids';

export type StatefoxListing = {
  listingId: string;
  source: string;
  type: string;
  housing: string;
  status: string;
  advertiserName: string;
  advertiserType: string;
  price: number | null;
  rooms: number | null;
  baths: number | null;
  address: string;
  city: string;
  region: string;
  zone: string;
  builtArea: number | null;
  usableArea: number | null;
  pricePerMeter: number | null;
  phones: string[];
  insertDate: string | null;
  link: string;
  description: string;
  imageUrl: string;
};

export type StatefoxSearchError = {
  date?: string | null;
  message: string;
};

export type StatefoxSearchMeta = {
  mode: StatefoxSearchMode;
  source?: StatefoxSource | null;
  type?: StatefoxOperation | null;
  housing?: string | null;
  advertiserType?: StatefoxAdvertiserType | null;
  insert?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  ids?: string[];
  items: number;
  pagesFetched?: number;
  datesProcessed?: string[];
  totalFound?: number;
  totalNormalized?: number;
  errors?: StatefoxSearchError[];
};

export const STATEFOX_SOURCE_OPTIONS: Array<{ value: StatefoxSource; label: string }> = [
  { value: 'idealista', label: 'Idealista' },
  { value: 'fotocasa', label: 'Fotocasa' },
  { value: 'pisoscom', label: 'Pisos.com' },
  { value: 'habitaclia', label: 'Habitaclia' },
];

export const STATEFOX_HOUSING_OPTIONS = [
  { value: 'flat', label: 'Piso' },
  { value: 'house', label: 'Casa' },
  { value: 'countryhouse', label: 'Casa de campo' },
  { value: 'duplex', label: 'Dúplex' },
  { value: 'penthouse', label: 'Ático' },
  { value: 'studio', label: 'Estudio' },
  { value: 'loft', label: 'Loft' },
  { value: 'garage', label: 'Garaje' },
  { value: 'office', label: 'Oficina' },
  { value: 'premises', label: 'Local' },
  { value: 'land', label: 'Terreno' },
  { value: 'building', label: 'Edificio' },
  { value: 'storage', label: 'Trastero' },
  { value: 'warehouse', label: 'Nave' },
  { value: 'room', label: 'Habitación' },
] as const;

export const STATEFOX_ADVERTISER_LABELS: Record<string, string> = {
  private: 'Particular',
  professional: 'Profesional',
};

export const STATEFOX_OPERATION_LABELS: Record<string, string> = {
  sale: 'Venta',
  rent: 'Alquiler',
};

export const STATEFOX_SEARCH_MODE_OPTIONS: Array<{ value: StatefoxSearchMode; label: string }> = [
  { value: 'range', label: 'Historico por fechas' },
  { value: 'ids', label: 'Recuperar por IDs' },
];

export const STATEFOX_HOUSING_LABELS = Object.fromEntries(
  STATEFOX_HOUSING_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;
