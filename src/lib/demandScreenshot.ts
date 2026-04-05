type PreparedScreenshot = {
  base64: string;
  mimeType: string;
  fileName: string;
};

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.72;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer la captura'));
    reader.readAsDataURL(file);
  });

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo procesar la captura'));
    image.src = dataUrl;
  });

const buildFileName = (file: File, mimeType: string) => {
  if (file.name?.trim()) return file.name;
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return `pantallazo-${Date.now()}.${extension}`;
};

export async function prepareDemandScreenshot(file: File): Promise<PreparedScreenshot> {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo preparar la captura');
  }

  context.drawImage(image, 0, 0, width, height);

  const usePng = (file.type || '').toLowerCase() === 'image/png' && width <= 900 && height <= 900;
  const mimeType = usePng ? 'image/png' : 'image/jpeg';
  const preparedDataUrl = canvas.toDataURL(mimeType, mimeType === 'image/jpeg' ? JPEG_QUALITY : undefined);
  const [, base64 = ''] = preparedDataUrl.split(',');

  return {
    base64,
    mimeType,
    fileName: buildFileName(file, mimeType),
  };
}

export async function ocrDemandScreenshot(file: File): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(file, 'spa+eng', {
    logger: () => undefined,
  });

  return (result.data?.text || '').replace(/\s+\n/g, '\n').trim();
}
