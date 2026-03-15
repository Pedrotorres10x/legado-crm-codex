export type PropertyMediaFile = {
  url: string;
  name: string;
  type: 'image' | 'video';
};

export type PropertyImageOrderEntry = {
  name: string;
  label: string;
  source: string;
};

type OrderedImage = PropertyMediaFile & {
  isXml: boolean;
  label: string;
};

type OrderedVideo = PropertyMediaFile & {
  isXml: boolean;
};

const IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|webp|gif|avif)$/i;
const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|avi)$/i;

const XML_FEED_DOMAINS = [
  'medianewbuild.com',
  'resales-online.com',
  'kyero.com',
  'idealista.com/imgxml',
  'fotocasa.es',
  'propertyimages.ie',
  'inmofactory.com',
  'apidata.es',
];

const ESTANCIA_ORDER = [
  ['piscina', 'jardín', 'jardin', 'patio', 'exterior', 'terraza', 'balcón', 'balcon', 'fachada', 'entrada', 'garaje', 'parking', 'zona común', 'zona comun', 'comunidad'],
  ['salón', 'salon', 'living', 'comedor', 'estar'],
  ['cocina'],
  ['dormitorio', 'habitación', 'habitacion', 'cuarto', 'suite'],
  ['baño', 'bano', 'aseo', 'ducha'],
];

export const buildPropertyMediaUrl = (supabaseUrl: string, propertyId: string, fileName: string) =>
  `${supabaseUrl}/storage/v1/object/public/property-media/${propertyId}/${fileName}`;

export const buildPropertyMediaFilesFromStorage = (
  supabaseUrl: string,
  propertyId: string,
  files: Array<{ name: string }>,
): PropertyMediaFile[] => (
  files
    .filter((file) => !file.name.startsWith('.') && (IMAGE_FILE_PATTERN.test(file.name) || VIDEO_FILE_PATTERN.test(file.name)))
    .map((file) => ({
      url: buildPropertyMediaUrl(supabaseUrl, propertyId, file.name),
      name: file.name,
      type: VIDEO_FILE_PATTERN.test(file.name) ? 'video' : 'image',
    }))
);

export const buildCatastroSnapshotContent = (reference: string, catastroData: Record<string, any>) => {
  const lines = [
    'FICHA CATASTRAL',
    `Fecha de consulta: ${new Date().toLocaleDateString('es-ES')}`,
    `Referencia Catastral: ${reference}`,
    '',
  ];

  for (const [key, value] of Object.entries(catastroData)) {
    if (value) lines.push(`${key}: ${value}`);
  }

  return lines.join('\n');
};

export const getPropertyImageSource = (image: Pick<OrderedImage, 'name' | 'isXml'>): string => {
  if (image.isXml) return 'xml';
  if (image.name.startsWith('xmlurl_')) return 'external';
  return 'storage';
};

export const getEstanciaGroup = (label: string) => {
  const normalized = label.toLowerCase();
  for (let index = 0; index < ESTANCIA_ORDER.length; index += 1) {
    if (ESTANCIA_ORDER[index].some((keyword) => normalized.includes(keyword))) return index;
  }
  return ESTANCIA_ORDER.length;
};

