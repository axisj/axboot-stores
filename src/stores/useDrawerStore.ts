import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';

export type DrawerFactory<T> = (
  open: boolean,
  resolve: (value: any) => T,
  reject: (reason?: any) => void,
  onClose: (evt: React.MouseEvent) => void,
  afterOpenChange: (open: boolean) => void,
) => any;

interface IDrawerModel<T = any> {
  id: string;
  drawerFactory?: DrawerFactory<T>;
}

export class DrawerModelClass {
  public drawer: IDrawerModel;
  public open: boolean = true;

  public params: unknown;
  public resolve!: (value?: unknown) => void;
  public reject!: (reason?: unknown) => void;
  public onClose!: (evt: React.MouseEvent) => void;
  public afterOpenChange!: (open: boolean) => void;

  public constructor(value: IDrawerModel) {
    this.drawer = value;
  }
}

export interface DrawerModel {
  drawers: Map<string, DrawerModelClass>;
}

export interface DrawerActions {
  openDrawer: <T = void>(modalFactory: DrawerFactory<T>, id: string) => Promise<T>;
  closeDrawer: (id?: string) => void;
  removeDrawer: (id?: string) => void;
  closeAllDrawer: () => void;
}

export interface DrawerStore extends DrawerModel, DrawerActions {}

export const useDrawerStore = create<DrawerStore>((set, get) => ({
  drawers: new Map(),
  openDrawer: <T = void>(drawerFactory: DrawerFactory<T>, id?: string) => {
    return new Promise<T>((resolve, reject) => {
      if (!id) id = uuidv4();

      if (get().drawers.get(id)) {
        return;
      }

      const drawer = new DrawerModelClass({ id, drawerFactory });

      drawer.resolve = value => {
        resolve(value as T);
        get().closeDrawer(id);
      };
      drawer.reject = reason => {
        reject(reason);
        get().closeDrawer(id);
      };
      drawer.onClose = evt => {
        if (evt.target instanceof HTMLElement) {
          if (evt.target['tagName'] !== 'INPUT' && evt.target['tagName'] !== 'TEXTAREA') {
            drawer.reject();
            return;
          }
        }

        const current = evt.currentTarget as HTMLElement;
        if (typeof current.focus === 'function') {
          current.focus();
        }
      };
      drawer.afterOpenChange = open => {
        if (!open) {
          get().removeDrawer(id);
        }
      };

      get().drawers.set(id, drawer);
      set({ drawers: new Map([...get().drawers]) });
    });
  },
  closeDrawer: async id => {
    if (id) {
      const drawer = get().drawers.get(id);
      if (drawer) {
        drawer.open = false;
      }
    } else {
      // get().modals.clear();
    }

    set({ drawers: new Map([...get().drawers]) });
  },
  removeDrawer: id => {
    if (id) {
      get().drawers.delete(id);
      set({ drawers: new Map([...get().drawers]) });
    }
  },
  closeAllDrawer: () => {
    get().drawers.clear();
  },
}));
