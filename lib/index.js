import { expandHomePath } from "@deepseek-ai/dsh-home-paths";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import { createHash } from "node:crypto";
import { open, readFile, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { constants } from "node:fs";
import sharp from "sharp";
//#region src/codex-asar.ts
/** Minimal, bounds-checked ASAR reader for Codex's bundled pet atlases. */
/** Conventional Codex Desktop ASAR location on macOS. */
const DEFAULT_CODEX_APP_ASAR_PATH = "/Applications/ChatGPT.app/Contents/Resources/app.asar";
/** Maximum ASAR JSON index accepted by this focused reader. */
const MAX_ASAR_HEADER_BYTES = 33554432;
const ASAR_READ_FLAGS = constants.O_RDONLY | constants.O_NONBLOCK;
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function fileRevision(details) {
	return [
		details.dev,
		details.ino,
		details.size,
		details.mtimeNs,
		details.ctimeNs
	].join(":");
}
function safeArchiveSize(details) {
	/* v8 ignore next -- supported filesystems cannot create a regular file beyond JavaScript's safe offset range in a test. */
	if (details.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ASAR archive size exceeds the safe integer range");
	return Number(details.size);
}
async function readExactly(file, position, length) {
	const buffer = Buffer.alloc(length);
	let read = 0;
	while (read < length) {
		const result = await file.read(buffer, read, length - read, position + read);
		/* v8 ignore next -- requires the archive to shrink between its validated stat and this positional read. */
		if (result.bytesRead === 0) throw new Error("ASAR ended before the declared range");
		read += result.bytesRead;
	}
	return buffer;
}
function parseNonnegativeInteger(value, label) {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`ASAR ${label} must be a non-negative safe integer`);
	return value;
}
function parseOffset(value) {
	if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("ASAR packed file offset must be a decimal string");
	const offset = Number(value);
	if (!Number.isSafeInteger(offset)) throw new Error("ASAR packed file offset exceeds the safe integer range");
	return offset;
}
function integrityHash(value) {
	if (!isRecord$1(value) || value.algorithm !== "SHA256" || typeof value.hash !== "string" || !/^[a-f\d]{64}$/i.test(value.hash)) return void 0;
	return value.hash.toLowerCase();
}
function collectEntries(files, prefix, contentOffset, archiveSize, entries) {
	for (const [name, rawNode] of Object.entries(files)) {
		if (!isRecord$1(rawNode)) throw new Error(`ASAR member "${name}" has an invalid record`);
		const node = rawNode;
		const memberPath = prefix === "" ? name : `${prefix}/${name}`;
		if (node.files !== void 0) {
			if (!isRecord$1(node.files)) throw new Error(`ASAR directory "${memberPath}" has an invalid files map`);
			collectEntries(node.files, memberPath, contentOffset, archiveSize, entries);
			continue;
		}
		if (node.unpacked === true) continue;
		const size = parseNonnegativeInteger(node.size, `member "${memberPath}" size`);
		const absoluteOffset = contentOffset + parseOffset(node.offset);
		const end = absoluteOffset + size;
		if (!Number.isSafeInteger(absoluteOffset) || !Number.isSafeInteger(end) || absoluteOffset < contentOffset || end > archiveSize) throw new Error(`ASAR member "${memberPath}" escapes the archive`);
		const hash = integrityHash(node.integrity);
		entries.set(memberPath, {
			path: memberPath,
			size,
			offset: absoluteOffset,
			...hash === void 0 ? {} : { integrityHash: hash }
		});
	}
}
/**
* Parse and validate an ASAR index without reading packed file bodies.
* @param archivePath - local `app.asar` path.
* @returns validated index of packed members.
*/
async function readAsarIndex(archivePath) {
	const file = await open(archivePath, ASAR_READ_FLAGS);
	try {
		const details = await file.stat({ bigint: true });
		if (!details.isFile() || details.size < 16n) throw new Error("ASAR is not a regular archive file");
		const archiveSize = safeArchiveSize(details);
		const archiveRevision = fileRevision(details);
		const prefix = await readExactly(file, 0, 16);
		const sizePicklePayload = prefix.readUInt32LE(0);
		const headerSize = prefix.readUInt32LE(4);
		const headerPicklePayload = prefix.readUInt32LE(8);
		const jsonSize = prefix.readUInt32LE(12);
		const expectedHeaderPicklePayload = Math.ceil((jsonSize + 4) / 4) * 4;
		if (sizePicklePayload !== 4 || headerSize !== headerPicklePayload + 4 || headerPicklePayload !== expectedHeaderPicklePayload) throw new Error("ASAR header pickle lengths are inconsistent");
		if (jsonSize === 0 || jsonSize > 33554432) throw new Error(`ASAR JSON header must be between 1 and ${String(MAX_ASAR_HEADER_BYTES)} bytes`);
		const contentOffset = 8 + headerSize;
		if (!Number.isSafeInteger(contentOffset) || contentOffset > archiveSize) throw new Error("ASAR header extends beyond the archive");
		const encoded = await readExactly(file, 16, jsonSize);
		let root;
		try {
			root = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(encoded));
		} catch (error) {
			throw new Error("ASAR JSON header is invalid", { cause: error });
		}
		if (!isRecord$1(root) || !isRecord$1(root.files)) throw new Error("ASAR JSON header has no files map");
		const entries = /* @__PURE__ */ new Map();
		collectEntries(root.files, "", contentOffset, archiveSize, entries);
		if (fileRevision(await file.stat({ bigint: true })) !== archiveRevision) throw new Error("ASAR archive changed while its index was being read");
		return {
			archivePath,
			archiveSize,
			archiveRevision,
			contentOffset,
			entries
		};
	} finally {
		await file.close();
	}
}
/**
* Read one indexed ASAR member from a revision-stable archive and verify any
* packager-provided SHA-256 integrity value.
* @param index - validated index returned by {@link readAsarIndex}.
* @param entry - member from that index.
* @returns exact member bytes.
*/
async function readAsarEntry(index, entry) {
	if (index.entries.get(entry.path) !== entry) throw new Error("ASAR entry does not belong to this index");
	const file = await open(index.archivePath, ASAR_READ_FLAGS);
	try {
		const before = await file.stat({ bigint: true });
		if (!before.isFile()) throw new Error("ASAR is not a regular archive file");
		const beforeSize = safeArchiveSize(before);
		if (entry.offset + entry.size > beforeSize) throw new Error("ASAR member range is no longer available");
		if (fileRevision(before) !== index.archiveRevision) throw new Error("ASAR archive changed since its index was read");
		const body = await readExactly(file, entry.offset, entry.size);
		if (fileRevision(await file.stat({ bigint: true })) !== index.archiveRevision) throw new Error("ASAR archive changed while its member was being read");
		if (entry.integrityHash !== void 0 && createHash("sha256").update(body).digest("hex") !== entry.integrityHash) throw new Error("ASAR member does not match its SHA-256 integrity value");
		return body;
	} finally {
		await file.close();
	}
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
* Locate hashed Codex spritesheet members for stable built-in ids.
* Missing and malformed archives reject; callers decide whether their path
* was an explicit referent or an optional automatic candidate.
* @param ids - built-in ids whose hashed filenames should be located.
* @param appAsarPath - configured archive path, or the conventional macOS path.
* @returns discovered Host-only asset references keyed by id.
*/
async function discoverCodexBuiltinAssets(ids, appAsarPath = DEFAULT_CODEX_APP_ASAR_PATH) {
	const index = await readAsarIndex(appAsarPath);
	const entries = [...index.entries.entries()].sort(([left], [right]) => left.localeCompare(right));
	const assets = /* @__PURE__ */ new Map();
	for (const id of ids) {
		const pattern = new RegExp(`(?:^|/)${escapeRegExp(id)}-spritesheet(?:-[^/]+)*\\.webp$`, "i");
		const match = entries.find(([path]) => pattern.test(path));
		if (match === void 0) continue;
		assets.set(id, {
			id,
			index,
			entry: match[1]
		});
	}
	return assets;
}
/**
* Build the conventional Windows archive path when LocalAppData is known.
* @param localAppData - Windows LocalAppData directory.
* @returns candidate ChatGPT ASAR path.
*/
function windowsCodexAppAsarPath(localAppData) {
	return join(localAppData, "Programs", "ChatGPT", "resources", "app.asar");
}
//#endregion
//#region src/codex-format.ts
/** Codex-compatible local pet manifest and spritesheet reader. */
/** Largest Codex pet manifest accepted by the importer. */
const MAX_PET_MANIFEST_BYTES = 65536;
/** Largest atlas accepted from a local Codex pet package. */
const MAX_PET_ASSET_BYTES = 20971520;
const EXPECTED_DIMENSIONS = {
	1: [1536, 1872],
	2: [1536, 2288]
};
function hasPngAnimationControl(buffer) {
	let offset = 8;
	while (offset + 12 <= buffer.length) {
		const dataLength = buffer.readUInt32BE(offset);
		const typeStart = offset + 4;
		const nextOffset = typeStart + 4 + dataLength + 4;
		/* v8 ignore next -- Sharp metadata succeeds only after libpng has rejected truncated chunk ranges. */
		if (nextOffset > buffer.length) return false;
		const type = buffer.toString("ascii", typeStart, typeStart + 4);
		if (type === "acTL") return true;
		if (type === "IEND") return false;
		offset = nextOffset;
	}
	return false;
}
const BOUNDED_READ_FLAGS = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalTrimmedString(value, field) {
	if (value === void 0) return void 0;
	if (typeof value !== "string" || value.trim() === "") throw new Error(`pet.json field "${field}" must be a non-empty string`);
	return value.trim();
}
function containsPath(parent, candidate) {
	const pathFromParent = relative(parent, candidate);
	return pathFromParent === "" || pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent);
}
/**
* Normalize the exact fields consumed by Codex from decoded `pet.json` data.
* Unknown keys are ignored, matching Codex's object parser.
* @param value - decoded JSON value.
* @returns normalized manifest with Codex defaults applied.
*/
function parseCodexPetManifest(value) {
	if (!isRecord(value)) throw new Error("pet.json must contain an object");
	const id = optionalTrimmedString(value.id, "id");
	const displayName = optionalTrimmedString(value.displayName, "displayName");
	let description;
	if (value.description === void 0 || value.description === null) description = null;
	else if (typeof value.description === "string") description = value.description.trim() || null;
	else throw new Error("pet.json field \"description\" must be a string or null");
	const version = value.spriteVersionNumber === void 0 ? 1 : value.spriteVersionNumber;
	if (version !== 1 && version !== 2) throw new Error("pet.json field \"spriteVersionNumber\" must be 1 or 2");
	const spritesheetPath = optionalTrimmedString(value.spritesheetPath, "spritesheetPath") ?? "spritesheet.webp";
	return {
		...id === void 0 ? {} : { id },
		...displayName === void 0 ? {} : { displayName },
		description,
		spriteVersionNumber: version,
		spritesheetPath
	};
}
/**
* Validate complete atlas bytes against a Codex sprite version.
* @param buffer - complete PNG or WebP bytes.
* @param version - manifest atlas version.
* @returns MIME type after a complete raster decode.
*/
async function validatePetImage(buffer, version) {
	if (buffer.length > 20971520) throw new Error(`pet atlas exceeds ${String(MAX_PET_ASSET_BYTES)} bytes`);
	const [width, height] = EXPECTED_DIMENSIONS[version];
	const image = sharp(buffer, {
		failOn: "error",
		limitInputPixels: width * height
	});
	let metadata;
	try {
		metadata = await image.metadata();
	} catch (cause) {
		throw new Error("pet atlas must be a complete PNG or WebP image", { cause });
	}
	const contentType = metadata.format === "png" ? "image/png" : metadata.format === "webp" ? "image/webp" : void 0;
	if (contentType === void 0) throw new Error("pet atlas must be a complete PNG or WebP image");
	if ((metadata.pages ?? 1) !== 1 || contentType === "image/png" && hasPngAnimationControl(buffer)) throw new Error("pet atlas must be a static PNG or WebP image");
	if (metadata.width !== width || metadata.height !== height) throw new Error(`pet atlas version ${String(version)} must be ${String(width)}x${String(height)}`);
	try {
		await image.raw().toBuffer();
	} catch (cause) {
		throw new Error("pet atlas must be a complete PNG or WebP image", { cause });
	}
	return contentType;
}
async function readBoundedRegularFile(path, maxBytes, label) {
	const file = await open(path, BOUNDED_READ_FLAGS);
	try {
		const details = await file.stat();
		if (!details.isFile()) throw new Error(`${label} is not a regular file`);
		if (details.size > maxBytes) throw new Error(`${label} exceeds ${String(maxBytes)} bytes`);
		const buffer = Buffer.allocUnsafe(details.size + 1);
		let total = 0;
		while (total < buffer.length) {
			const { bytesRead } = await file.read(buffer, total, buffer.length - total, null);
			if (bytesRead === 0) break;
			total += bytesRead;
		}
		if (total !== details.size) throw new Error(`${label} changed while being read`);
		return buffer.subarray(0, total);
	} finally {
		await file.close();
	}
}
async function readOnePet(petsRoot, directoryName, manifestName) {
	const lexicalDirectory = join(petsRoot, directoryName);
	const directoryPath = await realpath(lexicalDirectory);
	/* v8 ignore next -- readdir admitted a real directory under petsRoot; only a concurrent rename can escape it here. */
	if (!containsPath(petsRoot, directoryPath)) throw new Error("pet directory escapes the pets root");
	const manifestPath = await realpath(join(directoryPath, manifestName));
	if (!containsPath(directoryPath, manifestPath)) throw new Error(`${manifestName} escapes its pet directory`);
	const manifestBody = await readBoundedRegularFile(manifestPath, MAX_PET_MANIFEST_BYTES, "pet manifest");
	const manifest = parseCodexPetManifest(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBody)));
	const lexicalAssetPath = resolve(directoryPath, manifest.spritesheetPath);
	if (!containsPath(directoryPath, lexicalAssetPath)) throw new Error("pet atlas path escapes its pet directory");
	const resolvedAssetPath = await realpath(lexicalAssetPath);
	if (!containsPath(directoryPath, resolvedAssetPath)) throw new Error("pet atlas resolves outside its pet directory");
	const body = await readBoundedRegularFile(resolvedAssetPath, MAX_PET_ASSET_BYTES, "pet atlas");
	const contentType = await validatePetImage(body, manifest.spriteVersionNumber);
	const sha256 = createHash("sha256").update(body).digest("hex");
	return {
		id: `custom:${directoryName}`,
		displayName: manifest.displayName ?? manifest.id ?? directoryName,
		description: manifest.description,
		spriteVersionNumber: manifest.spriteVersionNumber,
		contentType,
		sha256,
		size: body.length,
		assetPath: resolvedAssetPath,
		directoryPath,
		petsRoot
	};
}
/**
* Scan valid Codex packages under `<codexHome>/pets`.
* Invalid entries are omitted independently so one broken pet cannot hide the
* rest of the catalog.
* @param codexHome - resolved or lexical Codex home directory.
* @returns valid custom pets sorted by directory-derived id.
*/
async function scanCodexPetRoot(codexHome, rootName, manifestName) {
	let petsRoot;
	try {
		petsRoot = await realpath(join(codexHome, rootName));
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
	const entries = await readdir(petsRoot, { withFileTypes: true });
	const pets = [];
	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		if (!entry.isDirectory()) continue;
		try {
			pets.push(await readOnePet(petsRoot, entry.name, manifestName));
		} catch {}
	}
	return pets;
}
/**
* Scan modern `<codexHome>/pets` packages and legacy
* `<codexHome>/avatars` packages. A modern directory overrides a legacy
* directory with the same runtime id, matching Codex.
* @param codexHome - resolved or lexical Codex home directory.
* @returns valid custom pets sorted by directory-derived id.
*/
async function scanCodexPets(codexHome) {
	const [avatars, pets] = await Promise.all([scanCodexPetRoot(codexHome, "avatars", "avatar.json"), scanCodexPetRoot(codexHome, "pets", "pet.json")]);
	const byId = new Map(avatars.map((pet) => [pet.id, pet]));
	for (const pet of pets) byId.set(pet.id, pet);
	return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}
