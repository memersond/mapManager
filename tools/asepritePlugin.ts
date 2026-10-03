import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Plugin } from 'vite';

const ASSETS_DIR = 'assets';
const OUTPUT_DIR = 'public/generated';
const ATLAS_NAME = 'atlas';
const ASEPRITE_EXTENSIONS = ['.ase', '.aseprite'];

const STEAM_ASEPRITE_PATHS = [
  path.join(homedir(), '.local/share/Steam/steamapps/common/Aseprite/aseprite'),
  path.join(homedir(), '.steam/steam/steamapps/common/Aseprite/aseprite'),
  path.join(homedir(), 'Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite'),
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe',
  'C:\\Program Files\\Aseprite\\Aseprite.exe',
];

// Packs every .ase/.aseprite file under assets/ into one atlas so all sprites batch on a single texture.
export function asepritePlugin(): Plugin {
  let root = process.cwd();

  const isAsepriteFile = (file: string) => ASEPRITE_EXTENSIONS.includes(path.extname(file).toLowerCase());

  return {
    name: 'aseprite-atlas',
    // Runs before the dev server indexes public/, which would otherwise miss a freshly generated atlas.
    configResolved(config) {
      root = config.root;
      exportAtlas(root);
    },
    configureServer(server) {
      const assetsDir = path.join(root, ASSETS_DIR);
      server.watcher.add(assetsDir);
      const onChange = (file: string) => {
        if (!file.startsWith(assetsDir) || !isAsepriteFile(file)) return;
        try {
          exportAtlas(root);
          server.ws.send({ type: 'full-reload' });
        } catch (error) {
          server.config.logger.error(String(error));
        }
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };

  function exportAtlas(projectRoot: string) {
    const files = findFiles(path.join(projectRoot, ASSETS_DIR)).filter(isAsepriteFile);
    assertUniqueNames(files);

    const outputDir = path.join(projectRoot, OUTPUT_DIR);
    mkdirSync(outputDir, { recursive: true });

    // Frames are named "<file name>/<frame index>", which the game uses to look up sprites and build animations.
    execFileSync(
      findAseprite(),
      [
        '--batch',
        ...files,
        '--sheet', path.join(outputDir, `${ATLAS_NAME}.png`),
        '--data', path.join(outputDir, `${ATLAS_NAME}.json`),
        '--format', 'json-hash',
        '--sheet-pack',
        '--filename-format', '{title}/{frame}',
        '--shape-padding', '1',
        '--border-padding', '1',
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
  }
}

function findFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? findFiles(fullPath) : [fullPath];
  });
}

function assertUniqueNames(files: string[]) {
  const seen = new Map<string, string>();
  for (const file of files) {
    const name = path.parse(file).name;
    const existing = seen.get(name);
    if (existing) throw new Error(`Duplicate sprite name "${name}": ${existing} and ${file}`);
    seen.set(name, file);
  }
}

function findAseprite(): string {
  if (process.env.ASEPRITE) return process.env.ASEPRITE;
  const found = STEAM_ASEPRITE_PATHS.find((candidate) => existsSync(candidate));
  return found ?? 'aseprite';
}
