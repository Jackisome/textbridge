import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'build', 'icons');
const assetsDir = path.join(__dirname, '..', 'assets', 'icons');

async function generateIcons() {
  const svgPath = path.join(assetsDir, 'option-d-flow.svg');

  // Generate PNG at 32x32 for tray icon
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(iconsDir, 'tray-icon.png'));

  // Generate PNG at 256x256 for app icon
  await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toFile(path.join(iconsDir, 'icon-256.png'));

  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
