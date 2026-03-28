import { LinearFilter, SRGBColorSpace, Texture, type WebGLRenderer } from "three";

/** Browsers decode SVG → small bitmap; draw onto a large canvas before GPU upload. */
const TEXTURE_MAX_SIDE_PX = 4096;

/**
 * Rasterize SVG, then composite onto a canvas with the same aspect ratio as the target quad
 * (planeWidth/planeHeight), with the image scaled uniformly to fit inside (object-fit: contain) and
 * centered. `imageScale` multiplies that fit size (<1 smaller with margin, >1 zoom/crop).
 * Transparent outside the image.
 */
export function loadSvgAsContainFitTexture(
  url: string,
  renderer: WebGLRenderer,
  planeWidth: number,
  planeHeight: number,
  imageScale = 1,
): Promise<Texture> {
  const pw = Math.max(1e-6, planeWidth);
  const ph = Math.max(1e-6, planeHeight);
  const planeAspect = pw / ph;
  const scaleFactor = Math.max(0.1, Math.min(4, imageScale));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const nw = Math.max(1, img.naturalWidth);
        const nh = Math.max(1, img.naturalHeight);
        const scale = TEXTURE_MAX_SIDE_PX / Math.max(nw, nh);
        const rw = Math.max(2, Math.round(nw * scale));
        const rh = Math.max(2, Math.round(nh * scale));

        const src = document.createElement("canvas");
        src.width = rw;
        src.height = rh;
        const sctx = src.getContext("2d", { alpha: true });
        if (!sctx) {
          reject(new Error("Could not get 2D canvas context"));
          return;
        }
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = "high";
        sctx.clearRect(0, 0, rw, rh);
        sctx.drawImage(img, 0, 0, rw, rh);

        let outW: number;
        let outH: number;
        if (planeAspect >= 1) {
          outW = TEXTURE_MAX_SIDE_PX;
          outH = Math.max(2, Math.round(TEXTURE_MAX_SIDE_PX / planeAspect));
        } else {
          outH = TEXTURE_MAX_SIDE_PX;
          outW = Math.max(2, Math.round(TEXTURE_MAX_SIDE_PX * planeAspect));
        }

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) {
          reject(new Error("Could not get 2D canvas context"));
          return;
        }
        ctx.clearRect(0, 0, outW, outH);

        const fit = Math.min(outW / rw, outH / rh);
        const dw = rw * fit * scaleFactor;
        const dh = rh * fit * scaleFactor;
        const x = (outW - dw) / 2;
        const y = (outH - dh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(src, 0, 0, rw, rh, x, y, dw, dh);

        const tex = new Texture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.flipY = false;
        tex.needsUpdate = true;
        tex.generateMipmaps = false;
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(tex);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
