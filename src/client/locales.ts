/** `pet` namespace dictionaries for the overlay and settings section. */

/** Locale namespace registered by the browser plugin. */
export const NS = 'pet'

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  nav: '宠物',
  title: '窗口宠物',
  intro: '在 DSH Web 窗口里显示一个会随 Agent 状态变化的宠物。',
  enabled: '显示窗口宠物',
  size: '宠物大小',
  pixels: '{size} 像素',
  refresh: '刷新宠物',
  refreshing: '正在刷新…',
  loading: '正在加载宠物…',
  loadError: '无法加载宠物目录。',
  readOnly: '此远程浏览器只能查看宠物设置。',
  importPrefix: '将 Codex 宠物目录放入',
  importDefault: '默认',
  importSuffix: '，然后刷新。',
  presetGroup: '预设',
  customGroup: '自定义',
  noCustom: '没有找到可用的自定义宠物。',
  selected: '已选择',
  select: '选择',
  selectPet: '选择 {pet}',
  selectedPet: '已选择：{pet}',
  unavailable: '不可用',
  unavailablePet: '{pet} 不可用',
  noDescription: '暂无描述。',
} satisfies Record<string, string>

/** Keys accepted by the `pet` locale lookup. */
export type PetKey = keyof typeof zh

/** English dictionary, complete against the Chinese key set. */
export const en = {
  nav: 'Pets',
  title: 'Window pet',
  intro: 'Show a pet in the DSH Web window that reacts to the agent state.',
  enabled: 'Show window pet',
  size: 'Pet size',
  pixels: '{size} px',
  refresh: 'Refresh pets',
  refreshing: 'Refreshing…',
  loading: 'Loading pets…',
  loadError: 'Could not load the pet catalog.',
  readOnly: 'This remote browser can only view pet settings.',
  importPrefix: 'Put a Codex pet directory in',
  importDefault: 'default',
  importSuffix: ', then refresh.',
  presetGroup: 'Presets',
  customGroup: 'Custom',
  noCustom: 'No compatible custom pets found.',
  selected: 'Selected',
  select: 'Select',
  selectPet: 'Select {pet}',
  selectedPet: 'Selected: {pet}',
  unavailable: 'Unavailable',
  unavailablePet: '{pet} is unavailable',
  noDescription: 'No description.',
} satisfies Record<PetKey, string>

/**
 * Replace one named locale placeholder.
 * @param template - localized string containing the placeholder.
 * @param name - placeholder name without braces.
 * @param value - replacement text.
 * @returns localized text with the placeholder replaced.
 */
export function petLocaleValue(template: string, name: 'pet' | 'size', value: string): string {
  return template.replace(`{${name}}`, value)
}
