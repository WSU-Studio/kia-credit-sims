export type NavItem = {
  label: string;
  href: string;
  target?: string;
  rel?: string;
};

export type Benefit = {
  title: string;
  description: string;
  isClickable?: boolean;
  linkUrl?: string;
  openInNewTab?: boolean;
};

export type Product = {
  id?: string;
  title: string;
  subtitle?: string;
  image: string;
};

export type Article = {
  title: string;
  image: string;
  slug?: string;
};

export type Slide = {
  title: string;
  highlight: string;
  description: string;
  image: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type ContactItem = {
  label: string;
  text: string;
  href?: string;
  icon?: React.ReactNode;
};

export type AppLink = {
  label: string;
  src: string;
  href: string;
};

export type CompanyInfo = {
  name: string;
  address: string[];
  legalLinks: { label: string; href: string }[];
  contact: ContactItem[];
  apps: AppLink[];
  disclaimer?: string;
  copyright?: string;
};

// Static page layout (widget-based)
export type WidgetType = 'text' | 'text_image' | 'rich_text' | 'cta' | 'download';

export type LayoutCell = {
  id: string;
  widgetType: WidgetType;
  payload: Record<string, unknown>;
};

export type LayoutRow = {
  id: string;
  gridCols: 1 | 2 | 3;
  cells: LayoutCell[];
  /** Jika true (default), row dibungkus Container; jika false, row full width sampai tepi layar */
  useContainer?: boolean;
  /** Margin top 16px (mt-4) bila true */
  marginTop?: boolean;
  /** Margin bottom 16px (mb-4) bila true */
  marginBottom?: boolean;
};

export type PageLayout = {
  rows: LayoutRow[];
};

/** Pengaturan teks bersama untuk widget (TextWidget, TextImageWidget). Weight sesuai HyundaiSans: Light 300, Regular 400, Medium 500, Bold 700 */
export type SharedTextSettings = {
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textSize?: '12' | '16' | '20' | '24' | '32' | '40' | '48' | '56' | '64';
  textWeight?: 'light' | 'normal' | 'medium' | 'bold';
};

export type TextWidgetPayload = SharedTextSettings & {
  content: string;
  contentEn?: string;
};

export type RichTextWidgetPayload = SharedTextSettings & {
  content: string;
  contentEn?: string;
};

export type TextImageWidgetPayload = SharedTextSettings & {
  title?: string;
  body?: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right' | 'above' | 'below';
  imageRatio?: 'default' | '1:1' | '4:3' | '16:9' | '3:1' | '4:1' | '5:1';
  /** Teks di dalam gambar (overlay) atau di luar gambar (default: outside) */
  textPlacement?: 'inside' | 'outside';
};

export type CtaButtonItem = {
  id: string;
  label: string;
  labelEn?: string;
  url: string;
  openInNewTab?: boolean;
};

export type CtaWidgetSettings = {
  align?: 'left' | 'center' | 'right';
  direction?: 'row' | 'column';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  gap?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};

export type CtaWidgetPayload = CtaWidgetSettings & {
  buttons: CtaButtonItem[];
};

export type DownloadFileItem = {
  id: string;
  title: string;
  titleEn?: string;
  subtitle?: string;
  subtitleEn?: string;
  fileUrl: string;
  filename?: string;
};

export type DownloadWidgetSettings = {
  align?: 'left' | 'center' | 'right';
  direction?: 'row' | 'column';
};

export type DownloadWidgetPayload = DownloadWidgetSettings & {
  files: DownloadFileItem[];
};

// Re-export credit simulation types
export type {
  ApiResponse,
  KeyValuePair,
  Vendor,
  VendorKeyValue,
  AssetMaster,
  ManufacturingYear,
  AssetVariant,
  ExteriorColor,
  InteriorColor,
  ProductCalculation,
  DefaultProduct,
  SimulationFormData,
  SimulationResult,
} from './credit-simulation';
