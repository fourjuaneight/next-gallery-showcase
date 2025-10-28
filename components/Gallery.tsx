import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { glob } from "glob";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import sharp from "sharp";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ImageMetadata = {
  src: string;
  width: number;
  height: number;
  base64: string;
};

// Cache and periodically refresh image metadata so new assets appear without redeploys.
const fetchImageMetadata = unstable_cache(
  async (pattern: string): Promise<ImageMetadata[]> => {
    try {
      const files = await glob(pattern, { posix: true });
      const sortedFiles = files.sort((a, b) => a.localeCompare(b));

      const imagePromises = sortedFiles.map(async (file) => {
        try {
          const src = file.replace(/^public/, "");
          const image = sharp(file);
          const metadata = await image.metadata();

          if (!metadata?.width || !metadata?.height || !metadata.format) {
            throw new Error(`Incomplete metadata for ${file}`);
          }

          const mimeType = metadata.format === "jpeg" ? "jpg" : metadata.format;
          const buffer = await image
            .clone()
            .resize(10, 10, { fit: "inside" })
            .toBuffer();
          const base64 = `data:image/${mimeType};base64,${buffer.toString(
            "base64"
          )}`;

          return {
            src,
            width: metadata.width,
            height: metadata.height,
            base64,
          } satisfies ImageMetadata;
        } catch (err) {
          console.warn(`Skipping image ${file}:`, err);
          return null;
        }
      });

      return (await Promise.all(imagePromises)).filter(
        (img): img is ImageMetadata => Boolean(img)
      );
    } catch (error) {
      console.error("Error fetching image metadata:", error);
      return [];
    }
  },
  ["gallery-images"],
  {
    revalidate: 3600,
    tags: ["gallery"],
  }
);

const Gallery = async () => {
  const images = await fetchImageMetadata(
    "public/gallery/*.{jpg,jpeg,png,webp}"
  );

  if (!images.length) {
    return (
      <p className="col-span-full py-10 text-center text-muted-foreground">
        No images found in the gallery.
      </p>
    );
  }

  const gridImageSizes =
    "(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw";

  return images.map(({ src, height, width, base64 }) => {
    const altText =
      src
        .split("/")
        .pop()
        ?.replace(/\..+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim() || "Gallery image";

    return (
      <Dialog key={src}>
        <DialogTrigger asChild>
          <AspectRatio
            ratio={3 / 2}
            className="group relative cursor-zoom-in overflow-hidden rounded-lg"
          >
            <Image
              src={src}
              placeholder="blur"
              blurDataURL={base64}
              alt={altText}
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
              fill
              sizes={gridImageSizes}
              loading="lazy"
            />
          </AspectRatio>
        </DialogTrigger>
        <DialogContent className="p-0 flex items-center justify-center">
          <VisuallyHidden>
            <DialogTitle>{altText}</DialogTitle>
          </VisuallyHidden>
          <Image
            src={src}
            placeholder="blur"
            blurDataURL={base64}
            height={height}
            width={width}
            alt={altText}
            className="rounded-lg object-contain w-full h-full"
            sizes="(min-width: 768px) 75vw, 100vw"
            loading="lazy"
          />
        </DialogContent>
      </Dialog>
    );
  });
};

export default Gallery;
