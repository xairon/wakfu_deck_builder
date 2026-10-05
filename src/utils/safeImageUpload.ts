/**
 * Utilitaire de validation et d'assainissement sécurisé pour les images téléversées.
 * 
 * Protection stricte contre les cyberattaques :
 * 1. Blocage strict des SVG / XML / HTML (prévention totale des injections XSS / SSRF / XXE).
 * 2. Vérification binaire des signatures de fichiers (Magic Bytes) contre l'usurpation de type MIME.
 * 3. Limitation stricte de la taille de fichier (DoS / dépassement de mémoire).
 * 4. Décodage et ré-encodage via Canvas HTML5 (neutralisation des polyglottes, malformations EXIF et stéganographie malveillante).
 */

export interface SafeImageResult {
  ok: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface SafeImageOptions {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  outputQuality?: number;
}

const DEFAULT_OPTIONS: Required<SafeImageOptions> = {
  maxSizeBytes: 5 * 1024 * 1024, // 5 Mo max
  maxWidth: 1200,
  maxHeight: 1200,
  outputQuality: 0.9,
};

// Types MIME autorisés (stricte interdiction de image/svg+xml)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  'svg', 'xml', 'html', 'htm', 'xhtml', 'js', 'mjs', 'ts', 'exe', 'bat', 'sh', 'php', 'py', 'wasm',
]);

/**
 * Valide les Magic Bytes (octets d'en-tête) d'un flux binaire pour garantir qu'il s'agit
 * bien d'une vraie image raster et non d'un script ou binaire masqué.
 */
export function verifyImageMagicBytes(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'gif' | 'avif' | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 && // P
    bytes[2] === 0x4E && // N
    bytes[3] === 0x47 && // G
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return 'png';
  }

  // GIF: GIF87a ou GIF89a (47 49 46 38 37 61 ou 47 49 46 38 39 61)
  if (
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 && // 8
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 ou 9
    bytes[5] === 0x61 // a
  ) {
    return 'gif';
  }

  // WebP: RIFF .... WEBP
  // bytes 0-3 = "RIFF" (52 49 46 46), bytes 8-11 = "WEBP" (57 45 42 50)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // AVIF: .... ftypavif ou ftypavis
  // bytes 4-7 = "ftyp" (66 74 79 70), bytes 8-11 = "avif" (61 76 69 66) ou "avis"
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    (bytes[11] === 0x66 || bytes[11] === 0x73)
  ) {
    return 'avif';
  }

  return null;
}

/**
 * Lit les premiers octets d'un fichier sous forme de chaîne ASCII pour détection heuristique
 * de scripts cachés (par exemple SVG XML camouflé ou balises <script>).
 */
export function containsMaliciousPayload(bytes: Uint8Array): boolean {
  // Convertir les premiers 512 octets en chaîne minuscule
  const sliceLen = Math.min(bytes.length, 512);
  let ascii = '';
  for (let i = 0; i < sliceLen; i++) {
    ascii += String.fromCharCode(bytes[i] & 0x7f);
  }
  ascii = ascii.toLowerCase();

  if (
    ascii.includes('<?xml') ||
    ascii.includes('<svg') ||
    ascii.includes('<html') ||
    ascii.includes('<script') ||
    ascii.includes('javascript:') ||
    ascii.includes('onload=') ||
    ascii.includes('onerror=') ||
    ascii.includes('<!doctype')
  ) {
    return true;
  }
  return false;
}

/**
 * Valide et assainit un fichier image sélectionné par l'utilisateur.
 * Rejette catégoriquement tout fichier potentiellement malveillant.
 */
export async function validateAndSanitizeImageFile(
  file: File,
  options?: SafeImageOptions,
): Promise<SafeImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Contrôle du nom et de l'extension
  const filename = file.name.toLowerCase();
  const ext = filename.split('.').pop() || '';
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Sécurité : le type de fichier ".${ext}" est strictement interdit (formats vectoriels ou exécutables bloqués).`,
    };
  }

  // 2. Contrôle de la taille
  if (file.size > opts.maxSizeBytes) {
    const maxMb = Math.round(opts.maxSizeBytes / (1024 * 1024));
    return {
      ok: false,
      error: `Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). La taille maximale autorisée est de ${maxMb} Mo.`,
    };
  }

  if (file.size < 16) {
    return {
      ok: false,
      error: "Fichier image corrompu ou invalide (taille nulle ou insuffisante).",
    };
  }

  // 3. Contrôle du MIME type déclaré
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: `Format non supporté (${file.type || 'inconnu'}). Formats acceptés : PNG, JPG, WebP, GIF, AVIF.`,
    };
  }

  // 4. Lecture des Magic Bytes et recherche de payload suspect
  let headerBytes: Uint8Array;
  try {
    const buffer = typeof file.arrayBuffer === 'function'
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer();
    headerBytes = new Uint8Array(buffer.slice(0, 512));
  } catch {
    return {
      ok: false,
      error: "Impossible de lire le contenu du fichier sélectionné.",
    };
  }

  if (containsMaliciousPayload(headerBytes)) {
    return {
      ok: false,
      error: "Alerte de sécurité : contenu script ou XML suspect détecté dans le fichier image.",
    };
  }

  const detectedFormat = verifyImageMagicBytes(headerBytes);
  if (!detectedFormat) {
    return {
      ok: false,
      error: "Alerte de sécurité : la signature binaire du fichier ne correspond pas à une image raster valide.",
    };
  }

  // 5. Décodage et ré-encodage Canvas (sanitisation complète)
  // Même si l'image contenait des données EXIF ou des stéganographies malveillantes,
  // la recréation sur un canvas extrait uniquement les pixels et ré-émet un WebP/JPEG pur.
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcul des dimensions avec respect du ratio et des plafonds
      let targetWidth = img.naturalWidth;
      let targetHeight = img.naturalHeight;

      if (targetWidth <= 0 || targetHeight <= 0) {
        resolve({
          ok: false,
          error: "Dimensions de l'image invalides.",
        });
        return;
      }

      if (targetWidth > opts.maxWidth || targetHeight > opts.maxHeight) {
        const ratio = Math.min(
          opts.maxWidth / targetWidth,
          opts.maxHeight / targetHeight,
        );
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({
            ok: false,
            error: "Impossible d'initialiser le moteur de traitement d'image sécurisé.",
          });
          return;
        }

        // Dessin des pixels décodés uniquement
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Export propre en WebP (ou JPEG en fallback)
        let sanitizedDataUrl: string;
        try {
          sanitizedDataUrl = canvas.toDataURL('image/webp', opts.outputQuality);
          // Si le navigateur ne supporte pas WebP pour toDataURL, il renvoie du PNG
        } catch {
          sanitizedDataUrl = canvas.toDataURL('image/jpeg', opts.outputQuality);
        }

        resolve({
          ok: true,
          dataUrl: sanitizedDataUrl,
          width: targetWidth,
          height: targetHeight,
        });
      } catch {
        resolve({
          ok: false,
          error: "Échec de l'assainissement de l'image.",
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        ok: false,
        error: "Impossible de décoder l'image : fichier corrompu ou format non supporté.",
      });
    };

    img.src = objectUrl;
  });
}
