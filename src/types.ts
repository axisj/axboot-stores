export type ZustandSetter<T> = (partial: Partial<T>, replace?: boolean | undefined) => void;

export type ZustandGetter<T> = () => T;

export type StoreActions<T, R> = (set: ZustandSetter<T>, get: ZustandGetter<T>) => R;

export interface PageStoreActions<T> {
  syncMetadata: (metaData?: T) => void;
  onMountApp: (params?: any) => Promise<void>;
  init: (params?: any) => Promise<void>;
  reset: () => Promise<void>;
  destroy: () => void;
}
