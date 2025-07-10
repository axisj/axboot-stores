import dayjs from 'dayjs';
import LZUTF8 from 'lzutf8';
import { PersistOptions } from 'zustand/middleware';
import { IdbStore } from './IdbStore';

function replacer(key: any, value: any) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  }
  return value;
}

function reviver(key: any, value: any) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

export function buildGetPersistSerializer<T>(
  axbootStore: IdbStore,
): <T>(
  storeName: string,
  storeVersion?: number,
  deserializeFallback?: (state: { state: T; version?: number }) => { state: T; version?: number },
  mode?: 'public' | 'private',
) => PersistOptions<T> {
  return function getPersistSerializer<T>(
    storeName: string,
    storeVersion: number = 1,
    deserializeFallback?: (state: { state: T; version?: number }) => { state: T; version?: number },
    mode: 'public' | 'private' = 'public',
  ): PersistOptions<T> {
    return {
      version: storeVersion,
      name: `store-${storeName}`,
      migrate: async (state: any, version: number) => {
        console.log(`store-${storeName} migrate`, version);
        return state;
      },
      storage: {
        getItem: async name => {
          const storageValue = (await axbootStore.get(name)) ?? {};
          // console.log(`store-${storeName} getItem`, name, storageValue);

          if (mode === 'private') {
            try {
              storageValue.state = storageValue.state
                ? JSON.parse(
                    LZUTF8.decompress(storageValue.state, {
                      inputEncoding: 'StorageBinaryString',
                    }),
                    reviver,
                  )
                : {};
            } catch (e) {
              console.error(`store-${storeName} getItem`, `${name}, parse error`);
              storageValue.state = {};
            }
          }

          if (typeof storageValue === 'object') {
            if (deserializeFallback) {
              try {
                storageValue.state = deserializeFallback(storageValue).state;
              } catch (e) {
                console.error(`${name} deserializeFallback 에러`, e);
                storageValue.state = {};
              }
            }

            // storageValue.state.loaded = false;
            return storageValue;
          }

          return {
            state: {
              loaded: false,
            },
          };
        },
        setItem: async (name, value) => {
          // console.log(`store-${storeName} setItem`, name, value);
          if (!value) {
            await axbootStore.set(name, { state: { loaded: false }, version: storeVersion });
          } else {
            const s = value.state as any;
            value.state = Object.keys(s).reduce((acc, key) => {
              if (dayjs.isDayjs(s[key])) {
                return { ...acc, [key]: s[key].format() };
              }
              if (typeof s[key] !== 'function' && !key.startsWith('_')) {
                return { ...acc, [key]: s[key] };
              }
              return acc;
            }, {}) as T;

            if (mode === 'private') {
              value.state = LZUTF8.compress(JSON.stringify(value.state, replacer), {
                outputEncoding: 'StorageBinaryString',
              });
            }

            await axbootStore.set(name, value);
          }
        },
        removeItem: async name => {
          await axbootStore.delete(name);
        },
      },
    };
  };
}
