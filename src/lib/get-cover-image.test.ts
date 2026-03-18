import { describe, it, expect, vi } from 'vitest';
import { getCoverImage } from './get-cover-image';

const IMAGES = [
  'https://cdn.example.com/photo-abc123.jpg',
  'https://cdn.example.com/photo-def456.jpg',
  'https://cdn.example.com/photo-ghi789.jpg',
];

describe('getCoverImage', () => {
  // ── Casos sin imágenes ──────────────────────────────────────────────────
  it('retorna null cuando images es null', () => {
    expect(getCoverImage(null, null)).toBeNull();
  });

  it('retorna null cuando images es un array vacío', () => {
    expect(getCoverImage([], null)).toBeNull();
  });

  // ── Sin image_order ──────────────────────────────────────────────────────
  it('retorna images[0] cuando image_order es null', () => {
    expect(getCoverImage(IMAGES, null)).toBe(IMAGES[0]);
  });

  it('retorna images[0] cuando image_order es undefined', () => {
    expect(getCoverImage(IMAGES, undefined)).toBe(IMAGES[0]);
  });

  it('retorna images[0] cuando image_order es array vacío', () => {
    expect(getCoverImage(IMAGES, [])).toBe(IMAGES[0]);
  });

  // ── image_order con string xml_N ─────────────────────────────────────────
  it('retorna images[0] cuando image_order[0] es "xml_0"', () => {
    expect(getCoverImage(IMAGES, ['xml_0'])).toBe(IMAGES[0]);
  });

  it('retorna images[1] cuando image_order[0] es "xml_1"', () => {
    expect(getCoverImage(IMAGES, ['xml_1'])).toBe(IMAGES[1]);
  });

  it('retorna images[2] cuando image_order[0] es "xml_2"', () => {
    expect(getCoverImage(IMAGES, ['xml_2'])).toBe(IMAGES[2]);
  });

  it('hace fallback a images[0] cuando xml_N está fuera de rango', () => {
    expect(getCoverImage(IMAGES, ['xml_99'])).toBe(IMAGES[0]);
  });

  // ── image_order con objeto { name: "xml_N" } ─────────────────────────────
  it('retorna images[1] cuando image_order[0] es { name: "xml_1" }', () => {
    expect(getCoverImage(IMAGES, [{ name: 'xml_1' }])).toBe(IMAGES[1]);
  });

  it('retorna images[0] cuando image_order[0] es { name: "xml_0" }', () => {
    expect(getCoverImage(IMAGES, [{ name: 'xml_0' }])).toBe(IMAGES[0]);
  });

  it('hace fallback a images[0] cuando { name: "xml_99" } está fuera de rango', () => {
    expect(getCoverImage(IMAGES, [{ name: 'xml_99' }])).toBe(IMAGES[0]);
  });

  // ── image_order con nombre de archivo (no xml_) ──────────────────────────
  it('busca por coincidencia parcial de URL cuando el nombre no empieza por xml_', () => {
    expect(getCoverImage(IMAGES, ['photo-def456'])).toBe(IMAGES[1]);
  });

  it('retorna la URL correcta cuando el nombre coincide parcialmente', () => {
    expect(getCoverImage(IMAGES, ['photo-ghi789'])).toBe(IMAGES[2]);
  });

  it('retorna images[0] cuando el nombre no coincide con ninguna URL', () => {
    expect(getCoverImage(IMAGES, ['foto-inexistente.jpg'])).toBe(IMAGES[0]);
  });

  // ── image_order con objeto { name: "nombre-archivo" } ───────────────────
  it('busca por coincidencia cuando image_order[0] es { name: "nombre-no-xml" }', () => {
    expect(getCoverImage(IMAGES, [{ name: 'photo-abc123' }])).toBe(IMAGES[0]);
  });

  it('retorna images[0] si el objeto { name } no coincide con ninguna URL', () => {
    expect(getCoverImage(IMAGES, [{ name: 'no-existe.jpg' }])).toBe(IMAGES[0]);
  });

  // ── Casos de borde adicionales ───────────────────────────────────────────
  it('ignora entradas no-string en image_order y retorna images[0]', () => {
    expect(getCoverImage(IMAGES, [null])).toBe(IMAGES[0]);
  });

  it('retorna images[0] con una sola imagen sin image_order', () => {
    expect(getCoverImage(['https://cdn.example.com/unica.jpg'], null)).toBe(
      'https://cdn.example.com/unica.jpg'
    );
  });

  // ── source: "storage" ────────────────────────────────────────────────────
  it('construye URL de storage cuando source es "storage" y hay propertyId', () => {
    const order = [{ name: 'parking-foto.jpg', source: 'storage' }];
    const result = getCoverImage([], order, 'prop-123');
    expect(result).toContain('/storage/v1/object/public/property-media/prop-123/parking-foto.jpg');
  });

  it('construye URL de storage incluso con images vacío', () => {
    const order = [{ name: 'foto.jpg', source: 'storage' }];
    const result = getCoverImage(null, order, 'abc');
    expect(result).toContain('/storage/v1/object/public/property-media/abc/foto.jpg');
  });

  it('retorna null si source es storage pero falta propertyId', () => {
    const order = [{ name: 'foto.jpg', source: 'storage' }];
    expect(getCoverImage([], order)).toBeNull();
  });

  it('retorna null si source es storage pero falta name', () => {
    const order = [{ source: 'storage' }];
    expect(getCoverImage([], order, 'prop-1')).toBeNull();
  });

  it('prioriza storage sobre images cuando ambos existen', () => {
    const order = [{ name: 'portada.jpg', source: 'storage' }];
    const result = getCoverImage(IMAGES, order, 'prop-x');
    expect(result).toContain('/storage/v1/object/public/property-media/prop-x/portada.jpg');
  });

  it('ignora videos al principio de image_order y usa la primera foto valida', () => {
    const order = [
      { name: 'tour.mp4', source: 'storage' },
      { name: 'xml_1', source: 'xml' },
    ];
    expect(getCoverImage(IMAGES, order, 'prop-x')).toBe(IMAGES[1]);
  });

  it('ignora xmlurl_ que apunta a un video y hace fallback a images[0]', () => {
    const order = ['xmlurl_https://cdn.example.com/video.mp4'];
    expect(getCoverImage(IMAGES, order)).toBe(IMAGES[0]);
  });

  it('acepta URLs absolutas heredadas en image_order cuando son imagenes', () => {
    const legacyUrl = 'https://legacy.example.com/media/portada.jpg';
    const order = [{ name: legacyUrl, source: 'xml' }];
    expect(getCoverImage(IMAGES, order)).toBe(legacyUrl);
  });
});
