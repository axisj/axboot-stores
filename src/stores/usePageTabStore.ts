import React from 'react';
import { matchPath } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export interface Page {
  serviceGroupId: string;
  fixed?: boolean;
  labels?: Record<string, string>;
  path?: string;
  hash?: string;
  icon?: string;
  metaData?: Record<string, any>;
  isHome?: boolean;
}

export interface PagesGroup {
  loaded: boolean;
  pages: Map<string, Page>;
  activeTabUuid: string;
  activeServiceGroupId: string;
}

export interface TabPage {
  tabUuid: string;
  serviceGroupId: string;
  page: Page;
}

export interface TabsActions {
  setLoaded: (loaded: boolean) => void;
  setPages: (pagesValues: [string, Page][]) => void;
  addTab: (page: Partial<Page>) => string;
  removeTab: (tabUuid: string) => void;
  removeTabs: (tabUuids: string[]) => void;
  updateTab: (tabUuid: string, page: Page) => void;
  updateTabLabels: (tabUuid: string, labels: Record<string, string>) => void;
  setActiveTab: (activeTabUuid: string) => void;
  getActiveTabPage: () => TabPage;
  setActiveTabByPath: (path: string, label?: React.ReactNode) => void;
  clearTab: () => void;
  getPageByPath: (path: string) => TabPage | undefined;
  getTabMetaDataByPath: <T extends Record<string, any>>(path: string) => T | undefined;
  setTabMetaDataByPath: <T extends Record<string, any>>(path: string, metaData: Partial<Record<keyof T, any>>) => void;

  resetServiceGroupTab: () => void;
  setActiveServiceTab: (serviceGroupId: string, tabUuid: string) => void;
}

export interface TabsStore extends PagesGroup, TabsActions {}

const initialUuid = 'home-tab';
const initialPage: Page = {
  serviceGroupId: '',
  labels: { en: 'HOME', ko: '홈' },
  path: '/',
  fixed: true,
  isHome: true,
};

export const tabsInitialState: PagesGroup = {
  loaded: false,
  pages: new Map<string, Page>([[initialUuid, initialPage]]),
  activeTabUuid: initialUuid,
  activeServiceGroupId: '',
};

