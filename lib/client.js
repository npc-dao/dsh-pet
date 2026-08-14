window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-pet",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
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
		//#region src/client/catalog-store.ts
		/** Browser catalog loader for the pet Host's same-origin HTTP surface. */
		/** Initial browser catalog state. */
		const INITIAL_PET_CATALOG_STATE = Object.freeze({
			status: "idle",
			revision: 0,
			pets: Object.freeze([]),
			error: null
		});
		/**
		* Resolve the selected available pet, falling back to the first available
		* entry while preserving the durable selected id in settings.
		* @param pets - current catalog rows.
		* @param selectedId - durable user preference.
		* @returns the effective row, or undefined when no atlas can be served.
		*/
		function resolveSelectedPet(pets, selectedId) {
			return pets.find((pet) => pet.id === selectedId && pet.available) ?? pets.find((pet) => pet.available);
		}
		/**
		* Single-flight catalog transport. A newer load aborts the previous request;
		* disposal aborts the live request and suppresses every later publication.
		*/
		var PetCatalogController = class {
			fetchCatalog;
			/** Observable catalog source bound once by the slot registration. */
			store;
			requestGeneration = 0;
			active;
			pending = /* @__PURE__ */ new Set();
			disposed = false;
			disposal;
			/**
			* @param fetchCatalog - same-origin fetch implementation.
			*/
			constructor(fetchCatalog = (input, init) => globalThis.fetch(input, init)) {
				this.fetchCatalog = fetchCatalog;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({ ...INITIAL_PET_CATALOG_STATE });
			}
			/**
			* Read the current Host snapshot without forcing a filesystem rescan.
			* @returns settlement after this generation publishes or becomes stale.
			*/
			load() {
				return this.request(PET_CATALOG_ENDPOINT, { method: "GET" });
			}
			/**
			* Ask the Host to rescan Codex pets, then adopt the returned snapshot.
			* @returns settlement after this generation publishes or becomes stale.
			*/
			refresh() {
				return this.request(PET_REFRESH_ENDPOINT, { method: "POST" });
			}
			/**
			* Abort current transport, reject future loads, and await all requests that
			* ignored their abort signal.
			* @returns settlement after catalog transport reaches quiescence.
			*/
			dispose() {
				if (this.disposal !== void 0) return this.disposal;
				this.disposed = true;
				this.requestGeneration += 1;
				this.active?.abort();
				this.active = void 0;
				this.disposal = Promise.all([...this.pending]).then(() => {});
				return this.disposal;
			}
			request(path, init) {
				if (this.disposed) return Promise.resolve();
				const pending = this.runRequest(path, init);
				this.pending.add(pending);
				pending.then(() => {
					this.pending.delete(pending);
				});
				return pending;
			}
			async runRequest(path, init) {
				const generation = ++this.requestGeneration;
				this.active?.abort();
				const active = new AbortController();
				this.active = active;
				this.store.update((draft) => {
					draft.status = "loading";
					draft.error = null;
				});
				try {
					const response = await this.fetchCatalog(path, {
						...init,
						signal: active.signal
					});
					if (!response.ok) throw new Error(`Pet catalog request failed (${response.status})`);
					const snapshot = decodeCatalog(await response.json());
					if (generation !== this.requestGeneration) return;
					this.store.set({
						status: "ready",
						revision: snapshot.revision,
						pets: snapshot.pets,
						error: null
					});
				} catch (error) {
					if (active.signal.aborted) return;
					this.store.update((draft) => {
						draft.status = "error";
						draft.error = error instanceof Error ? error.message : String(error);
					});
				} finally {
					if (this.active === active) this.active = void 0;
				}
			}
		};
		function isPetAssetPath(value) {
			if (typeof value !== "string") return false;
			const prefix = `${PET_ASSET_PREFIX}/`;
			if (!value.startsWith(prefix)) return false;
			const encodedId = value.slice(prefix.length);
			if (encodedId === "" || encodedId.includes("/")) return false;
			try {
				const id = decodeURIComponent(encodedId);
				return id !== "" && !id.includes("/") && encodeURIComponent(id) === encodedId;
			} catch {
				return false;
			}
		}
		function decodeCatalog(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("Pet catalog response must be an object");
			const record = value;
			if (!Number.isInteger(record.revision) || record.revision < 0) throw new TypeError("Pet catalog revision must be a non-negative integer");
			if (!Array.isArray(record.pets)) throw new TypeError("Pet catalog pets must be an array");
			const pets = record.pets.map(decodePet);
			return {
				revision: record.revision,
				pets: Object.freeze(pets)
			};
		}
		function decodePet(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("Pet catalog entry must be an object");
			const pet = value;
			const description = pet.description;
			if (typeof pet.id !== "string" || pet.id.length === 0 || typeof pet.displayName !== "string" || pet.displayName.length === 0 || !(description === null || typeof description === "string") || !(pet.spriteVersionNumber === 1 || pet.spriteVersionNumber === 2) || !(pet.kind === "builtin" || pet.kind === "custom") || typeof pet.available !== "boolean" || !isPetAssetPath(pet.assetPath)) throw new TypeError("Pet catalog entry is invalid");
			return Object.freeze({
				id: pet.id,
				displayName: pet.displayName,
				description,
				spriteVersionNumber: pet.spriteVersionNumber,
				kind: pet.kind,
				available: pet.available,
				assetPath: pet.assetPath
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			nav: "宠物",
			title: "窗口宠物",
			intro: "在 DSH Web 窗口里显示一个会随 Agent 状态变化的宠物。",
			enabled: "显示窗口宠物",
			size: "宠物大小",
			pixels: "{size} 像素",
			refresh: "刷新宠物",
			refreshing: "正在刷新…",
			loading: "正在加载宠物…",
			loadError: "无法加载宠物目录。",
			readOnly: "此远程浏览器只能查看宠物设置。",
			importPrefix: "将 Codex 宠物目录放入",
			importDefault: "默认",
			importSuffix: "，然后刷新。",
			presetGroup: "预设",
			customGroup: "自定义",
			noCustom: "没有找到可用的自定义宠物。",
			selected: "已选择",
			select: "选择",
			selectPet: "选择 {pet}",
			selectedPet: "已选择：{pet}",
			unavailable: "不可用",
			unavailablePet: "{pet} 不可用",
			noDescription: "暂无描述。"
		};
		/** English dictionary, complete against the Chinese key set. */
		const en = {
			nav: "Pets",
			title: "Window pet",
			intro: "Show a pet in the DSH Web window that reacts to the agent state.",
			enabled: "Show window pet",
			size: "Pet size",
			pixels: "{size} px",
			refresh: "Refresh pets",
			refreshing: "Refreshing…",
			loading: "Loading pets…",
			loadError: "Could not load the pet catalog.",
			readOnly: "This remote browser can only view pet settings.",
			importPrefix: "Put a Codex pet directory in",
			importDefault: "default",
			importSuffix: ", then refresh.",
			presetGroup: "Presets",
			customGroup: "Custom",
			noCustom: "No compatible custom pets found.",
			selected: "Selected",
			select: "Select",
			selectPet: "Select {pet}",
			selectedPet: "Selected: {pet}",
			unavailable: "Unavailable",
			unavailablePet: "{pet} is unavailable",
			noDescription: "No description."
		};
		/**
		* Replace one named locale placeholder.
		* @param template - localized string containing the placeholder.
		* @param name - placeholder name without braces.
		* @param value - replacement text.
		* @returns localized text with the placeholder replaced.
		*/
		function petLocaleValue(template, name, value) {
			return template.replace(`{${name}}`, value);
		}
		//#endregion
		//#region src/client/PetOverlayRoot.tsx
		/**
		* Render the session-maybe child seat at the frame-wide overlay position.
		* @param props - slot dispatcher authorized by this entry's child declaration.
		* @returns the current pet contribution, or null when no occupant is present.
		*/
		function PetOverlayRoot({ renderSlot }) {
			return renderSlot("shell.overlay.pet", {});
		}
		//#endregion
		//#region ../../../vendor/cosmokit/src/misc.ts
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		//#endregion
		//#region ../../../vendor/cosmokit/src/types.ts
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		let Binary;
		(function(_Binary) {
			_Binary.is = isArrayBufferLike;
			_Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			_Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			_Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			_Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			_Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			_Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			const cached = refs.get(source);
			if (cached) return cached;
			if (Array.isArray(source)) {
				const result = [];
				refs.set(source, result);
				source.forEach((value, index) => {
					result[index] = Reflect.apply(clone, null, [value, refs]);
				});
				return result;
			}
			const result = Object.create(Object.getPrototypeOf(source));
			refs.set(source, result);
			for (const key of Reflect.ownKeys(source)) {
				const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
				if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
				Reflect.defineProperty(result, key, descriptor);
			}
			return result;
		}
		/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
		function deepEqual(a, b, strict) {
			if (a === b) return true;
			if (!strict && isNullable(a) && isNullable(b)) return true;
			if (typeof a !== typeof b) return false;
			if (typeof a !== "object") return false;
			if (!a || !b) return false;
			function check(test, then) {
				return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
			}
			return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? Object.keys({
				...a,
				...b
			}).every((key) => deepEqual(a[key], b[key], strict));
		}
		//#endregion
		//#region ../../../vendor/cosmokit/src/time.ts
		let Time;
		(function(_Time) {
			_Time.millisecond = 1;
			const second = _Time.second = 1e3;
			const minute = _Time.minute = second * 60;
			const hour = _Time.hour = minute * 60;
			const day = _Time.day = hour * 24;
			const week = _Time.week = day * 7;
			let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
			function setTimezoneOffset(offset) {
				timezoneOffset = offset;
			}
			_Time.setTimezoneOffset = setTimezoneOffset;
			function getTimezoneOffset() {
				return timezoneOffset;
			}
			_Time.getTimezoneOffset = getTimezoneOffset;
			function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
				if (typeof date === "number") date = new Date(date);
				if (offset === void 0) offset = timezoneOffset;
				return Math.floor((date.valueOf() / minute - offset) / 1440);
			}
			_Time.getDateNumber = getDateNumber;
			function fromDateNumber(value, offset) {
				const date = new Date(value * day);
				if (offset === void 0) offset = timezoneOffset;
				return new Date(+date + offset * minute);
			}
			_Time.fromDateNumber = fromDateNumber;
			const numeric = /\d+(?:\.\d+)?/.source;
			const timeRegExp = new RegExp(`^${[
				"w(?:eek(?:s)?)?",
				"d(?:ay(?:s)?)?",
				"h(?:our(?:s)?)?",
				"m(?:in(?:ute)?(?:s)?)?",
				"s(?:ec(?:ond)?(?:s)?)?"
			].map((unit) => `(${numeric}${unit})?`).join("")}$`);
			function parseTime(source) {
				const capture = timeRegExp.exec(source);
				if (!capture) return 0;
				return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
			}
			_Time.parseTime = parseTime;
			function parseDate(date) {
				const parsed = parseTime(date);
				if (parsed) date = Date.now() + parsed;
				else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
				else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
				return date ? new Date(date) : /* @__PURE__ */ new Date();
			}
			_Time.parseDate = parseDate;
			function format(ms) {
				const abs = Math.abs(ms);
				if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
				else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
				else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
				else if (abs >= second) return Math.round(ms / second) + "s";
				return ms + "ms";
			}
			_Time.format = format;
			function toDigits(source, length = 2) {
				return source.toString().padStart(length, "0");
			}
			_Time.toDigits = toDigits;
			function template(template, time = /* @__PURE__ */ new Date()) {
				return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
			}
			_Time.template = template;
		})(Time || (Time = {}));
		//#endregion
		//#region ../../../vendor/schemastery/src/index.ts
		const kSchema = Symbol.for("schemastery");
		const kValidationError = Symbol.for("ValidationError");
		globalThis.__schemastery_index__ ??= 0;
		globalThis.__schemastery_refs__ = void 0;
		var ValidationError = class extends TypeError {
			options;
			name = "ValidationError";
			constructor(message, options) {
				let prefix = "$";
				for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
				else if (typeof segment === "number") prefix += "[" + segment + "]";
				else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
				if (prefix.startsWith(".")) prefix = prefix.slice(1);
				super((prefix === "$" ? "" : `${prefix} `) + message);
				this.options = options;
			}
			static is(error) {
				return !!error?.[kValidationError];
			}
		};
		Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
		const Schema = function(options) {
			const schema = function(data, options = {}) {
				return Schema.resolve(data, schema, options)[0];
			};
			if (options.refs) {
				const refs = mapValues(options.refs, (options) => new Schema(options));
				const getRef = (uid) => refs[uid];
				for (const key in refs) {
					const options = refs[key];
					options.sKey = getRef(options.sKey);
					options.inner = getRef(options.inner);
					options.list = options.list && options.list.map(getRef);
					options.dict = options.dict && mapValues(options.dict, getRef);
				}
				return refs[options.uid];
			}
			Object.assign(schema, options);
			if (typeof schema.callback === "string") try {
				schema.callback = new Function("return " + schema.callback)();
			} catch {}
			Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
			Object.setPrototypeOf(schema, Schema.prototype);
			schema.meta ||= {};
			schema.toString = schema.toString.bind(schema);
			return schema;
		};
		Schema.prototype = Object.create(Function.prototype);
		Schema.prototype[kSchema] = true;
		Object.defineProperty(Schema.prototype, "~standard", { get() {
			return {
				version: 1,
				vendor: "schemastery",
				validate: (value) => {
					try {
						return { value: Schema.resolve(value, this, {})[0] };
					} catch (error) {
						if (ValidationError.is(error)) return { issues: [{
							message: error.message,
							path: error.options.path
						}] };
						throw error;
					}
				}
			};
		} });
		Schema.ValidationError = ValidationError;
		Schema.prototype.toJSON = function toJSON() {
			if (globalThis.__schemastery_refs__) {
				globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
				return this.uid;
			}
			globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
			globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
			const result = {
				uid: this.uid,
				refs: globalThis.__schemastery_refs__
			};
			globalThis.__schemastery_refs__ = void 0;
			return result;
		};
		Schema.prototype.set = function set(key, value) {
			this.dict[key] = value;
			return this;
		};
		Schema.prototype.push = function push(value) {
			this.list.push(value);
			return this;
		};
		function mergeDesc(original, messages) {
			const result = typeof original === "string" ? { "": original } : { ...original };
			for (const locale in messages) {
				const value = messages[locale];
				if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
				else if (typeof value === "string") result[locale] = value;
			}
			return result;
		}
		function getInner(value) {
			return value?.$value ?? value?.$inner;
		}
		function extractKeys(data) {
			return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
		}
		Schema.prototype.i18n = function i18n(messages) {
			const schema = Schema(this);
			const desc = mergeDesc(schema.meta.description, messages);
			if (Object.keys(desc).length) schema.meta.description = desc;
			if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
				return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
			});
			if (schema.list) schema.list = schema.list.map((inner, index) => {
				return inner.i18n(mapValues(messages, (data = {}) => {
					if (Array.isArray(getInner(data))) return getInner(data)[index];
					if (Array.isArray(data)) return data[index];
					return extractKeys(data);
				}));
			});
			if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
				if (getInner(data)) return getInner(data);
				return extractKeys(data);
			}));
			if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
			return schema;
		};
		Schema.prototype.extra = function extra(key, value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		};
		for (const key of [
			"required",
			"disabled",
			"collapse",
			"hidden",
			"loose"
		]) Object.assign(Schema.prototype, { [key](value = true) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.deprecated = function deprecated() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "deprecated",
				type: "danger"
			});
			return schema;
		};
		Schema.prototype.experimental = function experimental() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "experimental",
				type: "warning"
			});
			return schema;
		};
		Schema.prototype.pattern = function pattern(regexp) {
			const schema = Schema(this);
			const pattern = pick(regexp, ["source", "flags"]);
			schema.meta = {
				...schema.meta,
				pattern
			};
			return schema;
		};
		Schema.prototype.simplify = function simplify(value) {
			if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
			if (isNullable(value)) return value;
			if (this.type === "object" || this.type === "dict") {
				const result = {};
				for (const key in value) {
					const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
					if (this.type === "dict" || !isNullable(item)) result[key] = item;
				}
				if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
				return result;
			} else if (this.type === "array" || this.type === "tuple") {
				const result = [];
				value.forEach((value, index) => {
					const schema = this.type === "array" ? this.inner : this.list[index];
					const item = schema ? schema.simplify(value) : value;
					result.push(item);
				});
				return result;
			} else if (this.type === "intersect") {
				const result = {};
				for (const item of this.list) Object.assign(result, item.simplify(value));
				return result;
			} else if (this.type === "union") for (const schema of this.list) try {
				Schema.resolve(value, schema, {});
				return schema.simplify(value);
			} catch {}
			return value;
		};
		Schema.prototype.toString = function toString(inline) {
			return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
		};
		Schema.prototype.role = function role(role, extra) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				role,
				extra
			};
			return schema;
		};
		for (const key of [
			"default",
			"link",
			"comment",
			"description",
			"max",
			"min",
			"step"
		]) Object.assign(Schema.prototype, { [key](value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		const resolvers = {};
		Schema.extend = function extend(type, resolve) {
			resolvers[type] = resolve;
		};
		Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
			if (!schema) return [data];
			if (options.ignore?.(data, schema)) return [data];
			if (isNullable(data) && schema.type !== "lazy") {
				if (schema.meta.required) throw new ValidationError(`missing required value`, options);
				let current = schema;
				let fallback = schema.meta.default;
				while (current?.type === "intersect" && isNullable(fallback)) {
					current = current.list[0];
					fallback = current?.meta.default;
				}
				if (isNullable(fallback)) return [data];
				data = clone(fallback);
			}
			const callback = resolvers[schema.type];
			if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
			try {
				return callback(data, schema, options, strict);
			} catch (error) {
				if (!schema.meta.loose) throw error;
				return [schema.meta.default];
			}
		};
		Schema.from = function from(source) {
			if (isNullable(source)) return Schema.any();
			else if ([
				"string",
				"number",
				"boolean"
			].includes(typeof source)) return Schema.const(source).required();
			else if (source[kSchema]) return source;
			else if (typeof source === "function") switch (source) {
				case String: return Schema.string().required();
				case Number: return Schema.number().required();
				case Boolean: return Schema.boolean().required();
				case Function: return Schema.function().required();
				default: return Schema.is(source).required();
			}
			else throw new TypeError(`cannot infer schema from ${source}`);
		};
		Schema.lazy = function lazy(builder) {
			const toJSON = () => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			};
			const schema = new Schema({
				type: "lazy",
				builder,
				inner: { toJSON }
			});
			return schema;
		};
		Schema.natural = function natural() {
			return Schema.number().step(1).min(0);
		};
		Schema.percent = function percent() {
			return Schema.number().step(.01).min(0).max(1).role("slider");
		};
		Schema.date = function date() {
			return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
				const date = new Date(value);
				if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
				return date;
			}, true)]);
		};
		Schema.regExp = function regExp(flag = "") {
			return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
				try {
					return new RegExp(value, flag);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)]);
		};
		Schema.arrayBuffer = function arrayBuffer(encoding) {
			return Schema.union([
				Schema.is(ArrayBuffer),
				Schema.is(SharedArrayBuffer),
				Schema.transform(Schema.any(), (value, options) => {
					if (Binary.isSource(value)) return Binary.fromSource(value);
					throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
				}, true),
				...encoding ? [Schema.transform(Schema.string(), (value, options) => {
					try {
						return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
					} catch (e) {
						throw new ValidationError(e.message, options);
					}
				}, true)] : []
			]);
		};
		Schema.extend("lazy", (data, schema, options, strict) => {
			if (!schema.inner[kSchema]) {
				schema.inner = schema.builder();
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
			}
			return Schema.resolve(data, schema.inner, options, strict);
		});
		Schema.extend("any", (data) => {
			return [data];
		});
		Schema.extend("never", (data, _, options) => {
			throw new ValidationError(`expected nullable but got ${data}`, options);
		});
		Schema.extend("const", (data, { value }, options) => {
			if (deepEqual(data, value)) return [value];
			throw new ValidationError(`expected ${value} but got ${data}`, options);
		});
		function checkWithinRange(data, meta, description, options, skipMin = false) {
			const { max = Infinity, min = -Infinity } = meta;
			if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
			if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
		}
		Schema.extend("string", (data, { meta }, options) => {
			if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
			if (meta.pattern) {
				const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
				if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
			}
			checkWithinRange(data.length, meta, "string length", options);
			return [data];
		});
		function decimalShift(data, digits) {
			const str = data.toString();
			if (str.includes("e")) return data * Math.pow(10, digits);
			const index = str.indexOf(".");
			if (index === -1) return data * Math.pow(10, digits);
			const frac = str.slice(index + 1);
			const integer = str.slice(0, index);
			if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
			return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
		}
		function isMultipleOf(data, min, step) {
			step = Math.abs(step);
			if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
			const index = step.toString().indexOf(".");
			const digits = step.toString().slice(index + 1).length;
			return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
		}
		Schema.extend("number", (data, { meta }, options) => {
			if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
			checkWithinRange(data, meta, "number", options);
			const { step } = meta;
			if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
			return [data];
		});
		Schema.extend("boolean", (data, _, options) => {
			if (typeof data === "boolean") return [data];
			throw new ValidationError(`expected boolean but got ${data}`, options);
		});
		Schema.extend("bitset", (data, { bits, meta }, options) => {
			let value = 0, keys = [];
			if (typeof data === "number") {
				value = data;
				for (const key in bits) if (data & bits[key]) keys.push(key);
			} else if (Array.isArray(data)) {
				keys = data;
				for (const key of keys) {
					if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
					if (key in bits) value |= bits[key];
				}
			} else throw new ValidationError(`expected number or array but got ${data}`, options);
			if (value === meta.default) return [value];
			return [value, keys];
		});
		Schema.extend("function", (data, _, options) => {
			if (typeof data === "function") return [data];
			throw new ValidationError(`expected function but got ${data}`, options);
		});
		Schema.extend("is", (data, { constructor }, options) => {
			if (typeof constructor === "function") {
				if (data instanceof constructor) return [data];
				throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
			} else {
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
				let prototype = Object.getPrototypeOf(data);
				while (prototype) {
					if (prototype.constructor?.name === constructor) return [data];
					prototype = Object.getPrototypeOf(prototype);
				}
				throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			}
		});
		function property(data, key, schema, options) {
			try {
				const [value, adapted] = Schema.resolve(data[key], schema, {
					...options,
					path: [...options.path || [], key]
				});
				if (adapted !== void 0) data[key] = adapted;
				return value;
			} catch (e) {
				if (!options?.autofix) throw e;
				delete data[key];
				return schema.meta.default;
			}
		}
		Schema.extend("array", (data, { inner, meta }, options) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
			return [data.map((_, index) => property(data, index, inner, options))];
		});
		Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in data) {
				let rKey;
				try {
					rKey = Schema.resolve(key, sKey, options)[0];
				} catch (error) {
					if (strict) continue;
					throw error;
				}
				result[rKey] = property(data, key, inner, options);
				data[rKey] = data[key];
				if (key !== rKey) delete data[key];
			}
			return [result];
		});
		Schema.extend("tuple", (data, { list }, options, strict) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			const result = list.map((inner, index) => property(data, index, inner, options));
			if (strict) return [result];
			result.push(...data.slice(list.length));
			return [result];
		});
		function merge(result, data) {
			for (const key in data) {
				if (key in result) continue;
				result[key] = data[key];
			}
		}
		Schema.extend("object", (data, { dict }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in dict) {
				const value = property(data, key, dict[key], options);
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region src/pet-settings.ts
		/** Durable preferences for the DSH Web pet surface. */
		/** Settings namespace owned by the pet plugin. */
		const PET_SETTINGS_NAMESPACE = "dsh-pet";
		/** Defaults used before the user settings document carries overrides. */
		const DEFAULT_PET_SETTINGS = Object.freeze({
			enabled: true,
			selectedId: "dsh",
			size: 112
		});
		Schema.object({
			enabled: Schema.boolean().default(DEFAULT_PET_SETTINGS.enabled),
			selectedId: Schema.string().min(1).max(512).default(DEFAULT_PET_SETTINGS.selectedId),
			size: Schema.natural().min(80).max(224).default(DEFAULT_PET_SETTINGS.size)
		});
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
			displayName: "阿良",
			description: "The default DSH companion.",
			spriteVersionNumber: 2,
			assetPath: petAssetPath("dsh")
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
		/** Built-in picker order: DSH's bundled default, then Codex-discovered presets. */
		const PET_PRESETS = Object.freeze([DSH_BUILTIN_PET, ...CODEX_BUILTIN_PETS]);
		const IDLE_FRAMES = Object.freeze([
			Object.freeze({
				rowIndex: 0,
				columnIndex: 0,
				frameDurationMs: 280
			}),
			Object.freeze({
				rowIndex: 0,
				columnIndex: 1,
				frameDurationMs: 110
			}),
			Object.freeze({
				rowIndex: 0,
				columnIndex: 2,
				frameDurationMs: 110
			}),
			Object.freeze({
				rowIndex: 0,
				columnIndex: 3,
				frameDurationMs: 140
			}),
			Object.freeze({
				rowIndex: 0,
				columnIndex: 4,
				frameDurationMs: 140
			}),
			Object.freeze({
				rowIndex: 0,
				columnIndex: 5,
				frameDurationMs: 320
			})
		]);
		function uniformFrames(rowIndex, count, frameDurationMs, finalFrameDurationMs) {
			return Object.freeze(Array.from({ length: count }, (_, columnIndex) => Object.freeze({
				rowIndex,
				columnIndex,
				frameDurationMs: columnIndex === count - 1 ? finalFrameDurationMs : frameDurationMs
			})));
		}
		/** Exact row, cell count, and timing table used by Codex pet animations. */
		const CODEX_PET_ANIMATION_FRAMES = Object.freeze({
			failed: uniformFrames(5, 8, 140, 240),
			idle: IDLE_FRAMES,
			jumping: uniformFrames(4, 5, 140, 280),
			review: uniformFrames(8, 6, 150, 280),
			running: uniformFrames(7, 6, 120, 220),
			"running-left": uniformFrames(2, 8, 120, 220),
			"running-right": uniformFrames(1, 8, 120, 220),
			waving: uniformFrames(3, 4, 140, 280),
			waiting: uniformFrames(6, 6, 150, 260)
		});
		const SLOW_IDLE_FRAMES = Object.freeze(IDLE_FRAMES.map((frame) => Object.freeze({
			...frame,
			frameDurationMs: frame.frameDurationMs * 6
		})));
		/**
		* Build Codex's finite action lead-in and slow-idle loop.
		* @param state - task, hover, or drag animation to play.
		* @param reducedMotion - whether playback must remain on the state's first cell.
		* @returns frame order and loop target for the renderer's timer.
		*/
		function getPetAnimationSequence(state, reducedMotion) {
			const frames = CODEX_PET_ANIMATION_FRAMES[state];
			if (reducedMotion) return {
				frames: [frames[0]],
				loopStartIndex: null
			};
			if (state === "idle") return {
				frames,
				loopStartIndex: 0
			};
			const actionFrames = Array.from({ length: 3 }, () => frames).flat();
			return {
				frames: [...actionFrames, ...SLOW_IDLE_FRAMES],
				loopStartIndex: actionFrames.length
			};
		}
		/**
		* Convert one atlas cell to CSS `background-position` percentages.
		* @param frame - cell selected by the animation sequence.
		* @param spriteVersion - atlas layout used by the selected pet.
		* @returns horizontal and vertical background-position percentages.
		*/
		function petFrameBackgroundPosition(frame, spriteVersion) {
			const atlas = CODEX_PET_ATLASES[spriteVersion];
			return `${frame.columnIndex / (atlas.columns - 1) * 100}% ${frame.rowIndex / (atlas.rows - 1) * 100}%`;
		}
		//#endregion
		//#region \0dsh-css:/Users/ygd/Projects/deepseek-harness/packages/client/pet/src/client/PetSprite.module.css.mjs
		const css$2 = ".nNKCEG_sprite{aspect-ratio:192/208;background-image:var(--pet-atlas);background-repeat:no-repeat;background-position:var(--pet-frame-position);background-size:800% var(--pet-atlas-rows);width:100%;image-rendering:pixelated;user-select:none;pointer-events:none;display:block}";
		const tagId$2 = "@deepseek-ai/dsh-pet/PetSprite.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-pet";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var PetSprite_module_css_default = { "sprite": "nNKCEG_sprite" };
		//#endregion
		//#region src/client/PetSprite.tsx
		/** DSH pet spritesheet renderer for package-owned and Codex-compatible atlases. */
		/**
		* Render a pixel-aligned frame and advance it with the animation timing table.
		* @param props - atlas, state, and motion preference.
		* @returns an assistive-technology-hidden sprite span.
		*/
		function PetSprite({ assetUrl, version, state, reducedMotion, hover }) {
			const animationState = hover ? "jumping" : state;
			const sequence = (0, react.useMemo)(() => getPetAnimationSequence(animationState, reducedMotion), [animationState, reducedMotion]);
			const [frameIndex, setFrameIndex] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let timer;
				let index = 0;
				setFrameIndex(0);
				const schedule = () => {
					const frame = sequence.frames[index];
					timer = window.setTimeout(() => {
						if (index + 1 < sequence.frames.length) index += 1;
						else if (sequence.loopStartIndex !== null) index = sequence.loopStartIndex;
						else return;
						setFrameIndex(index);
						schedule();
					}, frame.frameDurationMs);
				};
				if (sequence.frames.length > 1) schedule();
				return () => {
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, [sequence]);
			const boundedIndex = Math.min(frameIndex, sequence.frames.length - 1);
			const frame = sequence.frames[boundedIndex];
			const style = {
				"--pet-atlas": `url(${JSON.stringify(assetUrl)})`,
				"--pet-atlas-rows": version === 1 ? "900%" : "1100%",
				"--pet-frame-position": petFrameBackgroundPosition(frame, version)
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				className: PetSprite_module_css_default.sprite,
				"data-frame-column": frame.columnIndex,
				"data-frame-row": frame.rowIndex,
				"data-pet-state": animationState,
				style
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/ygd/Projects/deepseek-harness/packages/client/pet/src/client/PetOverlay.module.css.mjs
		const css$1 = ".rzrraW_overlay{z-index:20;pointer-events:none;position:fixed;inset:0;overflow:hidden}.rzrraW_pet{box-sizing:border-box;cursor:grab;pointer-events:auto;touch-action:none;position:absolute;bottom:24px;right:24px}.rzrraW_pet:active{cursor:grabbing}.rzrraW_pet:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:4px;border-radius:8px}";
		const tagId$1 = "@deepseek-ai/dsh-pet/PetOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-pet";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var PetOverlay_module_css_default = {
			"overlay": "rzrraW_overlay",
			"pet": "rzrraW_pet"
		};
		//#endregion
		//#region src/client/PetOverlay.tsx
		/** Window-local draggable pet overlay. */
		function clamp(value, minimum, maximum) {
			return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
		}
		function petHeight(width) {
			return width * 208 / 192;
		}
		function viewportPosition(size) {
			return {
				x: Math.max(0, window.innerWidth - size - 24),
				y: Math.max(0, window.innerHeight - petHeight(size) - 24)
			};
		}
		function boundedPosition(point, size) {
			return {
				x: clamp(point.x, 0, window.innerWidth - size),
				y: clamp(point.y, 0, window.innerHeight - petHeight(size))
			};
		}
		/**
		* Render the pet over the Web frame with pointer and keyboard repositioning.
		* @param props - active descriptor, activity, size, and motion preference.
		* @returns the draggable overlay surface.
		*/
		function PetOverlay({ descriptor, state, size, reducedMotion }) {
			const width = clamp(Math.round(size), 80, 224);
			const [position, setPosition] = (0, react.useState)(null);
			const [hover, setHover] = (0, react.useState)(false);
			const [dragAnimation, setDragAnimation] = (0, react.useState)(null);
			const drag = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const keepInsideWindow = () => {
					setPosition((previous) => previous === null ? null : boundedPosition(previous, width));
				};
				window.addEventListener("resize", keepInsideWindow);
				keepInsideWindow();
				return () => {
					window.removeEventListener("resize", keepInsideWindow);
				};
			}, [width]);
			const moveByKeyboard = (event) => {
				const step = event.shiftKey ? 24 : 8;
				let delta;
				switch (event.key) {
					case "ArrowLeft":
						delta = {
							x: -step,
							y: 0
						};
						break;
					case "ArrowRight":
						delta = {
							x: step,
							y: 0
						};
						break;
					case "ArrowUp":
						delta = {
							x: 0,
							y: -step
						};
						break;
					case "ArrowDown":
						delta = {
							x: 0,
							y: step
						};
						break;
					default: return;
				}
				event.preventDefault();
				setPosition((previous) => {
					const origin = previous ?? viewportPosition(width);
					return boundedPosition({
						x: origin.x + delta.x,
						y: origin.y + delta.y
					}, width);
				});
			};
			const beginDrag = (event) => {
				if (event.button !== 0) return;
				const rect = event.currentTarget.getBoundingClientRect();
				const origin = position ?? {
					x: rect.width === 0 ? viewportPosition(width).x : rect.left,
					y: rect.height === 0 ? viewportPosition(width).y : rect.top
				};
				drag.current = {
					pointerId: event.pointerId,
					pointerX: event.clientX,
					pointerY: event.clientY,
					origin,
					previousX: event.clientX
				};
				event.currentTarget.setPointerCapture(event.pointerId);
				setPosition(origin);
			};
			const continueDrag = (event) => {
				const active = drag.current;
				if (active === null || active.pointerId !== event.pointerId) return;
				const horizontalDelta = event.clientX - active.previousX;
				if (horizontalDelta >= 4) setDragAnimation("running-right");
				else if (horizontalDelta <= -4) setDragAnimation("running-left");
				active.previousX = event.clientX;
				setPosition(boundedPosition({
					x: active.origin.x + event.clientX - active.pointerX,
					y: active.origin.y + event.clientY - active.pointerY
				}, width));
			};
			const endDrag = (event) => {
				const active = drag.current;
				if (active === null || active.pointerId !== event.pointerId) return;
				if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
				drag.current = null;
				setDragAnimation(null);
			};
			const style = position === null ? { width } : {
				width,
				left: position.x,
				top: position.y,
				right: "auto",
				bottom: "auto"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PetOverlay_module_css_default.overlay,
				"data-pet-overlay": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					"aria-label": descriptor.displayName,
					className: PetOverlay_module_css_default.pet,
					"data-pet-id": descriptor.id,
					onKeyDown: moveByKeyboard,
					onPointerCancel: endDrag,
					onPointerDown: beginDrag,
					onPointerEnter: () => {
						setHover(true);
					},
					onPointerLeave: () => {
						setHover(false);
					},
					onPointerMove: continueDrag,
					onPointerUp: endDrag,
					role: "img",
					style,
					tabIndex: 0,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetSprite, {
						assetUrl: descriptor.assetPath,
						version: descriptor.spriteVersionNumber,
						state: dragAnimation ?? state,
						reducedMotion,
						hover: hover && dragAnimation === null
					})
				})
			});
		}
		//#endregion
		//#region src/client/pet-state.ts
		function currentTurnFailed(snapshot) {
			const latestTurn = snapshot.chat.timeline.turnOrder.at(-1);
			if (latestTurn === void 0) return false;
			return snapshot.chat.timeline.turns.get(latestTurn)?.end?.data.reason.kind === "error";
		}
		/**
		* Aggregate the non-blank Session list into the single Web mascot's activity facts.
		* @param sessions - global Session list carrying live activity and completion flags.
		* @param current - selected Session's detailed snapshot, when it is mounted.
		* @returns the waiting, selected-failure, review, and running signals.
		*/
		function petStateSignals(sessions, current) {
			const visible = Object.values(sessions.byId).filter((session) => !session.blank);
			const selected = sessions.current === void 0 ? void 0 : sessions.byId[sessions.current];
			const currentFailure = selected !== void 0 && !selected.blank && current !== void 0 && current.sessionId === sessions.current && !current.running && (current.lastAgentError !== null || currentTurnFailed(current));
			return {
				waiting: visible.some((session) => session.pendingInteraction !== void 0),
				currentFailure,
				review: visible.some((session) => session.completed === true),
				running: visible.some((session) => session.running)
			};
		}
		/**
		* Select the highest-priority Codex task animation for one session.
		* @param signals - current waiting, failure, review, and activity facts.
		* @returns the state whose row the pet renderer should animate.
		*/
		function derivePetState(signals) {
			if (signals.waiting) return "waiting";
			if (signals.currentFailure) return "failed";
			if (signals.review) return "review";
			if (signals.running) return "running";
			return "idle";
		}
		//#endregion
		//#region src/client/PetOverlaySlot.tsx
		/**
		* Select the effective available pet and render it over the Web frame.
		* @param props - runtime snapshot hooks supplied by the slot renderer.
		* @returns the pet overlay, or null until an enabled atlas is available.
		*/
		function PetOverlaySlot({ usePetCatalog, usePetSettings, useReducedMotion, useSession, useSessions }) {
			const catalog = usePetCatalog((state) => state);
			const settings = usePetSettings((state) => state.value) ?? DEFAULT_PET_SETTINGS;
			const reducedMotion = useReducedMotion((value) => value);
			const sessions = useSessions((state) => state);
			const current = useSession((snapshot) => snapshot);
			const descriptor = resolveSelectedPet(catalog.pets, settings.selectedId);
			if (!settings.enabled || descriptor === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetOverlay, {
				descriptor: {
					...descriptor,
					assetPath: petAssetUrl(descriptor.assetPath, catalog.revision)
				},
				reducedMotion,
				size: settings.size,
				state: derivePetState(petStateSignals(sessions, current))
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/ygd/Projects/deepseek-harness/packages/client/pet/src/client/PetsSection.module.css.mjs
		const css = ".BABoiG_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:20px;display:flex}.BABoiG_header{justify-content:space-between;align-items:flex-start;gap:16px;display:flex}.BABoiG_title{margin:0;font-size:18px;font-weight:600}.BABoiG_intro,.BABoiG_empty,.BABoiG_importHint,.BABoiG_status,.BABoiG_error{color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:13px;line-height:1.5}.BABoiG_importHint code{color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);font-size:12px}.BABoiG_status{color:var(--dsw-alias-label-secondary)}.BABoiG_error{color:var(--dsw-alias-state-error-primary)}.BABoiG_controls{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;grid-template-columns:minmax(180px,1fr) minmax(240px,2fr);gap:20px;padding:14px 16px;display:grid}.BABoiG_toggle{cursor:pointer;align-items:center;gap:8px;font-size:13px;font-weight:500;display:flex}.BABoiG_toggle input,.BABoiG_sizeControl input{accent-color:var(--dsw-alias-brand-primary)}.BABoiG_sizeControl{flex-direction:column;gap:6px;display:flex}.BABoiG_sizeLabel{color:var(--dsw-alias-label-secondary);justify-content:space-between;gap:12px;font-size:12px;display:flex}.BABoiG_sizeLabel output{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.BABoiG_group{flex-direction:column;gap:10px;display:flex}.BABoiG_groupHeading{color:var(--dsw-alias-label-tertiary);letter-spacing:.06em;text-transform:uppercase;margin:0;font-size:12px;font-weight:600}.BABoiG_cards{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin:0;padding:0;list-style:none;display:grid}.BABoiG_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;overflow:hidden}.BABoiG_cardSelected{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}.BABoiG_cardUnavailable{border-color:var(--dsw-alias-border-l1)}.BABoiG_cardButton{box-sizing:border-box;width:100%;min-height:110px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;grid-template-rows:1fr auto;grid-template-columns:72px minmax(0,1fr);gap:6px 12px;padding:12px;display:grid}.BABoiG_cardButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.BABoiG_cardButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.BABoiG_cardButton:disabled{cursor:default}.BABoiG_preview{grid-row:1/span 2;justify-content:center;align-items:center;width:72px;display:flex}.BABoiG_previewUnavailable{color:var(--dsw-alias-label-dimmed);font-size:30px}.BABoiG_copy{flex-direction:column;gap:4px;min-width:0;display:flex}.BABoiG_cardHeading{align-items:center;gap:6px;min-width:0;display:flex}.BABoiG_petName{text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;overflow:hidden}.BABoiG_unavailable,.BABoiG_selected{border-radius:999px;flex:none;padding:1px 7px;font-size:10px;line-height:16px}.BABoiG_unavailable{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover-danger)}.BABoiG_selected{color:var(--dsw-alias-bg-layer-3);background:var(--dsw-alias-label-primary)}.BABoiG_description{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:1.45;display:-webkit-box;overflow:hidden}.BABoiG_petId{color:var(--dsw-alias-label-dimmed);font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);font-size:10px}.BABoiG_action{color:var(--dsw-alias-label-tertiary);align-self:end;font-size:11px}@media (width<=640px){.BABoiG_header,.BABoiG_controls{grid-template-columns:1fr;align-items:stretch}.BABoiG_header{flex-direction:column}}";
		const tagId = "@deepseek-ai/dsh-pet/PetsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-pet";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PetsSection_module_css_default = {
			"unavailable": "BABoiG_unavailable",
			"groupHeading": "BABoiG_groupHeading",
			"cardHeading": "BABoiG_cardHeading",
			"header": "BABoiG_header",
			"card": "BABoiG_card",
			"cardUnavailable": "BABoiG_cardUnavailable",
			"group": "BABoiG_group",
			"preview": "BABoiG_preview",
			"toggle": "BABoiG_toggle",
			"empty": "BABoiG_empty",
			"importHint": "BABoiG_importHint",
			"sizeLabel": "BABoiG_sizeLabel",
			"cards": "BABoiG_cards",
			"intro": "BABoiG_intro",
			"cardButton": "BABoiG_cardButton",
			"status": "BABoiG_status",
			"copy": "BABoiG_copy",
			"error": "BABoiG_error",
			"controls": "BABoiG_controls",
			"section": "BABoiG_section",
			"petName": "BABoiG_petName",
			"sizeControl": "BABoiG_sizeControl",
			"selected": "BABoiG_selected",
			"cardSelected": "BABoiG_cardSelected",
			"petId": "BABoiG_petId",
			"description": "BABoiG_description",
			"previewUnavailable": "BABoiG_previewUnavailable",
			"action": "BABoiG_action",
			"title": "BABoiG_title"
		};
		//#endregion
		//#region src/client/PetsSection.tsx
		function displayPresets(catalog) {
			return PET_PRESETS.map((metadata) => {
				return catalog.pets.find((pet) => pet.kind === "builtin" && pet.id === metadata.id) ?? {
					...metadata,
					available: false
				};
			});
		}
		function PetGroup({ heading, pets, revision, selectedId, select, t, writable, empty }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: PetsSection_module_css_default.group,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: PetsSection_module_css_default.groupHeading,
					children: heading
				}), pets.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: PetsSection_module_css_default.empty,
					children: empty
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: PetsSection_module_css_default.cards,
					children: pets.map((pet) => {
						const selected = pet.id === selectedId;
						const actionLabel = pet.available ? petLocaleValue(t(selected ? "selectedPet" : "selectPet"), "pet", pet.displayName) : petLocaleValue(t("unavailablePet"), "pet", pet.displayName);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							className: `${PetsSection_module_css_default.card}${selected ? ` ${PetsSection_module_css_default.cardSelected}` : ""}${pet.available ? "" : ` ${PetsSection_module_css_default.cardUnavailable}`}`,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								"aria-label": actionLabel,
								"aria-pressed": selected,
								className: PetsSection_module_css_default.cardButton,
								disabled: !writable || !pet.available || selected,
								onClick: () => {
									select(pet.id);
								},
								type: "button",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: PetsSection_module_css_default.preview,
										children: pet.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetSprite, {
											assetUrl: petAssetUrl(pet.assetPath, revision),
											version: pet.spriteVersionNumber,
											state: "idle",
											reducedMotion: true,
											hover: false
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											className: PetsSection_module_css_default.previewUnavailable,
											children: "—"
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: PetsSection_module_css_default.copy,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: PetsSection_module_css_default.cardHeading,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PetsSection_module_css_default.petName,
														children: pet.displayName
													}),
													!pet.available && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PetsSection_module_css_default.unavailable,
														children: t("unavailable")
													}),
													selected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: PetsSection_module_css_default.selected,
														children: t("selected")
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: PetsSection_module_css_default.description,
												children: pet.description ?? t("noDescription")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												className: PetsSection_module_css_default.petId,
												children: pet.id
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: PetsSection_module_css_default.action,
										children: t(selected ? "selected" : pet.available ? "select" : "unavailable")
									})
								]
							})
						}, pet.id);
					})
				})]
			});
		}
		/**
		* Render visibility, size, refresh, and catalog-selection controls.
		* @param props - catalog snapshot, settings values, actions, and locale lookup.
		* @returns the complete pet settings section; pet creation is intentionally absent.
		*/
		function PetsSection({ catalog, status, error, writable, enabled, selectedId, size, refresh, select, setEnabled, setSize, t }) {
			const boundedSize = Math.min(224, Math.max(80, Math.round(size)));
			const customPets = catalog.pets.filter((pet) => pet.kind === "custom");
			const busy = status === "loading";
			const initialLoad = catalog.pets.length === 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: PetsSection_module_css_default.section,
				"data-catalog-revision": catalog.revision,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PetsSection_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: PetsSection_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: PetsSection_module_css_default.intro,
							children: t("intro")
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							disabled: busy,
							size: "sm",
							variant: "outline",
							onClick: () => {
								refresh();
							},
							children: busy ? t("refreshing") : t("refresh")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: PetsSection_module_css_default.importHint,
						children: [
							t("importPrefix"),
							" ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "$CODEX_HOME/pets" }),
							" ",
							"(",
							t("importDefault"),
							" ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "~/.codex/pets" }),
							")",
							t("importSuffix")
						]
					}),
					(status === "idle" || busy && initialLoad) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PetsSection_module_css_default.status,
						role: "status",
						children: t("loading")
					}),
					status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PetsSection_module_css_default.error,
						role: "alert",
						children: error ?? t("loadError")
					}),
					!writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: PetsSection_module_css_default.status,
						children: t("readOnly")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PetsSection_module_css_default.controls,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: PetsSection_module_css_default.toggle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								checked: enabled,
								disabled: !writable,
								onChange: (event) => {
									setEnabled(event.currentTarget.checked);
								},
								type: "checkbox"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("enabled") })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: PetsSection_module_css_default.sizeControl,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: PetsSection_module_css_default.sizeLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("size") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", { children: petLocaleValue(t("pixels"), "size", String(boundedSize)) })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								"aria-label": t("size"),
								disabled: !writable,
								max: 224,
								min: 80,
								onChange: (event) => {
									setSize(Number(event.currentTarget.value));
								},
								step: 1,
								type: "range",
								value: boundedSize
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetGroup, {
						heading: t("presetGroup"),
						pets: displayPresets(catalog),
						revision: catalog.revision,
						selectedId,
						select,
						t,
						writable
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetGroup, {
						empty: t("noCustom"),
						heading: t("customGroup"),
						pets: customPets,
						revision: catalog.revision,
						selectedId,
						select,
						t,
						writable
					})
				]
			});
		}
		//#endregion
		//#region src/client/PetsSettingsSlot.tsx
		/**
		* Render the Pets settings page from its two independent Host-backed sources.
		* @param props - catalog/settings hooks, mutations, and localized copy.
		* @returns the complete settings section.
		*/
		function PetsSettingsSlot({ usePetCatalog, usePetSettings, refresh, set, t }) {
			const catalog = usePetCatalog((state) => state);
			const settingsScope = usePetSettings((state) => state);
			const settings = settingsScope.value ?? DEFAULT_PET_SETTINGS;
			const effectiveSelectedId = resolveSelectedPet(catalog.pets, settings.selectedId)?.id ?? "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PetsSection, {
				catalog: {
					pets: catalog.pets,
					revision: catalog.revision
				},
				enabled: settings.enabled,
				error: catalog.error,
				refresh,
				select: (id) => set("selectedId", id),
				selectedId: effectiveSelectedId,
				setEnabled: (enabled) => set("enabled", enabled),
				setSize: (size) => set("size", size),
				size: settings.size,
				status: catalog.status,
				t,
				writable: settingsScope.writable
			});
		}
		//#endregion
		//#region src/client/reduced-motion-store.ts
		/** Browser motion-preference observable for the pet renderer. */
		/** Media query used for the Web platform's reduced-motion preference. */
		const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
		/**
		* Observe the browser motion preference with lifecycle owned by the caller.
		* @param effect - Cordis effect registrar used to release the media listener.
		* @param match - optional media-query implementation for non-browser tests.
		* @returns boolean snapshot store consumed through a slot hooks compartment.
		*/
		function createReducedMotionStore(effect, match = typeof matchMedia === "undefined" ? void 0 : matchMedia) {
			const media = match?.(REDUCED_MOTION_QUERY);
			const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(media?.matches ?? false);
			if (media === void 0) return store;
			const onChange = (event) => {
				store.set(event.matches);
			};
			effect(() => {
				media.addEventListener("change", onChange);
				return () => {
					media.removeEventListener("change", onChange);
				};
			}, "dsh-pet: reduced motion preference");
			return store;
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services for catalog transport, durable settings, and both slots. */
		const inject = [
			"slots",
			"sessions",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];
		/**
		* Register the frame overlay and Pets settings section.
		* @param ctx - browser plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("pet", {
				zh,
				en
			}), "dsh-pet: copy dictionaries");
			const catalog = new PetCatalogController();
			const settings = ctx.settingsScope.bind({ namespace: PET_SETTINGS_NAMESPACE });
			const reducedMotion = createReducedMotionStore((installer, label) => {
				ctx.effect(installer, label);
			});
			ctx.effect(() => {
				catalog.load();
				const reset = ctx.on("connection/reset", () => {
					catalog.load();
				});
				return async () => {
					reset();
					await catalog.dispose();
				};
			}, "dsh-pet: catalog lifecycle");
			const overlayInjected = () => ({ hooks: {
				petCatalog: catalog.store,
				petSettings: settings,
				reducedMotion
			} });
			const sectionInjected = () => ({
				hooks: {
					petCatalog: catalog.store,
					petSettings: settings
				},
				refresh: () => catalog.refresh(),
				set: (field, value) => settings.set(field, value)
			});
			const t = ctx.locale.bind("pet");
			ctx.slots.inject("shell.overlay", function* () {
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "pet",
					order: 100,
					children: { "shell.overlay.pet": {
						kind: "single",
						scope: "session-maybe"
					} }
				}, PetOverlayRoot);
				yield ctx.slots.register({
					name: "shell.overlay.pet",
					inject: overlayInjected
				}, PetOverlaySlot);
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "pets",
				order: 30,
				label: () => t("nav"),
				locale: "pet",
				inject: sectionInjected
			}, PetsSettingsSlot));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map