/**
* Re-read a cataloged custom atlas with containment, size, and format checks.
* @param pet - record returned by {@link scanCodexPets}.
* @returns current validated bytes and content hash.
*/
async function readCodexPetAsset(pet) {
	const currentDirectory = await realpath(pet.directoryPath);
	if (!containsPath(pet.petsRoot, currentDirectory)) throw new Error("pet directory escapes the pets root");
	const currentAsset = await realpath(pet.assetPath);
	if (!containsPath(currentDirectory, currentAsset)) throw new Error("pet atlas resolves outside its pet directory");
	const body = await readBoundedRegularFile(currentAsset, MAX_PET_ASSET_BYTES, "pet atlas");
	const sha256 = createHash("sha256").update(body).digest("hex");
	if (sha256 !== pet.sha256) throw new Error("pet atlas changed since the catalog refresh");
	return {
		body,
		contentType: pet.contentType,
		sha256
	};
}
//#endregion
//#region src/pet-endpoints.ts
/** Client-safe HTTP paths shared by the pet Host and browser halves. */
/** Prefix claimed by the Host pet HTTP adapter. */
const PET_HTTP_PREFIX = "/dsh-pet";
/** Read the current built-in and Codex-home catalog. */
const PET_CATALOG_ENDPOINT = `${PET_HTTP_PREFIX}/catalog`;
/** Rescan the Codex-home catalog and return the new snapshot. */
const PET_REFRESH_ENDPOINT = `${PET_HTTP_PREFIX}/refresh`;
/** Prefix for opaque, catalog-addressed pet atlas responses. */
const PET_ASSET_PREFIX = `${PET_HTTP_PREFIX}/assets`;
/**
* Build the browser URL for one opaque pet id.
* @param id - built-in id or `custom:<directory>` id.
* @returns same-origin atlas path with the id encoded as one segment.
*/
function petAssetPath(id) {
	return `${PET_ASSET_PREFIX}/${encodeURIComponent(id)}`;
}
/**
* Add a catalog generation to an atlas URL so a successful refresh also
* refreshes a changed image whose opaque pet id stayed the same.
* @param path - catalog-provided same-origin atlas path.
* @param revision - catalog generation that validated the atlas.
* @returns cache-busting URL tied to that generation.
*/
function petAssetUrl(path, revision) {
	return `${path}${path.includes("?") ? "&" : "?"}revision=${String(revision)}`;
}
//#endregion
//#region src/pet-contract.ts
/** DSH pet metadata and Codex-compatible atlas layout contracts. */
/** Codex version 1 atlas dimensions and populated-cell counts. */
const CODEX_PET_ATLAS_V1 = Object.freeze({
	version: 1,
	width: 1536,
	height: 1872,
	cellWidth: 192,
	cellHeight: 208,
	columns: 8,
	rows: 9,
	requiredFramesByRow: Object.freeze([
		6,
		8,
		8,
		4,
		5,
		8,
		6,
		6,
		6
	])
});
/** Codex version 2 atlas dimensions and populated-cell counts. */
const CODEX_PET_ATLAS_V2 = Object.freeze({
	version: 2,
	width: 1536,
	height: 2288,
	cellWidth: 192,
	cellHeight: 208,
	columns: 8,
	rows: 11,
	requiredFramesByRow: Object.freeze([
		6,
		8,
		8,
		4,
		5,
		8,
		6,
		6,
		6,
		8,
		8
	])
});
/** Atlas lookup keyed by a normalized Codex sprite version. */
const CODEX_PET_ATLASES = Object.freeze({
	1: CODEX_PET_ATLAS_V1,
	2: CODEX_PET_ATLAS_V2
});
/** DSH's bundled default pet, available without a Codex Desktop installation. */
const DSH_BUILTIN_PET = Object.freeze({
	id: "dsh",
	kind: "builtin",
	displayName: "小深",
	description: "A friendly DeepSeek-blue whale companion for DSH.",
	spriteVersionNumber: 2,
	assetPath: petAssetPath("dsh")
});
/** DSH's bundled portrait pet, selectable without changing the default. */
const ALIANG_BUILTIN_PET = Object.freeze({
	id: "aliang",
	kind: "builtin",
	displayName: "阿良",
	description: "The original DSH companion.",
	spriteVersionNumber: 2,
	assetPath: petAssetPath("aliang")
});
/** The nine pet identities shipped by Codex, without their binary atlases. */
const CODEX_BUILTIN_PETS = Object.freeze([
	{
		id: "codex",
		kind: "builtin",
		displayName: "Codex",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("codex")
	},
	{
		id: "dewey",
		kind: "builtin",
		displayName: "Dewey",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("dewey")
	},
	{
		id: "fireball",
		kind: "builtin",
		displayName: "Fireball",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("fireball")
	},
	{
		id: "hoots",
		kind: "builtin",
		displayName: "Hoots",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("hoots")
	},
	{
		id: "rocky",
		kind: "builtin",
		displayName: "Rocky",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("rocky")
	},
	{
		id: "seedy",
		kind: "builtin",
		displayName: "Seedy",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("seedy")
	},
	{
		id: "stacky",
		kind: "builtin",
		displayName: "Stacky",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("stacky")
	},
	{
		id: "bsod",
		kind: "builtin",
		displayName: "BSOD",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("bsod")
	},
	{
		id: "null-signal",
		kind: "builtin",
		displayName: "Null Signal",
		description: "Built-in Codex pet.",
		spriteVersionNumber: 2,
		assetPath: petAssetPath("null-signal")
	}
]);
/** Built-in picker order: DSH's default, its optional portrait, then Codex presets. */
const PET_PRESETS = Object.freeze([
	DSH_BUILTIN_PET,
	ALIANG_BUILTIN_PET,
	...CODEX_BUILTIN_PETS
]);
//#endregion
//#region src/pet-catalog.ts
/** Host catalog combining the package-owned DSH default with Codex-compatible imports. */
const BUNDLED_PET_SOURCES = Object.freeze([{
	metadata: DSH_BUILTIN_PET,
	source: new URL("../assets/dsh/spritesheet.webp", import.meta.url)
}, {
	metadata: ALIANG_BUILTIN_PET,
	source: new URL("../assets/aliang/spritesheet.webp", import.meta.url)
}]);
let bundledPetAssetsPromise;
/**
* Read and validate one package-owned atlas.
* @param source - package asset URL resolved relative to the active runtime bundle.
* @param spriteVersionNumber - atlas layout expected for the bundled pet.
* @returns immutable-generation bytes, media type, and strong digest.
*/
async function readBundledPetAsset(source, spriteVersionNumber) {
	const body = await readFile(source);
	if (body.byteLength > 20971520) throw new Error("bundled pet atlas exceeds the size limit");
	const contentType = await validatePetImage(body, spriteVersionNumber);
	if (contentType !== "image/webp") throw new Error("bundled pet atlas must be WebP");
	return {
		body,
		contentType,
		sha256: createHash("sha256").update(body).digest("hex")
	};
}
function loadBundledPetAssets() {
	bundledPetAssetsPromise ??= Promise.all(BUNDLED_PET_SOURCES.map(async ({ metadata, source }) => [metadata.id, await readBundledPetAsset(source, metadata.spriteVersionNumber)])).then((entries) => new Map(entries));
	return bundledPetAssetsPromise;
}
function freezeSnapshot(pets, revision) {
	return Object.freeze({
		pets: Object.freeze(pets.map((pet) => Object.freeze(pet))),
		revision
	});
}
/**
* Resolve the Codex home with Codex Desktop's environment precedence.
* @param configured - explicit catalog override.
* @param env - environment mapping carrying `CODEX_HOME`.
* @returns absolute Codex home path.
*/
function resolveCodexHome(configured, env = process.env) {
	const configuredPath = configured?.trim();
	const environmentPath = env.CODEX_HOME?.trim();
	const selected = configuredPath || environmentPath || join(homedir(), ".codex");
	return resolve(expandHomePath(selected));
}
function defaultAsarPath(platform, env) {
	if (platform === "darwin") return DEFAULT_CODEX_APP_ASAR_PATH;
	if (platform === "win32" && env.LOCALAPPDATA !== void 0 && env.LOCALAPPDATA !== "") return windowsCodexAppAsarPath(env.LOCALAPPDATA);
}
async function discoverBuiltins(explicitPath, platform, env) {
	const configuredPath = explicitPath?.trim();
	const path = configuredPath === void 0 || configuredPath === "" ? defaultAsarPath(platform, env) : resolve(expandHomePath(configuredPath));
	if (path === void 0) return /* @__PURE__ */ new Map();
	try {
		return await discoverCodexBuiltinAssets(CODEX_BUILTIN_PETS.map((pet) => pet.id), path);
	} catch (error) {
		if (configuredPath !== void 0 && configuredPath !== "") throw error;
		return /* @__PURE__ */ new Map();
	}
}
async function validatedBuiltins(discovered) {
	const valid = /* @__PURE__ */ new Map();
	for (const metadata of CODEX_BUILTIN_PETS) {
		const asset = discovered.get(metadata.id);
		if (asset === void 0 || asset.entry.size > 20971520) continue;
		try {
			const body = await readAsarEntry(asset.index, asset.entry);
			const contentType = await validatePetImage(body, metadata.spriteVersionNumber);
			valid.set(metadata.id, {
				body,
				contentType,
				sha256: createHash("sha256").update(body).digest("hex")
			});
		} catch {}
	}
	return valid;
}
/** Mutable Host catalog with atomic scan generations. */
var PetCatalog = class {
	options;
	generation = {
		snapshot: freezeSnapshot([], 0),
		customAssets: /* @__PURE__ */ new Map(),
		builtinAssets: /* @__PURE__ */ new Map()
	};
	refreshTail = Promise.resolve();
	/**
	* Construct an uninitialized catalog; callers normally use {@link createPetCatalog}.
	* @param options - local discovery overrides.
	*/
	constructor(options = {}) {
		this.options = options;
	}
	/**
	* Return the current immutable catalog generation.
	* @returns built-ins first, then custom pets, plus a monotonic revision.
	*/
	list() {
		return this.generation.snapshot;
	}
	/**
	* Atomically rescan custom packages and dynamically discover Codex built-ins.
	* @returns newly published catalog generation.
	*/
	refresh() {
		const result = this.refreshTail.then(() => this.scanAndPublish());
		this.refreshTail = result.then(() => {}, () => {});
		return result;
	}
	async scanAndPublish() {
		const env = this.options.env ?? process.env;
		const codexHome = resolveCodexHome(this.options.codexHome, env);
		if (this.options.codexHome?.trim()) {
			if (!(await stat(codexHome)).isDirectory()) throw new Error("configured Codex home is not a directory");
		}
		const [bundledPetAssets, customPets, discoveredBuiltins] = await Promise.all([
			loadBundledPetAssets(),
			scanCodexPets(codexHome),
			discoverBuiltins(this.options.appAsarPath, this.options.platform ?? process.platform, env)
		]);
		const codexBuiltinAssets = await validatedBuiltins(discoveredBuiltins);
		const builtinAssets = new Map([...bundledPetAssets, ...codexBuiltinAssets]);
		const customAssets = new Map(customPets.map((pet) => [pet.id, pet]));
		const next = {
			snapshot: freezeSnapshot([...PET_PRESETS.map((metadata) => ({
				...metadata,
				available: builtinAssets.has(metadata.id)
			})), ...customPets.map((pet) => ({
				id: pet.id,
				kind: "custom",
				displayName: pet.displayName,
				description: pet.description,
				spriteVersionNumber: pet.spriteVersionNumber,
				available: true,
				assetPath: petAssetPath(pet.id)
			}))], this.generation.snapshot.revision + 1),
			customAssets,
			builtinAssets
		};
		this.generation = next;
		return next.snapshot;
	}
	/**
	* Read a current atlas by opaque id; no filesystem path crosses this API.
	* Built-in bytes stay fixed for one validated generation; a custom file
	* removed or replaced after the last refresh rejects validation.
	* @param id - built-in id or `custom:<directory>` id.
	* @returns validated bytes, or undefined when the id is unavailable.
	*/
	async getAsset(id) {
		const custom = this.generation.customAssets.get(id);
		if (custom !== void 0) return await readCodexPetAsset(custom);
		return this.generation.builtinAssets.get(id);
	}
};
/**
* Construct and perform the first atomic catalog scan.
* @param options - local discovery overrides.
* @returns initialized catalog whose first snapshot has revision 1.
*/
async function createPetCatalog(options = {}) {
	const catalog = new PetCatalog(options);
	await catalog.refresh();
	return catalog;
}
//#endregion
//#region src/pet-http.ts
function sendJson(response, status, value, headers = {}, head = false) {
	const body = Buffer.from(JSON.stringify(value));
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": String(body.length),
		"cache-control": "no-store",
		"cross-origin-resource-policy": "same-origin",
		...headers
	});
	response.end(head ? void 0 : body);
}
function methodNotAllowed(response, allow, head) {
	sendJson(response, 405, { error: "method_not_allowed" }, { allow }, head);
}
function etagMatches(header, etag) {
	if (header === void 0) return false;
	const values = Array.isArray(header) ? header : [header];
	const bareEtag = etag.replace(/^W\//, "");
	return values.some((value) => value.split(",").some((candidate) => {
		const trimmed = candidate.trim();
		return trimmed === "*" || trimmed.replace(/^W\//, "") === bareEtag;
	}));
}
async function serveAsset(catalog, id, request, response) {
	let asset;
	try {
		asset = await catalog.getAsset(id);
	} catch {
		sendJson(response, 404, { error: "asset_unavailable" }, {}, request.method === "HEAD");
		return;
	}
	if (asset === void 0) {
		sendJson(response, 404, { error: "asset_not_found" }, {}, request.method === "HEAD");
		return;
	}
	const etag = `"${asset.sha256}"`;
	const headers = {
		"content-type": asset.contentType,
		"content-length": String(asset.body.length),
		"cache-control": "private, max-age=0, must-revalidate",
		"cross-origin-resource-policy": "same-origin",
		etag,
		"x-content-type-options": "nosniff"
	};
	if (etagMatches(request.headers["if-none-match"], etag)) {
		response.writeHead(304, {
			"cache-control": headers["cache-control"],
			"cross-origin-resource-policy": headers["cross-origin-resource-policy"],
			etag,
			"x-content-type-options": headers["x-content-type-options"]
		});
		response.end();
		return;
	}
	response.writeHead(200, headers);
	response.end(request.method === "HEAD" ? void 0 : asset.body);
}
/**
* Create the full pet HTTP dispatcher. Paths select only opaque catalog ids;
* request path text is never interpreted as a filesystem or ASAR member path.
* @param catalog - initialized mutable Host catalog.
* @param isTrustedRequest - Connection trust fence pinned to loopback authority.
* @returns async route handler for exact and asset-prefix requests.
*/
function createPetHttpHandler(catalog, isTrustedRequest) {
	return async (request, response) => {
		if (!isTrustedRequest(request)) {
			sendJson(response, 403, { error: "forbidden" }, {}, request.method === "HEAD");
			return;
		}
		let pathname;
		try {
			/* v8 ignore next -- node:http always supplies url for server requests. */
			pathname = new URL(request.url ?? "/", "http://localhost").pathname;
		} catch {
			sendJson(response, 400, { error: "invalid_url" }, {}, request.method === "HEAD");
			return;
		}
		if (pathname === PET_CATALOG_ENDPOINT) {
			if (request.method !== "GET") {
				methodNotAllowed(response, "GET", request.method === "HEAD");
				return;
			}
			sendJson(response, 200, catalog.list());
			return;
		}
		if (pathname === PET_REFRESH_ENDPOINT) {
			if (request.method !== "POST") {
				methodNotAllowed(response, "POST", request.method === "HEAD");
				return;
			}
			try {
				sendJson(response, 200, await catalog.refresh());
			} catch {
				sendJson(response, 500, { error: "refresh_failed" });
			}
			return;
		}
		const assetPrefix = `${PET_ASSET_PREFIX}/`;
		if (pathname.startsWith(assetPrefix)) {
			if (request.method !== "GET" && request.method !== "HEAD") {
				methodNotAllowed(response, "GET, HEAD", false);
				return;
			}
			const encodedId = pathname.slice(assetPrefix.length);
			if (encodedId === "" || encodedId.includes("/")) {
				sendJson(response, 404, { error: "asset_not_found" }, {}, request.method === "HEAD");
				return;
			}
			let id;
			try {
				id = decodeURIComponent(encodedId);
			} catch {
				sendJson(response, 400, { error: "invalid_asset_id" }, {}, request.method === "HEAD");
				return;
			}
			await serveAsset(catalog, id, request, response);
			return;
		}
		sendJson(response, 404, { error: "not_found" }, {}, request.method === "HEAD");
	};
}
//#endregion
//#region src/pet-settings.ts
/** Durable preferences for the DSH Web pet surface. */
/** Settings namespace owned by the pet plugin. */
const PET_SETTINGS_NAMESPACE = "dsh-pet";
/** Codex's default mascot width in CSS pixels. */
const DEFAULT_PET_SIZE = 112;
/** Smallest mascot width accepted by Codex and this renderer. */
const MIN_PET_SIZE = 80;
/** Largest mascot width accepted by Codex and this renderer. */
const MAX_PET_SIZE = 224;
/** Defaults used before the user settings document carries overrides. */
const DEFAULT_PET_SETTINGS = Object.freeze({
	enabled: true,
	selectedId: "dsh",
	size: 112
});
//#endregion
//#region src/pet-settings-schema.ts
/** Host-only schema for durable pet preferences. */
/** Durable pet settings schema. */
const PetSettingsSchema = z.object({
	enabled: z.boolean().default(DEFAULT_PET_SETTINGS.enabled),
	selectedId: z.string().min(1).max(512).default(DEFAULT_PET_SETTINGS.selectedId),
	size: z.natural().min(80).max(224).default(DEFAULT_PET_SETTINGS.size)
});
//#endregion
//#region src/index.ts
/** Stable Cordis plugin name. */
const name = "dsh-pet";
/** Host plugin configuration schema. */
const Config = z.object({
	codexHome: z.string(),
	appAsarPath: z.string()
});
/** Host services required to persist selection and serve local pet assets safely. */
const inject = [
	"connection",
	"settings",
	"webServer"
];
/**
* Register durable settings, discover the first catalog generation, and
* publish its loopback-trusted HTTP surface before activation completes.
* @param ctx - Host plugin context.
* @param config - optional local Codex path overrides.
* @returns activation completion after the first catalog generation is ready.
*/
async function apply(ctx, config = {}) {
	const host = ctx;
	host.settings.register(settingsNamespace(PET_SETTINGS_NAMESPACE), PetSettingsSchema);
	const codexHome = config.codexHome?.trim();
	const appAsarPath = config.appAsarPath?.trim();
	const catalog = await createPetCatalog({
		...codexHome === void 0 || codexHome === "" ? {} : { codexHome: expandHomePath(codexHome) },
		...appAsarPath === void 0 || appAsarPath === "" ? {} : { appAsarPath: expandHomePath(appAsarPath) }
	});
	const connection = host.connection;
	const handler = createPetHttpHandler(catalog, (request) => connection.isTrustedRequest(request, "loopback"));
	ctx.effect(() => {
		const pending = /* @__PURE__ */ new Set();
		const trackedHandler = (request, response) => {
			const tracked = handler(request, response).finally(() => {
				pending.delete(tracked);
			});
			pending.add(tracked);
			return tracked;
		};
		const unregister = host.webServer.register({
			kind: "prefix",
			path: PET_HTTP_PREFIX,
			handler: trackedHandler
		});
		return async () => {
			unregister();
			await Promise.allSettled(pending);
		};
	}, "dsh-pet: catalog and atlas routes");
}
//#endregion
export { ALIANG_BUILTIN_PET, CODEX_BUILTIN_PETS, CODEX_PET_ATLASES, CODEX_PET_ATLAS_V1, CODEX_PET_ATLAS_V2, Config, DEFAULT_PET_SETTINGS, DEFAULT_PET_SIZE, DSH_BUILTIN_PET, MAX_PET_SIZE, MIN_PET_SIZE, PET_ASSET_PREFIX, PET_CATALOG_ENDPOINT, PET_HTTP_PREFIX, PET_PRESETS, PET_REFRESH_ENDPOINT, PET_SETTINGS_NAMESPACE, apply, inject, name, petAssetPath, petAssetUrl };
