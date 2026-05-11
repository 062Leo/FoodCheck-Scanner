import * as FileSystem from 'expo-file-system/legacy';

const IMAGE_DIR = `${FileSystem.documentDirectory}product_images/`;

export class LocalImageCache {
  static async ensureDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
    }
  }

  static getImagePath(ean: string, type: string): string {
    return `${IMAGE_DIR}${ean}_${type}.jpg`;
  }

  static async downloadImage(ean: string, url: string, type: string): Promise<string | null> {
    try {
      await LocalImageCache.ensureDirectory();
      const localPath = LocalImageCache.getImagePath(ean, type);

      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return localPath;
      }

      const downloadResult = await FileSystem.downloadAsync(url, localPath);
      if (downloadResult.status === 200) {
        return localPath;
      }

      return null;
    } catch {
      return null;
    }
  }

  static async downloadProductImages(
    ean: string,
    images: {
      imageUrl?: string | null;
      imageIngredientsUrl?: string | null;
      imageNutritionUrl?: string | null;
      imagePackagingUrl?: string | null;
    }
  ): Promise<{
    imageUrl?: string;
    imageIngredientsUrl?: string;
    imageNutritionUrl?: string;
    imagePackagingUrl?: string;
  }> {
    const result: Record<string, string | undefined> = {};

    const downloads: Promise<void>[] = [];

    const downloadIfPresent = (url: string | null | undefined, type: string, key: string) => {
      if (!url) return;
      downloads.push(
        LocalImageCache.downloadImage(ean, url, type).then((localPath) => {
          if (localPath) result[key] = localPath;
        })
      );
    };

    downloadIfPresent(images.imageUrl, 'front', 'imageUrl');
    downloadIfPresent(images.imageIngredientsUrl, 'ingredients', 'imageIngredientsUrl');
    downloadIfPresent(images.imageNutritionUrl, 'nutrition', 'imageNutritionUrl');
    downloadIfPresent(images.imagePackagingUrl, 'packaging', 'imagePackagingUrl');

    await Promise.allSettled(downloads);

    return result;
  }

  static async clearImages(ean: string): Promise<void> {
    const types = ['front', 'ingredients', 'nutrition', 'packaging'];
    for (const type of types) {
      const path = LocalImageCache.getImagePath(ean, type);
      try {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(path);
        }
      } catch {
        // Ignore individual file deletion errors
      }
    }
  }

  static async clearAllImages(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(IMAGE_DIR);
      }
    } catch {
      // Ignore deletion errors
    }
  }

  static async getStoredImages(ean: string): Promise<string[]> {
    const paths: string[] = [];
    const types = ['front', 'ingredients', 'nutrition', 'packaging'];
    for (const type of types) {
      const path = LocalImageCache.getImagePath(ean, type);
      try {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists) {
          paths.push(path);
        }
      } catch {
        // Ignore
      }
    }
    return paths;
  }

  static async cleanupOrphanedImages(knownEans: Set<string>): Promise<number> {
    let cleaned = 0;
    try {
      await LocalImageCache.ensureDirectory();
      const files = await FileSystem.readDirectoryAsync(IMAGE_DIR);

      for (const file of files) {
        const eanMatch = file.match(/^(\d+)_/);
        if (eanMatch) {
          const ean = eanMatch[1];
          if (!knownEans.has(ean)) {
            try {
              await FileSystem.deleteAsync(`${IMAGE_DIR}${file}`);
              cleaned++;
            } catch {
              // Ignore individual file deletion errors
            }
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
    return cleaned;
  }
}
