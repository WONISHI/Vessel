export interface LayoutPreferences {
  activityBarCollapsed: boolean
  statusBarVisible: boolean
}
export interface LayoutPreferencesAPI {
  layoutPreferences: {
    get(legacy?: Partial<LayoutPreferences>): Promise<LayoutPreferences>
    set(patch: Partial<LayoutPreferences>): Promise<LayoutPreferences>
    onChanged(callback: (value: LayoutPreferences) => void): () => void
  }
}