export const usePageTabStore = buildStore<TabsStore>(
  'pageTabStore',
  1,
  (set, get) => ({
    ...tabsInitialState,
    setLoaded: (loaded: boolean) => set({ loaded }),
    setPages: pagesValues => {
      set({ pages: new Map(pagesValues) });
    },
    addTab: page => {
      const pages = get().pages;
      const pagesEntries = [...pages];
      const existsPageEntry = pagesEntries.find(([, _page]) => _page.path === page.path);
      if (existsPageEntry) {
        return existsPageEntry[0];
      }

      const tabUuid = uuidv4();
      pages.set(tabUuid, {
        serviceGroupId: page.serviceGroupId ?? '',
        labels: page.labels ?? { en: 'New Tab', ko: '새 탭' },
        path: page.path ?? '',
        fixed: page.fixed ?? false,
        isHome: page.isHome ?? false,
        metaData: undefined,
      });

      set({ pages: new Map([...pages]) });
      return tabUuid;
    },
    removeTab: tabUuid => {
      const pages = get().pages;
      if (!pages.get(tabUuid)?.isHome) {
        pages.delete(tabUuid);
        set({ pages: new Map([...pages]) });
      }
      return get().getActiveTabPage();
    },
    removeTabs: tabUuids => {
      const pages = get().pages;
      tabUuids.forEach(tabUuid => {
        pages.delete(tabUuid);
      });

      set({ pages: new Map([...pages]) });
      return get().getActiveTabPage();
    },
    updateTab: (tabUuid, page) => {
      const pages = get().pages;
      if (pages instanceof Map) {
        pages.set(tabUuid, page);
      }
      set({ pages: new Map([...pages]) });
    },
    updateTabLabels: (tabUuid, labels) => {
      const pages = get().pages;
      const page = pages.get(tabUuid);
      pages.set(tabUuid, {
        ...page,
        serviceGroupId: page?.serviceGroupId ?? '',
        labels,
      });
      set({ pages: new Map([...pages]) });
    },
    setActiveTab: activeTabUuid => {
      set({ activeTabUuid });
    },
    getActiveTabPage: () => {
      const activeTabUuid = get().activeTabUuid;
      const activeServiceGroupId = get().activeServiceGroupId;
      const pages = get().pages;
      const tabPage = getTabPage(activeTabUuid);

      if (tabPage) {
        return {
          tabUuid: activeTabUuid,
          serviceGroupId: activeServiceGroupId,
          page: tabPage,
        };
      }

      const pagesEntries = [...pages].filter(([, page]) => page.serviceGroupId === activeServiceGroupId);
      const pageEntry = pagesEntries[pagesEntries.length - 1];
      if (pageEntry) {
        set({ activeTabUuid: pageEntry[0] });
        return {
          tabUuid: pageEntry[0],
          serviceGroupId: activeServiceGroupId,
          page: pageEntry[1],
        };
      }

      const tabUuid = uuidv4();
      pages.set(tabUuid, { ...initialPage, serviceGroupId: activeServiceGroupId });
      set({
        activeTabUuid: tabUuid,
        activeServiceGroupId,
      });

      return {
        tabUuid,
        serviceGroupId: activeServiceGroupId,
        page: initialPage,
      };
    },
    setActiveTabByPath: path => {
      const pagesEntries = [...get().pages];
      const existsPageEntry = pagesEntries.find(([, _page]) => _page.path === path);
      const appMenuGroups = useAppStore.getState().appMenuGroups;
      const internalMenus = useAppStore.getState().internalMenus;
      const MENUS_LIST = getAppMenuList();

      if (existsPageEntry) {
        const serviceGroupId = existsPageEntry[1].serviceGroupId;
        set({
          activeTabUuid: existsPageEntry[0],
          activeServiceGroupId: serviceGroupId,
        });
      } else {
        if (path === '/') return;

        const menu =
          MENUS_LIST.find(menu => {
            return matchPath(menu.menuUrlValue ?? '', path);
          }) ??
          internalMenus.find(menu => {
            return matchPath(menu.routePath ?? '', path);
          });

        if (menu) {
          const isHome = !!appMenuGroups.find(mg => {
            mg.menuUrlValue === menu.menuUrlValue;
          });

          const serviceGroupId = menu.menuGroupId ?? '';
          const addedTabUuid = get().addTab({
            serviceGroupId,
            labels: menu.multiLang,
            path,
            fixed: false,
            isHome,
          });
          get().setActiveServiceTab(serviceGroupId, addedTabUuid);
        }
      }
    },
    clearTab: () => {
      get().pages.forEach((value, key, map) => {
        if (!value.fixed) {
          if (map instanceof Map) map.delete(key);
        }
      });
      set({ pages: new Map([...get().pages]) });
    },
    getPageByPath: path => {
      const tabUuid = [...get().pages].find(([, v]) => v.path === path)?.[0] ?? '';
      const page = getTabPage(tabUuid);

      if (!page) return;

      return {
        serviceGroupId: page.serviceGroupId,
        tabUuid,
        page,
      };
    },
    getTabMetaDataByPath: <T>(path) => {
      const pages = get().pages;
      const tabUuid = [...pages].find(([, v]) => v.path === path)?.[0] ?? '';
      return getTabPage(tabUuid)?.metaData as T;
    },
    setTabMetaDataByPath: (path, metaData) => {
      const tabPage = get().getPageByPath(path);

      if (tabPage) {
        tabPage.page.metaData = metaData;
        get().updateTab(tabPage.tabUuid, tabPage.page);
      }
    },
    resetServiceGroupTab: () => {
      const MENUS = useAppStore.getState().appMenuGroups;
      set({
        pages: new Map(
          MENUS.map(mg => {
            const serviceGroupId = mg.menuGroupId ?? '';
            return [
              serviceGroupId,
              {
                serviceGroupId,
                labels: mg.multiLang,
                path: '/' + mg.menuGroupId,
                fixed: true,
                isHome: true,
              },
            ];
          }),
        ),
      });
    },
    setActiveServiceTab: (serviceGroupId, tabUuid) => {
      set({
        activeTabUuid: tabUuid,
        activeServiceGroupId: serviceGroupId,
      });
    },
  }),
  storageValue => {
    if (storageValue.state) {
      storageValue.state.activeTabUuid = initialUuid;
      // if (storageValue.state.pages) {
      //   storageValue.state.pages = new Map([...storageValue.state.pages]);
      // }
    } else {
      storageValue.state = { ...tabsInitialState } as TabsStore;
    }
    return storageValue;
  },
);

usePageTabStore.persist.onFinishHydration(state => {
  if (!state.loaded) {
    state.setLoaded(true);
  }
});

export const setMetaDataByPath = <T extends Record<string, any>>(
  routePath: string,
  metaData: Partial<Record<keyof T, any>>,
) => {
  usePageTabStore.getState().setTabMetaDataByPath<T>(routePath, metaData);
};

export const getMetaDataByPath = <T extends Record<string, any>>(routePath: string) => {
  return usePageTabStore.getState().getTabMetaDataByPath<T>(routePath);
};

export const setLabelsByPath = (routePath: string, labels: Record<string, string>) => {
  const tabPage = usePageTabStore.getState().getPageByPath(routePath);
  if (tabPage) {
    usePageTabStore.getState().updateTabLabels(tabPage.tabUuid, labels);
  }
};

export const removeTabByPath = (routePath: string) => {
  const tabPage = usePageTabStore.getState().getPageByPath(routePath);
  if (tabPage) {
    usePageTabStore.getState().removeTab(tabPage.tabUuid);
  }
};

export const getTabStoreListener = <T extends Record<string, any>>(routerPath?: string) => {
  return (metaData: T) => {
    setMetaDataByPath<T>(routerPath ?? window.location.pathname, metaData);
  };
};

export const getTabPage = (tabUuid: string): Page | undefined => {
  const pages = usePageTabStore.getState().pages;
  if (pages instanceof Map) {
    return pages.get(tabUuid) as Page;
  } else if (Array.isArray(pages)) {
    return (pages as [string, Page][]).find(page => page[0] === tabUuid)?.[1];
  }
};