export const resolvePropertyImageUrls = ({
  supabaseUrl,
  propertyId,
  propertyImages,
  imageOrder,
  mediaFiles,
}: {
  supabaseUrl: string;
  propertyId: string;
  propertyImages: string[];
  imageOrder: PropertyImageOrderEntry[];
  mediaFiles: PropertyMediaFile[];
}) => {
  const ownStoragePrefix = `${supabaseUrl}/storage/v1/object/public/property-media/${propertyId}/`;
  const xmlOnlyUrls = propertyImages.filter((url) => !url.startsWith(ownStoragePrefix));
  const storageUrls = mediaFiles
    .filter((file) => file.type === 'image')
    .map((file) => buildPropertyMediaUrl(supabaseUrl, propertyId, file.name));

  const orderedUrls: string[] = [];

  if (imageOrder.length > 0) {
    for (const entry of imageOrder) {
      if (entry.source === 'xml') {
        if (entry.name.startsWith('xmlurl_')) {
          const url = entry.name.replace('xmlurl_', '');
          if (xmlOnlyUrls.includes(url)) orderedUrls.push(url);
        } else if (entry.name.startsWith('xml_')) {
          const index = parseInt(entry.name.replace('xml_', ''), 10);
          const candidate = propertyImages[index];
          if (candidate && !candidate.startsWith(ownStoragePrefix)) orderedUrls.push(candidate);
        }
      } else if (entry.source === 'storage') {
        orderedUrls.push(buildPropertyMediaUrl(supabaseUrl, propertyId, entry.name));
      } else if (entry.source === 'external' && entry.name.startsWith('xmlurl_')) {
        orderedUrls.push(entry.name.replace('xmlurl_', ''));
      }
    }
  }

  const combined = imageOrder.length > 0
    ? [...orderedUrls, ...[...xmlOnlyUrls, ...storageUrls].filter((url) => !orderedUrls.includes(url))]
    : [...xmlOnlyUrls, ...storageUrls];

  const seen = new Set<string>();
  return combined.filter((url) => {
    const normalized = url.split('?')[0];
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const buildPropertyMediaCollections = ({
  supabaseUrl,
  propertyId,
  propertyImages,
  propertyVideos,
  imageOrder,
  mediaFiles,
}: {
  supabaseUrl: string;
  propertyId: string;
  propertyImages: string[];
  propertyVideos: string[];
  imageOrder: PropertyImageOrderEntry[];
  mediaFiles: PropertyMediaFile[];
}): { images: OrderedImage[]; videos: OrderedVideo[] } => {
  const storagePrefix = `${supabaseUrl}/storage/v1/object/public/property-media/${propertyId}/`;
  const isOurStorageUrl = (url: string) => url.startsWith(storagePrefix);
  const isXmlFeedUrl = (url: string) => XML_FEED_DOMAINS.some((domain) => url.includes(domain));

  const xmlImages: OrderedImage[] = propertyImages
    .filter((url) => !isOurStorageUrl(url) && isXmlFeedUrl(url))
    .map((url) => {
      const urlName = `xmlurl_${url}`;
      const legacyLabel = imageOrder.find((entry) => entry.name === urlName)?.label || '';
      const fallbackEntry = !legacyLabel
        ? imageOrder.find((entry) => entry.source === 'xml' && entry.name.startsWith('xml_') && (() => {
          const index = parseInt(entry.name.replace('xml_', ''), 10);
          return propertyImages[index] === url;
        })())
        : undefined;

      return {
        url,
        name: urlName,
        type: 'image',
        isXml: true,
        label: legacyLabel || fallbackEntry?.label || '',
      };
    });

  const mediaFileNames = new Set(mediaFiles.filter((file) => file.type === 'image').map((file) => file.name));

  const storageFromMedia: OrderedImage[] = mediaFiles
    .filter((file) => file.type === 'image')
    .map((file) => ({
      ...file,
      isXml: false,
      label: imageOrder.find((entry) => entry.name === file.name)?.label || '',
    }));

  const externalManualImages: OrderedImage[] = propertyImages
    .filter((url) => !isOurStorageUrl(url) && !isXmlFeedUrl(url))
    .map((url) => ({
      url,
      name: `xmlurl_${url}`,
      type: 'image',
      isXml: false,
      label: imageOrder.find((entry) => entry.name === `xmlurl_${url}`)?.label || '',
    }));

  const storageFromDb: OrderedImage[] = propertyImages
    .filter((url) => isOurStorageUrl(url))
    .map((url) => {
      const name = url.replace(storagePrefix, '').split('?')[0];
      return {
        url,
        name,
        type: 'image' as const,
        isXml: false,
        label: imageOrder.find((entry) => entry.name === name)?.label || '',
      };
    })
    .filter((file) => !mediaFileNames.has(file.name));

  const orderedNames = imageOrder.map((entry) => entry.name);
  const hasManualOrder = orderedNames.length > 0;
  const images = [...xmlImages, ...storageFromMedia, ...storageFromDb, ...externalManualImages].sort((left, right) => {
    if (hasManualOrder) {
      const leftIndex = orderedNames.indexOf(left.name);
      const rightIndex = orderedNames.indexOf(right.name);
      if (leftIndex === -1 && rightIndex === -1) return 0;
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return getEstanciaGroup(left.label || left.name) - getEstanciaGroup(right.label || right.name);
  });

  const xmlVideos: OrderedVideo[] = propertyVideos.map((url, index) => ({
    url,
    name: `xml_video_${index}`,
    type: 'video',
    isXml: true,
  }));

  const storageVideos: OrderedVideo[] = mediaFiles
    .filter((file) => file.type === 'video')
    .map((file) => ({
      ...file,
      isXml: false,
    }));

  return {
    images,
    videos: [...xmlVideos, ...storageVideos],
  };
};

export const buildImageOrderUpdatePayload = ({
  supabaseUrl,
  propertyId,
  propertyImages,
  imageOrder,
}: {
  supabaseUrl: string;
  propertyId: string;
  propertyImages: string[];
  imageOrder: PropertyImageOrderEntry[];
}) => {
  const ownStoragePrefix = `${supabaseUrl}/storage/v1/object/public/property-media/${propertyId}/`;
  const orderedUrls: string[] = [];
  const floorPlanUrls: string[] = [];

  for (const entry of imageOrder) {
    let url: string | undefined;
    if (entry.source === 'xml' || entry.source === 'external') {
      if (entry.name.startsWith('xmlurl_')) {
        url = entry.name.replace('xmlurl_', '');
      } else if (entry.name.startsWith('xml_')) {
        const index = parseInt(entry.name.replace('xml_', ''), 10);
        const candidate = propertyImages[index];
        if (candidate && !candidate.startsWith(ownStoragePrefix)) url = candidate;
      }
    } else if (entry.source === 'storage') {
      url = buildPropertyMediaUrl(supabaseUrl, propertyId, entry.name);
    }

    if (url) {
      orderedUrls.push(url);
      if (entry.label === 'plano') floorPlanUrls.push(url);
    }
  }

  const remainingUrls = propertyImages
    .filter((url) => !url.startsWith(ownStoragePrefix))
    .filter((url) => !orderedUrls.includes(url));

  return {
    images: [...orderedUrls, ...remainingUrls],
    floorPlans: floorPlanUrls,
  };
};

export const removeDeletedImagesFromProperty = ({
  supabaseUrl,
  propertyId,
  propertyImages,
  imageOrder,
  deletedNames,
  remainingStorageFiles,
}: {
  supabaseUrl: string;
  propertyId: string;
  propertyImages: string[];
  imageOrder: PropertyImageOrderEntry[];
  deletedNames: string[];
  remainingStorageFiles: PropertyMediaFile[];
}) => {
  const storagePrefix = `${supabaseUrl}/storage/v1/object/public/property-media/${propertyId}/`;
  const deletedUrls = new Set(
    deletedNames.map((name) => (
      name.startsWith('xmlurl_')
        ? name.replace('xmlurl_', '').split('?')[0]
        : `${storagePrefix}${name}`.split('?')[0]
    )),
  );

  const remainingStorageNames = new Set(
    remainingStorageFiles
      .filter((file) => file.type === 'image')
      .map((file) => file.name),
  );

  return {
    imageOrder: imageOrder.filter((entry) => !deletedNames.includes(entry.name)),
    images: propertyImages
      .filter((url) => !deletedUrls.has(url.split('?')[0]))
      .filter((url) => {
        if (!url.startsWith(storagePrefix)) return true;
        const fileName = url.replace(storagePrefix, '').split('?')[0];
        return remainingStorageNames.has(fileName);
      }),
  };
};
