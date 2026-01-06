'use client';

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';

export const delay = <T>(ms: number, result?: T): Promise<T> =>
  new Promise<T>(res => setTimeout(() => res(result as T), ms));

/* ---------------------------------------------------------------------
 * TYPES
 * -------------------------------------------------------------------*/
export type ModalFactory<T> = (
  open: boolean,
  resolve: (value: T) => T,
  reject: (reason?: any) => void,
  onClose: (evt: React.MouseEvent) => void,
  afterClose: () => void,
  keyboard?: boolean,
) => any;

interface IModalModel<T = any> {
  id: string;
  modalFactory?: ModalFactory<T>;
}

export class ModalModelClass {
  public modal: IModalModel;
  public open: boolean = true;
  public rejected: boolean = false;
  public hasHistory: boolean = false;
  public params: unknown;

  public resolve!: (value?: unknown) => void;
  public reject!: (reason?: unknown) => void;
  public onClose!: (evt: React.MouseEvent) => void;
  public afterClose!: () => void;

  constructor(value: IModalModel) {
    this.modal = value;
  }
}

export interface ModalModel {
  modals: Map<string, ModalModelClass>;
  updateAt?: number;
}

export interface ModalActions {
  openModal: <T = void>(modalFactory: ModalFactory<T>, id?: string) => Promise<T>;
  _closeModal: (id?: string, fromPopState?: boolean) => Promise<void>;
  removeModal: (id: string) => void;
  closeAllModal: () => void;
}

export interface ModalStore extends ModalModel, ModalActions {}

interface OpenModalOptions {
  skipHistory?: boolean;
}

/* ---------------------------------------------------------------------
 * STORE
 * -------------------------------------------------------------------*/
export const useModalStore = create<ModalStore>((set, get) => ({
  modals: new Map(),

  /* -----------------------------------------------------------------
     ✓ OPEN MODAL → 히스토리 pushState 추가
     -----------------------------------------------------------------*/
  openModal: <T = void>(modalFactory: ModalFactory<T>, id: string = uuidv4(), openModalOptions?: OpenModalOptions) => {
    return new Promise<T>((resolve, reject) => {
      if (get().modals.get(id)) {
        // 이미 같은 id의 모달이 있으면 무시
        return;
      }

      const modal = new ModalModelClass({ id, modalFactory });

      /* resolve / reject */
      modal.resolve = value => {
        get()
          ._closeModal(id)
          .then(() => {
            resolve(value as T);
          });
      };
      modal.reject = reason => {
        get()
          ._closeModal(id)
          .then(() => {
            reject(reason);
          });
      };

      /* overlay click */
      modal.onClose = evt => {
        const target = evt.target as HTMLElement;
        const current = evt.currentTarget as HTMLElement;

        if (target && current) {
          if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            modal.reject();
            return;
          }
          current.focus?.();
        } else {
          modal.reject();
        }
      };

      modal.afterClose = () => {
        get().removeModal(id as string);
      };

      /* --- 히스토리 더미 state 쌓기 --- */
      if (!openModalOptions?.skipHistory) {
        history.pushState({ _modalId: id }, '', location.href);
        modal.hasHistory = true;
      }

      /* add modal */
      get().modals.set(id, modal);
      set({ updateAt: Date.now() });
    });
  },

  /* -----------------------------------------------------------------
     ✓ CLOSE MODAL → history.back() 로 pushState 제거
     -----------------------------------------------------------------*/
  _closeModal: async (id?: string, fromPopState = false) => {
    const modals = get().modals;

    // id 없으면 가장 최근 모달을 자동으로 닫음
    const modalId = id || Array.from(modals.keys()).at(-1);
    if (!modalId) return;

    const modal = modals.get(modalId);
    if (!modal) return;

    modal.open = false;
    modals.set(modalId, modal);

    // popstate 로 인해 닫힌 경우에는 history.back() 하지 않음
    if (!fromPopState) {
      // dummy state 제거
      if (history.state && history.state._modalId === modalId) {
        history.back();
      }
    }

    await delay(100); // 모달 닫히는 애니메이션 대기

    set({ updateAt: Date.now() });
  },

  /* -----------------------------------------------------------------
     REMOVE
     -----------------------------------------------------------------*/
  removeModal: id => {
    get().modals.delete(id);
    set({ updateAt: Date.now() });
  },

  /* -----------------------------------------------------------------
     CLOSE ALL
     -----------------------------------------------------------------*/
  closeAllModal: () => {
    get().modals.clear();
    set({ updateAt: Date.now() });
  },
  closeModal: (id: string) => {
    const modal = get().modals.get(id);
    if (!modal) return;

    modal.reject();
  },
}));

/* ---------------------------------------------------------------------
 * GLOBAL POPSTATE LISTENER → 뒤로가기 시 모달 닫기
 * -------------------------------------------------------------------*/
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const store = useModalStore.getState();
    const modals = store.modals;

    if (modals.size === 0) return;

    // 가장 최근 모달 닫기
    const lastModalId = Array.from(modals.keys()).at(-1);
    if (!lastModalId) return;

    store._closeModal(lastModalId, true); // fromPopState=true
  });
}
