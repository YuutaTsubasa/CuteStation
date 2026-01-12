import { derived, get, writable } from "svelte/store";
import { assetManifest } from "$lib/game/assets/AssetManifest";

const DEFAULT_LOCALE = "en";
const NOTHING = "#NOTHING#";
const STORAGE_KEY = "cutestation.locale";

type LocalizationMap = Record<string, Record<string, string>>;

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === "\"") {
      const nextChar = text[i + 1];
      if (inQuotes && nextChar === "\"") {
        field += "\"";
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const normalizeLocale = (value: string) => value.trim().toLowerCase();

export class LocalizationStore {
  static data = writable<LocalizationMap>({});
  static locale = writable<string>(DEFAULT_LOCALE);
  static availableLocales = derived([LocalizationStore.data], ([$data]) =>
    Object.keys($data),
  );

  private static initialized = false;

  static getLocale() {
    return get(this.locale);
  }

  static detectUserLocale() {
    const supportedLocales = get(this.availableLocales);
    for (const lang of navigator.languages) {
      const normalized = normalizeLocale(lang);
      if (supportedLocales.includes(normalized)) {
        return normalized;
      }
    }
    return DEFAULT_LOCALE;
  }

  static initialize() {
    if (this.initialized) {
      return Promise.resolve();
    }
    this.initialized = true;

    const storedLocale =
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

    const loadPromise = this.load()
      .then(() => {
        const nextLocale =
          storedLocale ??
          this.detectUserLocale();
        this.setLocale(nextLocale);
      })
      .catch((error) => {
        console.warn("Failed to load localization assets:", error);
        this.setLocale(DEFAULT_LOCALE);
      })
      .finally(() => {
        this.locale.subscribe((newLocale) => {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, newLocale);
          }
        });
      });

    return loadPromise;
  }

  static async load() {
    const path = assetManifest.localization?.main ?? "/ProjectContent/Localization/localization.csv";
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Localization CSV not found: ${path}`);
    }
    const text = await res.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return;
    }

    const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, "").trim());
    const keyIndex = header.findIndex((cell) => normalizeLocale(cell) === "key");
    if (keyIndex === -1) {
      throw new Error("Localization CSV missing key column.");
    }

    const localeColumns = header
      .map((cell, index) => ({ cell: normalizeLocale(cell), index }))
      .filter(({ cell, index }) => index !== keyIndex && cell.length > 0);

    const newData: LocalizationMap = {};
    for (const { cell: locale } of localeColumns) {
      newData[locale] = {};
    }

    for (const row of rows.slice(1)) {
      const key = row[keyIndex]?.trim();
      if (!key) {
        continue;
      }
      for (const { cell: locale, index } of localeColumns) {
        newData[locale][key] = row[index] ?? "";
      }
    }

    this.data.set(newData);
  }

  static preprocess(value: string): string {
    return value === NOTHING ? "" : value;
  }

  static setLocale(newLocale: string) {
    const normalized = normalizeLocale(newLocale);
    const data = get(this.data);
    if (data[normalized]) {
      this.locale.set(normalized);
      return;
    }
    if (data[DEFAULT_LOCALE]) {
      this.locale.set(DEFAULT_LOCALE);
      return;
    }
    const firstLocale = Object.keys(data)[0];
    if (firstLocale) {
      this.locale.set(firstLocale);
    }
  }
}

export const t = derived(
  [LocalizationStore.locale, LocalizationStore.data],
  ([$locale, $data]) => {
    return (key: string) => {
      const lang = normalizeLocale($locale);
      const value = $data[lang]?.[key];
      if (value && value !== "") {
        return LocalizationStore.preprocess(value);
      }

      const fallbackLocale = $data[DEFAULT_LOCALE]
        ? DEFAULT_LOCALE
        : Object.keys($data)[0];
      const fallback = fallbackLocale ? $data[fallbackLocale]?.[key] : undefined;
      if (fallback && fallback !== "") {
        return LocalizationStore.preprocess(fallback);
      }

      return key;
    };
  },
);
